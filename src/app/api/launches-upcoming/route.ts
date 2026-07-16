import { NextResponse } from "next/server";
import type { UpcomingLaunch, UpcomingLaunchesApiResponse } from "@/lib/launches";
import { readDiskCache, writeDiskCache } from "@/lib/diskCache";

// Launch Library 2 (The Space Devs) is the best free rocket-launch API. Its unauthenticated
// tier is rate-limited (~15 req/hr/IP), so we query the next N upcoming launches once and cache
// generously; a stock ticker / launch board does not need sub-20-minute freshness.
// Default ("normal") mode returns nested provider/rocket/location objects that toUpcoming reads.
// Only 8 launches once per 20 min, so the heavier payload is irrelevant.
const UPCOMING_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=8&ordering=net";
const TTL_MS = 20 * 60_000;
const DISK_KEY = "launches-upcoming";

type LaunchLibraryListItem = {
  id?: string;
  name?: string;
  net?: string;
  status?: { name?: string; abbrev?: string };
  launch_service_provider?: { name?: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  pad?: { location?: { name?: string; country_code?: string } };
};

type LaunchLibraryListResponse = { results?: LaunchLibraryListItem[] };

type CacheRecord = { launches: UpcomingLaunch[]; fetchedAt: string; expiresAt: number };

let cache: CacheRecord | null = null;

function toUpcoming(item: LaunchLibraryListItem): UpcomingLaunch | null {
  if (!item.id || !item.net) {
    return null;
  }
  return {
    id: item.id,
    name: item.name ?? "Unnamed launch",
    provider: item.launch_service_provider?.name ?? "Unknown provider",
    rocket: item.rocket?.configuration?.full_name ?? item.rocket?.configuration?.name,
    net: item.net,
    locationName: item.pad?.location?.name,
    countryCode: item.pad?.location?.country_code,
    status: item.status?.name ?? "Unknown",
    statusAbbrev: item.status?.abbrev,
  };
}

async function fetchUpcoming(): Promise<UpcomingLaunch[]> {
  const upstream = await fetch(UPCOMING_URL, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!upstream.ok) {
    throw new Error(`Launch Library upcoming request failed (${upstream.status})`);
  }
  const json = (await upstream.json()) as LaunchLibraryListResponse;
  const launches = (json.results ?? [])
    .map(toUpcoming)
    .filter((launch): launch is UpcomingLaunch => launch !== null);
  if (launches.length === 0) {
    throw new Error("Launch Library returned no upcoming launches");
  }
  return launches;
}

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    return NextResponse.json({ launches: cache.launches, fetchedAt: cache.fetchedAt, stale: false } satisfies UpcomingLaunchesApiResponse, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  }

  try {
    const launches = await fetchUpcoming();
    const fetchedAt = new Date().toISOString();
    cache = { launches, fetchedAt, expiresAt: now + TTL_MS };
    void writeDiskCache<{ launches: UpcomingLaunch[]; fetchedAt: string }>(DISK_KEY, { launches, fetchedAt });

    return NextResponse.json({ launches, fetchedAt, stale: false } satisfies UpcomingLaunchesApiResponse, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown launch feed error";

    if (cache) {
      return NextResponse.json({ launches: cache.launches, fetchedAt: cache.fetchedAt, stale: true, error: message } satisfies UpcomingLaunchesApiResponse);
    }

    // Cold start with upstream down/rate-limited — fall back to last-good from disk.
    const disk = await readDiskCache<{ launches: UpcomingLaunch[]; fetchedAt: string }>(DISK_KEY);
    if (disk) {
      return NextResponse.json({ launches: disk.launches, fetchedAt: disk.fetchedAt, stale: true, error: message } satisfies UpcomingLaunchesApiResponse);
    }

    return NextResponse.json(
      { launches: [], fetchedAt: new Date().toISOString(), stale: true, error: message } satisfies UpcomingLaunchesApiResponse,
      { status: 200 },
    );
  }
}
