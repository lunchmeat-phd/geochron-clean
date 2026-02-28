import { NextRequest, NextResponse } from "next/server";
import type { MilitaryBasePointProperties, MilitaryBasesApiResponse } from "@/lib/militaryBases";

const NTAD_BASES_URL =
  "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Military_Bases/FeatureServer/0/query";
const NTAD_PAGE_SIZE = 1000;
const NTAD_MAX_PAGES = 20;
const NTAD_TTL_MS = 12 * 60 * 60 * 1000;
const OSM_TTL_MS = 3 * 60 * 1000;

type BasePointFeature = GeoJSON.Feature<GeoJSON.Point, MilitaryBasePointProperties>;

type NtadFeature = {
  attributes?: Record<string, unknown>;
  centroid?: {
    x?: number;
    y?: number;
  };
};

type NtadPayload = {
  features?: NtadFeature[];
  exceededTransferLimit?: boolean;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassPayload = {
  elements?: OverpassElement[];
  remark?: string;
};

type UsCacheRecord = {
  points: BasePointFeature[];
  fetchedAt: string;
  expiresAt: number;
};

type OsmCacheRecord = {
  points: BasePointFeature[];
  fetchedAt: string;
  expiresAt: number;
};

let usCache: UsCacheRecord | null = null;
const osmCache = new Map<string, OsmCacheRecord>();

function toNumber(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function normalizeBounds(bounds: [number, number, number, number]): [number, number, number, number] {
  return [
    clamp(bounds[0], -180, 180),
    clamp(bounds[1], -90, 90),
    clamp(bounds[2], -180, 180),
    clamp(bounds[3], -90, 90),
  ];
}

function parseBounds(request: NextRequest): [number, number, number, number] {
  const minLon = toNumber(request.nextUrl.searchParams.get("minLon"), -180);
  const minLat = toNumber(request.nextUrl.searchParams.get("minLat"), -85);
  const maxLon = toNumber(request.nextUrl.searchParams.get("maxLon"), 180);
  const maxLat = toNumber(request.nextUrl.searchParams.get("maxLat"), 85);

  return normalizeBounds([minLon, minLat, maxLon, maxLat]);
}

function pointInBounds(lon: number, lat: number, bounds: [number, number, number, number]): boolean {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  if (lat < minLat || lat > maxLat) {
    return false;
  }

  if (minLon <= maxLon) {
    return lon >= minLon && lon <= maxLon;
  }

  // Dateline crossing case.
  return lon >= minLon || lon <= maxLon;
}

function maxUsForZoom(zoom: number): number {
  if (zoom < 2) {
    return 300;
  }
  if (zoom < 3) {
    return 550;
  }
  if (zoom < 4) {
    return 900;
  }
  if (zoom < 5) {
    return 1300;
  }
  return 1800;
}

function maxOsmForZoom(zoom: number): number {
  if (zoom < 4) {
    return 0;
  }
  if (zoom < 5) {
    return 180;
  }
  return 320;
}

function trimOsmCache(): void {
  if (osmCache.size <= 40) {
    return;
  }

  const entries = [...osmCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  for (let i = 0; i < entries.length - 30; i += 1) {
    osmCache.delete(entries[i][0]);
  }
}

function cacheKeyForBounds(bounds: [number, number, number, number], zoom: number): string {
  const round = (value: number) => value.toFixed(1);
  return `${round(bounds[0])}:${round(bounds[1])}:${round(bounds[2])}:${round(bounds[3])}:z${Math.floor(zoom)}`;
}

function isUsOperationalStatus(status: unknown): boolean {
  if (typeof status !== "string") {
    return true;
  }

  const normalized = status.trim().toLowerCase();
  return normalized === "act" || normalized === "active" || normalized === "opr";
}

function isRelevantMilitaryTag(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const excluded = new Set(["checkpoint", "office", "obstacle_course"]);
  return !excluded.has(normalized);
}

function looksAmericanOperator(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return /\b(united states|u\.?s\.?|usa|usaf|us navy|us army|usmc|marine corps|dod)\b/i.test(value);
}

function toFeatureId(prefix: string, id: string | number): string {
  return `${prefix}-${String(id)}`;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function fetchUsBases(): Promise<UsCacheRecord> {
  const now = Date.now();
  if (usCache && now < usCache.expiresAt) {
    return usCache;
  }

  const points: BasePointFeature[] = [];

  for (let page = 0; page < NTAD_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,countryName,featureName,siteName,siteReportingComponent,siteOperationalStatus",
      resultRecordCount: String(NTAD_PAGE_SIZE),
      resultOffset: String(page * NTAD_PAGE_SIZE),
      returnGeometry: "false",
      returnCentroid: "true",
      f: "pjson",
    });

    const upstream = await fetch(`${NTAD_BASES_URL}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      throw new Error(`NTAD military-base fetch failed (${upstream.status})`);
    }

    const data = (await upstream.json()) as NtadPayload;
    const features = Array.isArray(data.features) ? data.features : [];

    for (let i = 0; i < features.length; i += 1) {
      const feature = features[i];
      const attrs = feature.attributes ?? {};
      const centroid = feature.centroid;
      const lon = centroid?.x;
      const lat = centroid?.y;
      const objectId = attrs.OBJECTID;

      if (typeof lon !== "number" || typeof lat !== "number") {
        continue;
      }

      if (!isUsOperationalStatus(attrs.siteOperationalStatus)) {
        continue;
      }

      const name =
        getString(attrs, "siteName") ??
        getString(attrs, "featureName") ??
        getString(attrs, "featureDescription") ??
        "US Installation";

      const militaryType = getString(attrs, "siteReportingComponent") ?? "us-dod";
      const country = getString(attrs, "countryName");
      const id = typeof objectId === "number" || typeof objectId === "string" ? objectId : `${page}-${i}`;

      points.push({
        type: "Feature",
        id: toFeatureId("us", id),
        properties: {
          name,
          militaryType,
          source: "ntad",
          american: true,
          country,
          operator: "US DoD",
        },
        geometry: {
          type: "Point",
          coordinates: [lon, lat],
        },
      });
    }

    if (!data.exceededTransferLimit || features.length < NTAD_PAGE_SIZE) {
      break;
    }
  }

  const fetchedAt = new Date().toISOString();
  usCache = {
    points,
    fetchedAt,
    expiresAt: now + NTAD_TTL_MS,
  };

  return usCache;
}

function buildOverpassQuery(bounds: [number, number, number, number], maxCount: number): string {
  const [west, south, east, north] = bounds;

  const primary = `node["military"~"^(base|barracks|airfield|naval_base|training_area|range|yes)$"](${south},${west},${north},${east});`;

  const wrapped =
    `node["military"~"^(base|barracks|airfield|naval_base|training_area|range|yes)$"](${south},${west},${north},180);` +
    `node["military"~"^(base|barracks|airfield|naval_base|training_area|range|yes)$"](${south},-180,${north},${east});`;

  // Overpass expects south,west,north,east and does not support dateline-crossing bboxes in one clause.
  if (west <= east) {
    return `[out:json][timeout:18];(${primary});out ${maxCount};`;
  }

  return `[out:json][timeout:18];(${wrapped});out ${maxCount};`;
}

async function fetchOsmNonUs(bounds: [number, number, number, number], zoom: number): Promise<OsmCacheRecord> {
  const maxCount = maxOsmForZoom(zoom);
  if (maxCount === 0) {
    return {
      points: [],
      fetchedAt: new Date().toISOString(),
      expiresAt: Date.now() + OSM_TTL_MS,
    };
  }

  const key = cacheKeyForBounds(bounds, zoom);
  const now = Date.now();
  const cached = osmCache.get(key);
  if (cached && now < cached.expiresAt) {
    return cached;
  }

  const query = buildOverpassQuery(bounds, maxCount);
  const upstream = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams({ data: query }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  if (!upstream.ok) {
    throw new Error(`OSM military-base fetch failed (${upstream.status})`);
  }

  const payload = (await upstream.json()) as OverpassPayload;
  if (typeof payload.remark === "string" && /timed out|rate_limited/i.test(payload.remark)) {
    throw new Error(`OSM military-base query limited: ${payload.remark}`);
  }
  const elements = Array.isArray(payload.elements) ? payload.elements : [];

  const points: BasePointFeature[] = [];
  const dedupe = new Set<string>();

  for (const element of elements) {
    const tags = element.tags ?? {};
    const militaryType = tags.military;
    if (!isRelevantMilitaryTag(militaryType)) {
      continue;
    }

    const operator = tags.operator;
    if (looksAmericanOperator(operator)) {
      continue;
    }

    const lon = typeof element.lon === "number" ? element.lon : element.center?.lon;
    const lat = typeof element.lat === "number" ? element.lat : element.center?.lat;
    if (typeof lon !== "number" || typeof lat !== "number") {
      continue;
    }

    if (!pointInBounds(lon, lat, bounds)) {
      continue;
    }

    const keyPart = `${lon.toFixed(4)}:${lat.toFixed(4)}:${militaryType}`;
    if (dedupe.has(keyPart)) {
      continue;
    }
    dedupe.add(keyPart);

    const name = (tags.name && tags.name.trim()) || `${militaryType} installation`;
    const country = tags["addr:country"] || tags["is_in:country"] || tags["is_in:country_code"];

    points.push({
      type: "Feature",
      id: toFeatureId("osm", element.id),
      properties: {
        name,
        militaryType,
        source: "osm",
        american: false,
        country,
        operator: operator || "Unknown",
      },
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
    });

    if (points.length >= maxCount) {
      break;
    }
  }

  const record: OsmCacheRecord = {
    points,
    fetchedAt: new Date().toISOString(),
    expiresAt: now + OSM_TTL_MS,
  };

  osmCache.set(key, record);
  trimOsmCache();
  return record;
}

function filterUsInView(points: BasePointFeature[], bounds: [number, number, number, number], zoom: number): BasePointFeature[] {
  const maxCount = maxUsForZoom(zoom);
  const inView = points.filter((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    return pointInBounds(lon, lat, bounds);
  });

  return inView.slice(0, maxCount);
}

function toResponse(
  features: BasePointFeature[],
  fetchedAt: string,
  stale: boolean,
  error?: string,
): MilitaryBasesApiResponse {
  const americanCount = features.filter((feature) => feature.properties.american).length;
  const nonAmericanCount = features.length - americanCount;

  return {
    data: {
      type: "FeatureCollection",
      features,
    },
    fetchedAt,
    stale,
    error,
    americanCount,
    nonAmericanCount,
  };
}

export async function GET(request: NextRequest) {
  const zoom = clamp(toNumber(request.nextUrl.searchParams.get("zoom"), 3.5), 0, 10);
  const bounds = parseBounds(request);

  let usPoints: BasePointFeature[] = [];
  let fetchedAt = new Date().toISOString();
  let stale = false;
  let errorMessage: string | undefined;

  try {
    const us = await fetchUsBases();
    usPoints = filterUsInView(us.points, bounds, zoom);
    fetchedAt = us.fetchedAt;
  } catch (error) {
    stale = true;
    errorMessage = error instanceof Error ? error.message : "Failed to fetch US military-base data";

    if (usCache) {
      usPoints = filterUsInView(usCache.points, bounds, zoom);
      fetchedAt = usCache.fetchedAt;
    }
  }

  let nonUsPoints: BasePointFeature[] = [];
  try {
    const nonUs = await fetchOsmNonUs(bounds, zoom);
    nonUsPoints = nonUs.points;
    fetchedAt = fetchedAt > nonUs.fetchedAt ? fetchedAt : nonUs.fetchedAt;
  } catch (error) {
    stale = true;
    const message = error instanceof Error ? error.message : "Failed to fetch non-US military-base data";
    errorMessage = errorMessage ? `${errorMessage}; ${message}` : message;
  }

  const allPoints = [...usPoints, ...nonUsPoints];
  const payload = toResponse(allPoints, fetchedAt, stale, errorMessage);

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=45, s-maxage=45",
    },
  });
}
