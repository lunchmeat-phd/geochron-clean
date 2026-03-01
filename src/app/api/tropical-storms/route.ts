import { NextResponse } from "next/server";

type ActiveStorm = Record<string, unknown>;

type CurrentStormsPayload = {
  activeStorms?: ActiveStorm[];
};

type TropicalStormApiResponse = {
  data: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

type CacheRecord = {
  data: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;
  fetchedAt: string;
  expiresAt: number;
};

const CURRENT_STORMS_URL = "https://www.nhc.noaa.gov/CurrentStorms.json";
const TTL_MS = 10 * 60_000;

let cache: CacheRecord | null = null;

const EMPTY: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>> = {
  type: "FeatureCollection",
  features: [],
};

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function pickLatLon(storm: ActiveStorm): [number, number] | null {
  const latKeys = ["lat", "latitude", "stormLat", "centerLat"];
  const lonKeys = ["lon", "longitude", "stormLon", "centerLon"];

  for (const latKey of latKeys) {
    for (const lonKey of lonKeys) {
      const lat = parseNumeric(storm[latKey]);
      const lon = parseNumeric(storm[lonKey]);
      if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return [lon, lat];
      }
    }
  }

  return null;
}

function toFeatures(payload: CurrentStormsPayload): GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>> {
  const storms = Array.isArray(payload.activeStorms) ? payload.activeStorms : [];
  const features: GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>[] = [];

  for (const storm of storms) {
    const point = pickLatLon(storm);
    if (!point) {
      continue;
    }

    const id =
      (typeof storm.id === "string" && storm.id) ||
      (typeof storm.stormId === "string" && storm.stormId) ||
      `${String(storm.name ?? storm.stormName ?? "storm")}-${point[1]}-${point[0]}`;

    const name =
      (typeof storm.name === "string" && storm.name) ||
      (typeof storm.stormName === "string" && storm.stormName) ||
      "Tropical System";

    const stormType =
      (typeof storm.type === "string" && storm.type) ||
      (typeof storm.stormType === "string" && storm.stormType) ||
      "Unknown";

    const windKt = parseNumeric(storm.wind);
    const advisory = typeof storm.publicAdvisory === "string" ? storm.publicAdvisory : null;

    features.push({
      type: "Feature",
      id,
      properties: {
        id,
        name,
        stormType,
        windKt,
        advisory,
      },
      geometry: {
        type: "Point",
        coordinates: point,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return NextResponse.json(
      {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: false,
      } satisfies TropicalStormApiResponse,
      { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } },
    );
  }

  try {
    const response = await fetch(CURRENT_STORMS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "world-clock-plus/1.0 (personal project)",
      },
    });

    if (!response.ok) {
      throw new Error(`Tropical storms request failed (${response.status})`);
    }

    const data = toFeatures((await response.json()) as CurrentStormsPayload);
    const fetchedAt = new Date().toISOString();
    cache = {
      data,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    return NextResponse.json(
      {
        data,
        fetchedAt,
        stale: false,
      } satisfies TropicalStormApiResponse,
      { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } },
    );
  } catch (error) {
    if (cache) {
      return NextResponse.json({
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown tropical storm feed error",
      } satisfies TropicalStormApiResponse);
    }

    return NextResponse.json(
      {
        data: EMPTY,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown tropical storm feed error",
      } satisfies TropicalStormApiResponse,
      { status: 200 },
    );
  }
}

