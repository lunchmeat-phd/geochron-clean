import { NextResponse } from "next/server";
import type { EarthquakesApiResponse, UsgsEarthquakeCollection } from "@/lib/earthquakes";
import { readDiskCache, writeDiskCache } from "@/lib/diskCache";

const DISK_KEY = "earthquakes";
type DiskShape = { data: UsgsEarthquakeCollection; fetchedAt: string };

const USGS_ALL_DAY_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const TTL_MS = 60_000;
const MIN_MAGNITUDE = 3;

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

    const raw = (await upstream.json()) as UsgsEarthquakeCollection;
    // Only show magnitude 3.0+ — filters out the constant stream of tiny quakes that
    // otherwise clutter the map. Applied here so the panel count matches what's drawn.
    const data: UsgsEarthquakeCollection = {
      ...raw,
      features: (raw.features ?? []).filter((feature) => {
        const mag = feature.properties?.mag;
        return typeof mag === "number" && mag >= MIN_MAGNITUDE;
      }),
    };
    const fetchedAt = new Date().toISOString();

    cache = {
      data,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };
    void writeDiskCache<DiskShape>(DISK_KEY, { data, fetchedAt });

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
    const message = error instanceof Error ? error.message : "Unknown earthquake fetch error";

    if (cache) {
      const payload: EarthquakesApiResponse = {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: message,
      };

      return NextResponse.json(payload, { status: 200 });
    }

    // Cold start with upstream down — fall back to last-good data persisted on disk.
    const disk = await readDiskCache<DiskShape>(DISK_KEY);
    if (disk) {
      return NextResponse.json(
        { data: disk.data, fetchedAt: disk.fetchedAt, stale: true, error: message } satisfies EarthquakesApiResponse,
        { status: 200 },
      );
    }

    return NextResponse.json({ error: message }, { status: 503 });
  }
}
