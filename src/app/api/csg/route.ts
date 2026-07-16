import { NextResponse } from "next/server";
import {
  buildCarrierStrikeGroupSnapshot,
  type CarrierStrikeGroupApiResponse,
  type Observation,
} from "@/lib/csg";
import { fetchLatestUsniObservations } from "@/lib/csgTracker";
import { readDiskCache, writeDiskCache } from "@/lib/diskCache";

// Carrier positions auto-refresh from the USNI weekly Fleet & Marine Tracker. Cached a week so we
// only re-parse when a new tracker is likely published; falls back to the last-good positions on
// disk, and ultimately to the hardcoded seed in lib/csg.ts if USNI is unreachable/unparseable.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DISK_KEY = "csg-observations";

type DiskShape = { observations: Observation[]; fetchedAt: string };
type CacheRecord = { observations: Observation[]; fetchedAt: string; expiresAt: number };

let cache: CacheRecord | null = null;

// `observations === undefined` builds from the hardcoded seed in lib/csg.ts.
function respond(observations: Observation[] | undefined, fetchedAt: string, stale: boolean, error?: string) {
  const snapshot = observations
    ? buildCarrierStrikeGroupSnapshot(observations)
    : buildCarrierStrikeGroupSnapshot();

  return NextResponse.json(
    {
      data: snapshot.collection,
      fetchedAt,
      stale,
      groupCount: snapshot.groupCount,
      activeSources: snapshot.activeSources,
      totalSources: snapshot.totalSources,
      averageConfidenceScore: snapshot.averageConfidenceScore,
      sourceHealth: snapshot.sourceHealth,
      ...(error ? { error } : {}),
    } satisfies CarrierStrikeGroupApiResponse,
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    return respond(cache.observations, cache.fetchedAt, false);
  }

  try {
    const result = await fetchLatestUsniObservations();
    const fetchedAt = new Date().toISOString();
    cache = { observations: result.observations, fetchedAt, expiresAt: now + TTL_MS };
    void writeDiskCache<DiskShape>(DISK_KEY, { observations: result.observations, fetchedAt });
    return respond(result.observations, fetchedAt, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "USNI tracker unavailable";

    if (cache) {
      return respond(cache.observations, cache.fetchedAt, true, message);
    }
    const disk = await readDiskCache<DiskShape>(DISK_KEY);
    if (disk) {
      return respond(disk.observations, disk.fetchedAt, true, message);
    }
    return respond(undefined, new Date().toISOString(), true, message);
  }
}
