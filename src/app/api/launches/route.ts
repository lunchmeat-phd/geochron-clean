import { NextResponse } from "next/server";
import type { RocketLaunchApiResponse, RocketLaunchCollection, RocketLaunchProperties } from "@/lib/launches";

const LAUNCH_LIBRARY_UPCOMING_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/";
const LAUNCH_LIBRARY_PREVIOUS_URL = "https://ll.thespacedevs.com/2.2.0/launch/previous/";
const TTL_MS = 5 * 60_000;
const FETCH_LIMIT = 100;

type LaunchLibraryLaunch = {
  id?: string;
  name?: string;
  net?: string;
  window_start?: string;
  window_end?: string;
  status?: { name?: string };
  launch_service_provider?: { name?: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  pad?: {
    latitude?: string;
    longitude?: string;
    location?: { name?: string; country_code?: string };
  };
};

type LaunchLibraryResponse = {
  results?: LaunchLibraryLaunch[];
};

type CacheRecord = {
  data: RocketLaunchCollection;
  fetchedAt: string;
  expiresAt: number;
};

let cache: CacheRecord | null = null;

const EMPTY: RocketLaunchCollection = { type: "FeatureCollection", features: [] };

function parseMaybeNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toFeature(launch: LaunchLibraryLaunch): GeoJSON.Feature<GeoJSON.Point, RocketLaunchProperties> | null {
  const lat = parseMaybeNumber(launch.pad?.latitude);
  const lon = parseMaybeNumber(launch.pad?.longitude);

  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }

  const id = launch.id ?? `${launch.name ?? "launch"}-${launch.net ?? "unknown"}`;
  const net = launch.net ?? new Date().toISOString();

  return {
    type: "Feature",
    id,
    properties: {
      id,
      name: launch.name ?? "Unnamed launch",
      provider: launch.launch_service_provider?.name ?? "Unknown provider",
      rocket: launch.rocket?.configuration?.full_name ?? launch.rocket?.configuration?.name,
      net,
      windowStart: launch.window_start,
      windowEnd: launch.window_end,
      status: launch.status?.name ?? "Unknown",
      locationName: launch.pad?.location?.name,
      countryCode: launch.pad?.location?.country_code,
    },
    geometry: {
      type: "Point",
      coordinates: [lon, lat],
    },
  };
}

function twoDayWindow(): { startIso: string; endIso: string } {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60_000);
  const end = new Date(now.getTime() + 24 * 60 * 60_000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function upcomingWindowParams(endIso: string): URLSearchParams {
  const now = new Date();

  return new URLSearchParams({
    limit: String(FETCH_LIMIT),
    ordering: "net",
    window_end__gte: now.toISOString(),
    window_start__lte: endIso,
  });
}

function previousWindowParams(startIso: string): URLSearchParams {
  return new URLSearchParams({
    limit: String(FETCH_LIMIT),
    ordering: "-net",
    window_start__gte: startIso,
    window_end__lte: new Date().toISOString(),
  });
}

function inTimeWindow(netIso: string | undefined, startMs: number, endMs: number): boolean {
  if (!netIso) {
    return false;
  }
  const t = Date.parse(netIso);
  return Number.isFinite(t) && t >= startMs && t <= endMs;
}

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    const cached: RocketLaunchApiResponse = {
      data: cache.data,
      fetchedAt: cache.fetchedAt,
      stale: false,
    };
    return NextResponse.json(cached, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  }

  try {
    const { startIso, endIso } = twoDayWindow();
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);
    const [upcomingRes, previousRes] = await Promise.all([
      fetch(`${LAUNCH_LIBRARY_UPCOMING_URL}?${upcomingWindowParams(endIso).toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${LAUNCH_LIBRARY_PREVIOUS_URL}?${previousWindowParams(startIso).toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }),
    ]);

    if (!upcomingRes.ok) {
      throw new Error(`Upcoming launch request failed (${upcomingRes.status})`);
    }
    if (!previousRes.ok) {
      throw new Error(`Previous launch request failed (${previousRes.status})`);
    }

    const upcomingJson = (await upcomingRes.json()) as LaunchLibraryResponse;
    const previousJson = (await previousRes.json()) as LaunchLibraryResponse;
    const merged = [...(previousJson.results ?? []), ...(upcomingJson.results ?? [])];
    const uniqueById = new Map<string, LaunchLibraryLaunch>();
    for (const launch of merged) {
      if (!launch.id || !inTimeWindow(launch.net, startMs, endMs)) {
        continue;
      }
      uniqueById.set(launch.id, launch);
    }

    const launches = [...uniqueById.values()].sort((a, b) => {
      const aNet = Date.parse(a.net ?? "");
      const bNet = Date.parse(b.net ?? "");
      return aNet - bNet;
    });

    const features = launches.map(toFeature).filter((f): f is NonNullable<typeof f> => f !== null);
    const data: RocketLaunchCollection = { type: "FeatureCollection", features };
    const fetchedAt = new Date().toISOString();

    cache = {
      data,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    const payload: RocketLaunchApiResponse = {
      data,
      fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  } catch (error) {
    if (cache) {
      const fallback: RocketLaunchApiResponse = {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown launch feed error",
      };
      return NextResponse.json(fallback, { status: 200 });
    }

    return NextResponse.json(
      {
        data: EMPTY,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown launch feed error",
      } satisfies RocketLaunchApiResponse,
      { status: 503 },
    );
  }
}
