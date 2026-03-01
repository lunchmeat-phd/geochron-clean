import { NextResponse } from "next/server";
import type { GeoLineCollection, InfrastructureApiResponse } from "@/lib/infrastructure";

const SHIPPING_LANES_URL =
  "https://raw.githubusercontent.com/newzealandpaul/Shipping-Lanes/main/data/Shipping_Lanes_v1.geojson";
const TTL_MS = 24 * 60 * 60_000;

type CacheRecord = {
  data: GeoLineCollection;
  fetchedAt: string;
  expiresAt: number;
};

let cache: CacheRecord | null = null;

const EMPTY_LINES: GeoLineCollection = {
  type: "FeatureCollection",
  features: [],
};

function normalizeLines(collection: GeoJSON.FeatureCollection): GeoLineCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.filter(
      (feature): feature is GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString, Record<string, unknown>> =>
        feature.geometry?.type === "LineString" || feature.geometry?.type === "MultiLineString",
    ),
  };
}

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    const payload: InfrastructureApiResponse = {
      data: cache.data,
      fetchedAt: cache.fetchedAt,
      stale: false,
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800" } });
  }

  try {
    const response = await fetch(SHIPPING_LANES_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`Shipping lanes request failed (${response.status})`);
    }

    const upstream = (await response.json()) as GeoJSON.FeatureCollection;
    const data = normalizeLines(upstream);
    const fetchedAt = new Date().toISOString();

    cache = {
      data,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    const payload: InfrastructureApiResponse = {
      data,
      fetchedAt,
      stale: false,
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800" } });
  } catch (error) {
    if (cache) {
      const fallback: InfrastructureApiResponse = {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown shipping lanes error",
      };
      return NextResponse.json(fallback, { status: 200 });
    }

    return NextResponse.json(
      {
        data: EMPTY_LINES,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown shipping lanes error",
      } satisfies InfrastructureApiResponse,
      { status: 200 },
    );
  }
}

