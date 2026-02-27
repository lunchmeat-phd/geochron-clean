import { NextResponse } from "next/server";
import type { EarthquakesApiResponse, UsgsEarthquakeCollection } from "@/lib/earthquakes";

const USGS_ALL_DAY_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const TTL_MS = 60_000;

type CacheRecord = {
  data: UsgsEarthquakeCollection;
  fetchedAt: string;
  expiresAt: number;
};

let cache: CacheRecord | null = null;

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    const payload: EarthquakesApiResponse = {
      data: cache.data,
      fetchedAt: cache.fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  }

  try {
    const upstream = await fetch(USGS_ALL_DAY_URL, {
      cache: "no-store",
    });

    if (!upstream.ok) {
      throw new Error(`USGS fetch failed (${upstream.status})`);
    }

    const data = (await upstream.json()) as UsgsEarthquakeCollection;
    const fetchedAt = new Date().toISOString();

    cache = {
      data,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    const payload: EarthquakesApiResponse = {
      data,
      fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (error) {
    if (cache) {
      const payload: EarthquakesApiResponse = {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown earthquake fetch error",
      };

      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown earthquake fetch error",
      },
      { status: 503 },
    );
  }
}
