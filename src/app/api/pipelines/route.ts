import { NextRequest, NextResponse } from "next/server";
import type { GeoLineCollection, InfrastructureApiResponse } from "@/lib/infrastructure";

const PIPELINES_URL =
  "https://services6.arcgis.com/62zavqsrcK71xG8O/arcgis/rest/services/Global_Oil_and_Gas_Features/FeatureServer/13/query";
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;
const TTL_MS = 6 * 60 * 60 * 1000;

type LineFeature = GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString, Record<string, unknown>>;

type RankedFeature = {
  feature: LineFeature;
  score: number;
  bbox: [number, number, number, number];
  id: string;
};

type CacheRecord = {
  data: GeoLineCollection;
  ranked: RankedFeature[];
  fetchedAt: string;
  expiresAt: number;
};

type ArcGisGeoJson = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> & {
  properties?: {
    exceededTransferLimit?: boolean;
  };
};

let cache: CacheRecord | null = null;

const EMPTY_LINES: GeoLineCollection = {
  type: "FeatureCollection",
  features: [],
};

function toLineCollection(collection: ArcGisGeoJson): GeoLineCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.filter(
      (feature): feature is LineFeature =>
        feature.geometry?.type === "LineString" || feature.geometry?.type === "MultiLineString",
    ),
  };
}

function toNumber(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function maxItemsForZoom(zoom: number): number {
  if (zoom < 2) {
    return 220;
  }
  if (zoom < 3) {
    return 380;
  }
  if (zoom < 4) {
    return 700;
  }
  if (zoom < 5) {
    return 1200;
  }
  if (zoom < 6) {
    return 2200;
  }
  return 3400;
}

function parseNumericMax(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(/,/g, "");
  const matches = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) {
    return 0;
  }

  let max = 0;
  for (const token of matches) {
    const n = Number(token);
    if (Number.isFinite(n)) {
      max = Math.max(max, n);
    }
  }

  return max;
}

function getFeatureBbox(feature: LineFeature): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const include = (lon: number, lat: number) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return;
    }
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  };

  if (feature.geometry.type === "LineString") {
    for (const coord of feature.geometry.coordinates) {
      include(coord[0], coord[1]);
    }
  } else {
    for (const line of feature.geometry.coordinates) {
      for (const coord of line) {
        include(coord[0], coord[1]);
      }
    }
  }

  if (!Number.isFinite(minLon)) {
    return [-180, -90, 180, 90];
  }

  return [minLon, minLat, maxLon, maxLat];
}

function scorePipeline(feature: LineFeature): number {
  const props = feature.properties;
  const capacity = parseNumericMax(props.Capacity);
  const throughput = parseNumericMax(props.Throughput);
  const diameter = parseNumericMax(props.Diameter);
  const lengthMeters = parseNumericMax(props.Shape__Length);

  const status = String(props.Status ?? "").toLowerCase();
  const commodity = String(props.Commodity ?? "").toLowerCase();
  const type = String(props.Type ?? "").toLowerCase();

  let score = 0;
  score += Math.log10(1 + capacity) * 180;
  score += Math.log10(1 + throughput) * 170;
  score += Math.log10(1 + diameter) * 120;
  score += Math.log10(1 + lengthMeters) * 35;

  if (status.includes("operat") || status.includes("active") || status.includes("online")) {
    score += 75;
  }

  if (status.includes("decommission") || status.includes("abandon") || status.includes("cancel")) {
    score -= 120;
  }

  if (commodity.includes("crude") || commodity.includes("oil") || commodity.includes("lng") || commodity.includes("gas")) {
    score += 45;
  }

  if (type.includes("transmission") || type.includes("trunk") || type.includes("main")) {
    score += 35;
  }

  return score;
}

function parseBounds(request: NextRequest): [number, number, number, number] | null {
  const minLon = Number(request.nextUrl.searchParams.get("minLon"));
  const minLat = Number(request.nextUrl.searchParams.get("minLat"));
  const maxLon = Number(request.nextUrl.searchParams.get("maxLon"));
  const maxLat = Number(request.nextUrl.searchParams.get("maxLat"));

  if (![minLon, minLat, maxLon, maxLat].every((n) => Number.isFinite(n))) {
    return null;
  }

  return [
    clamp(minLon, -180, 180),
    clamp(minLat, -90, 90),
    clamp(maxLon, -180, 180),
    clamp(maxLat, -90, 90),
  ];
}

function bboxIntersects(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function expandBounds(
  bounds: [number, number, number, number],
  lonPad: number,
  latPad: number,
): [number, number, number, number] {
  return [
    clamp(bounds[0] - lonPad, -180, 180),
    clamp(bounds[1] - latPad, -90, 90),
    clamp(bounds[2] + lonPad, -180, 180),
    clamp(bounds[3] + latPad, -90, 90),
  ];
}

function selectRanked(
  ranked: RankedFeature[],
  limit: number,
  viewBounds: [number, number, number, number] | null,
): LineFeature[] {
  if (!viewBounds) {
    return ranked.slice(0, limit).map((entry) => entry.feature);
  }

  const inView = ranked.filter((entry) => bboxIntersects(entry.bbox, viewBounds));
  if (inView.length >= Math.floor(limit * 0.6)) {
    return inView.slice(0, limit).map((entry) => entry.feature);
  }

  // If the current viewport is sparse, widen selection radius so users still see
  // nearby major pipelines instead of only far-away globally top-ranked segments.
  const candidates = [...inView];
  if (viewBounds) {
    const expansions: Array<[number, number]> = [
      [10, 6],
      [20, 10],
      [35, 16],
      [55, 24],
      [85, 35],
    ];

    for (const [lonPad, latPad] of expansions) {
      if (candidates.length >= limit) {
        break;
      }

      const expanded = expandBounds(viewBounds, lonPad, latPad);
      for (const entry of ranked) {
        if (candidates.length >= limit) {
          break;
        }
        if (candidates.some((candidate) => candidate.id === entry.id)) {
          continue;
        }
        if (bboxIntersects(entry.bbox, expanded)) {
          candidates.push(entry);
        }
      }
    }
  }

  const picked: LineFeature[] = [];
  const seen = new Set<string>();

  for (const entry of candidates) {
    if (picked.length >= limit) {
      break;
    }
    picked.push(entry.feature);
    seen.add(entry.id);
  }

  for (const entry of ranked) {
    if (picked.length >= limit) {
      break;
    }
    if (seen.has(entry.id)) {
      continue;
    }
    picked.push(entry.feature);
    seen.add(entry.id);
  }

  return picked;
}

function buildRanked(data: GeoLineCollection): RankedFeature[] {
  const ranked = data.features.map((feature, index) => {
    const idFromData = feature.id;
    const objectId = feature.properties.OBJECTID;
    const id = typeof idFromData === "string" || typeof idFromData === "number"
      ? String(idFromData)
      : typeof objectId === "number" || typeof objectId === "string"
        ? String(objectId)
        : String(index);

    return {
      feature,
      score: scorePipeline(feature),
      bbox: getFeatureBbox(feature),
      id,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

async function fetchPipelines(): Promise<GeoLineCollection> {
  const features: LineFeature[] = [];
  const outFields = "OBJECTID,Capacity,Throughput,Diameter,Shape__Length,Status,Commodity,Type";

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields,
      f: "geojson",
      outSR: "4326",
      returnGeometry: "true",
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(page * PAGE_SIZE),
    });

    let upstream: Response;
    try {
      upstream = await fetch(`${PIPELINES_URL}?${params.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      if (features.length > 0) {
        break;
      }
      throw error;
    }

    if (!upstream.ok) {
      if (features.length > 0) {
        break;
      }
      throw new Error(`Pipeline fetch failed (${upstream.status})`);
    }

    const data = (await upstream.json()) as ArcGisGeoJson;
    const lines = toLineCollection(data);
    features.push(...lines.features);

    if (!data.properties?.exceededTransferLimit || lines.features.length < PAGE_SIZE) {
      break;
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export async function GET(request: NextRequest) {
  const now = Date.now();
  const zoom = clamp(toNumber(request.nextUrl.searchParams.get("zoom"), 3.2), 0, 10);
  const limit = maxItemsForZoom(zoom);
  const viewBounds = parseBounds(request);

  if (cache && now < cache.expiresAt) {
    const payload: InfrastructureApiResponse = {
      data: {
        type: "FeatureCollection",
        features: selectRanked(cache.ranked, limit, viewBounds),
      },
      fetchedAt: cache.fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }

  try {
    const data = await fetchPipelines();
    const ranked = buildRanked(data);
    const fetchedAt = new Date().toISOString();

    if (ranked.length === 0) {
      if (cache && cache.ranked.length > 0) {
        const payload: InfrastructureApiResponse = {
          data: {
            type: "FeatureCollection",
            features: selectRanked(cache.ranked, limit, viewBounds),
          },
          fetchedAt: cache.fetchedAt,
          stale: true,
          error: "Pipeline source returned no features; showing last cached dataset.",
        };

        return NextResponse.json(payload, { status: 200 });
      }

      const payload: InfrastructureApiResponse = {
        data: EMPTY_LINES,
        fetchedAt,
        stale: true,
        error: "Pipeline source returned no features.",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    cache = {
      data,
      ranked,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    const payload: InfrastructureApiResponse = {
      data: {
        type: "FeatureCollection",
        features: selectRanked(ranked, limit, viewBounds),
      },
      fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    if (cache) {
      const payload: InfrastructureApiResponse = {
        data: {
          type: "FeatureCollection",
          features: selectRanked(cache.ranked, limit, viewBounds),
        },
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown pipeline fetch error",
      };

      return NextResponse.json(payload, { status: 200 });
    }

    const payload: InfrastructureApiResponse = {
      data: EMPTY_LINES,
      fetchedAt: new Date().toISOString(),
      stale: true,
      error: error instanceof Error ? error.message : "Unknown pipeline fetch error",
    };

    return NextResponse.json(payload, { status: 200 });
  }
}
