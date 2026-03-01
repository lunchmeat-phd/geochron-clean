import { NextResponse } from "next/server";

type NwsAlertsPayload = {
  features?: GeoJSON.Feature[];
};

type TsunamiApiResponse = {
  data: GeoJSON.FeatureCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

type CacheRecord = {
  data: GeoJSON.FeatureCollection;
  fetchedAt: string;
  expiresAt: number;
};

const ALERT_ENDPOINTS = [
  "https://api.weather.gov/alerts/active?event=Tsunami%20Warning",
  "https://api.weather.gov/alerts/active?event=Tsunami%20Watch",
  "https://api.weather.gov/alerts/active?event=Tsunami%20Advisory",
] as const;

const TTL_MS = 2 * 60_000;

let cache: CacheRecord | null = null;

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function normalizeFeature(feature: GeoJSON.Feature): GeoJSON.Feature | null {
  const type = feature.geometry?.type;
  if (type !== "Polygon" && type !== "MultiPolygon" && type !== "Point") {
    return null;
  }
  return feature;
}

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return NextResponse.json(
      {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: false,
      } satisfies TsunamiApiResponse,
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  }

  try {
    const results = await Promise.all(
      ALERT_ENDPOINTS.map(async (url) => {
        const response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
          headers: {
            "User-Agent": "world-clock-plus/1.0 (personal project)",
            Accept: "application/geo+json, application/json",
          },
        });
        if (!response.ok) {
          throw new Error(`Tsunami alerts request failed (${response.status})`);
        }
        const payload = (await response.json()) as NwsAlertsPayload;
        return Array.isArray(payload.features) ? payload.features : [];
      }),
    );

    const dedupe = new Map<string, GeoJSON.Feature>();
    for (const group of results) {
      for (const feature of group) {
        const normalized = normalizeFeature(feature);
        if (!normalized) {
          continue;
        }
        const id =
          (typeof normalized.id === "string" && normalized.id) ||
          (typeof normalized.id === "number" && String(normalized.id)) ||
          (normalized.properties && typeof normalized.properties.id === "string" ? normalized.properties.id : null) ||
          crypto.randomUUID();
        dedupe.set(id, {
          ...normalized,
          id,
        });
      }
    }

    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [...dedupe.values()],
    };
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
      } satisfies TsunamiApiResponse,
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (error) {
    if (cache) {
      return NextResponse.json({
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown tsunami feed error",
      } satisfies TsunamiApiResponse);
    }

    return NextResponse.json(
      {
        data: EMPTY,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown tsunami feed error",
      } satisfies TsunamiApiResponse,
      { status: 200 },
    );
  }
}

