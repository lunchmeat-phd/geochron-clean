import { NextRequest, NextResponse } from "next/server";
import type { ShipPointProperties, ShipsApiResponse, ShipsCollection } from "@/lib/ships";

const AIS_DIGITRAFFIC_URL =
  "https://services.arcgis.com/4PuGhqdWG1FwH2Yk/arcgis/rest/services/digitraffic_AIS_ships_view/FeatureServer/0/query";
const TTL_MS = 60_000;

type ArcGeometry = {
  x?: number;
  y?: number;
};

type ArcFeature = {
  attributes?: Record<string, unknown>;
  geometry?: ArcGeometry;
};

type ArcPayload = {
  features?: ArcFeature[];
};

type CacheRecord = {
  data: ShipsCollection;
  fetchedAt: string;
  expiresAt: number;
  key: string;
};

let cache: CacheRecord | null = null;

const EMPTY: ShipsCollection = {
  type: "FeatureCollection",
  features: [],
};

function toNumber(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function maxShipsForZoom(zoom: number): number {
  if (zoom < 2) {
    return 80;
  }
  if (zoom < 3) {
    return 150;
  }
  if (zoom < 4) {
    return 240;
  }
  if (zoom < 5) {
    return 360;
  }
  return 500;
}

function shipClassByType(type: number | undefined): string {
  if (typeof type !== "number") {
    return "Unknown";
  }

  if (type >= 20 && type < 30) {
    return "WIG";
  }
  if (type >= 30 && type < 40) {
    return "Special Craft";
  }
  if (type >= 40 && type < 50) {
    return "High-Speed Craft";
  }
  if (type >= 50 && type < 60) {
    return "Service Vessel";
  }
  if (type >= 60 && type < 70) {
    return "Passenger";
  }
  if (type >= 70 && type < 80) {
    return "Cargo";
  }
  if (type >= 80 && type < 90) {
    return "Tanker";
  }
  if (type >= 90 && type < 100) {
    return "Other";
  }
  return "Unknown";
}

function parseMaybeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseMaybeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toFeature(feature: ArcFeature): GeoJSON.Feature<GeoJSON.Point, ShipPointProperties> | null {
  const attrs = feature.attributes ?? {};
  const lon = feature.geometry?.x;
  const lat = feature.geometry?.y;

  if (typeof lon !== "number" || typeof lat !== "number") {
    return null;
  }

  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
    return null;
  }

  const mmsiValue = parseMaybeNumber(attrs.mmsi);
  if (typeof mmsiValue !== "number") {
    return null;
  }

  const shipType = parseMaybeNumber(attrs.my_shipType);
  const timestampAge = parseMaybeNumber(attrs.my_timestamp);

  return {
    type: "Feature",
    id: String(mmsiValue),
    properties: {
      mmsi: Math.round(mmsiValue),
      name: parseMaybeString(attrs.my_name),
      callSign: parseMaybeString(attrs.my_callSign),
      imo: parseMaybeNumber(attrs.my_imo)?.toString(),
      destination: parseMaybeString(attrs.my_destination),
      shipType,
      shipClass: shipClassByType(shipType),
      speedKnots: parseMaybeNumber(attrs.sog),
      courseDeg: parseMaybeNumber(attrs.cog),
      draughtMeters: parseMaybeNumber(attrs.my_draught),
      ageMinutes: timestampAge,
    },
    geometry: {
      type: "Point",
      coordinates: [lon, lat],
    },
  };
}

function normalizeBounds(request: NextRequest): [number, number, number, number] {
  const minLon = clamp(toNumber(request.nextUrl.searchParams.get("minLon"), -180), -180, 180);
  const minLat = clamp(toNumber(request.nextUrl.searchParams.get("minLat"), -90), -90, 90);
  const maxLon = clamp(toNumber(request.nextUrl.searchParams.get("maxLon"), 180), -180, 180);
  const maxLat = clamp(toNumber(request.nextUrl.searchParams.get("maxLat"), 90), -90, 90);

  return [minLon, minLat, maxLon, maxLat];
}

function makeCacheKey(bounds: [number, number, number, number], zoom: number): string {
  const round = (v: number) => v.toFixed(2);
  return `${round(bounds[0])}:${round(bounds[1])}:${round(bounds[2])}:${round(bounds[3])}:z${zoom.toFixed(1)}`;
}

function buildParams(bounds: [number, number, number, number], limit: number): URLSearchParams {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  return new URLSearchParams({
    where: "1=1",
    geometry: `${minLon},${minLat},${maxLon},${maxLat}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "mmsi,my_name,sog,cog,my_shipType,my_timestamp,my_callSign,my_imo,my_destination,my_draught",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: String(limit),
    f: "pjson",
  });
}

export async function GET(request: NextRequest) {
  const bounds = normalizeBounds(request);
  const zoom = clamp(toNumber(request.nextUrl.searchParams.get("zoom"), 3), 0, 10);
  const limit = maxShipsForZoom(zoom);
  const key = makeCacheKey(bounds, zoom);
  const now = Date.now();

  if (cache && cache.key === key && now < cache.expiresAt) {
    const payload: ShipsApiResponse = {
      data: cache.data,
      fetchedAt: cache.fetchedAt,
      stale: false,
      source: "digitraffic-ais",
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  }

  try {
    const params = buildParams(bounds, limit);
    const upstream = await fetch(`${AIS_DIGITRAFFIC_URL}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });

    if (!upstream.ok) {
      throw new Error(`AIS ship fetch failed (${upstream.status})`);
    }

    const payload = (await upstream.json()) as ArcPayload;
    const rawFeatures = Array.isArray(payload.features) ? payload.features : [];
    const features = rawFeatures.map(toFeature).filter((item): item is NonNullable<typeof item> => item !== null);
    const fetchedAt = new Date().toISOString();

    const data: ShipsCollection = {
      type: "FeatureCollection",
      features,
    };

    cache = {
      key,
      data,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    const response: ShipsApiResponse = {
      data,
      fetchedAt,
      stale: false,
      source: "digitraffic-ais",
    };

    return NextResponse.json(response, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  } catch (error) {
    if (cache) {
      const fallback: ShipsApiResponse = {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown AIS fetch error",
        source: "digitraffic-ais",
      };
      return NextResponse.json(fallback, { status: 200 });
    }

    return NextResponse.json(
      {
        data: EMPTY,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown AIS fetch error",
        source: "digitraffic-ais",
      } satisfies ShipsApiResponse,
      { status: 503 },
    );
  }
}
