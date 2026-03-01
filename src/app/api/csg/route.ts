import { NextResponse } from "next/server";
import {
  buildCarrierStrikeGroupSnapshot,
  type CarrierStrikeGroupApiResponse,
  type CarrierStrikeGroupCollection,
} from "@/lib/csg";

const TTL_MS = 15 * 60_000;

type CacheRecord = {
  data: CarrierStrikeGroupCollection;
  fetchedAt: string;
  expiresAt: number;
};

let cache: CacheRecord | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    const snapshot = buildCarrierStrikeGroupSnapshot();
    return NextResponse.json(
      {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: false,
        groupCount: snapshot.groupCount,
        activeSources: snapshot.activeSources,
        totalSources: snapshot.totalSources,
        averageConfidenceScore: snapshot.averageConfidenceScore,
        sourceHealth: snapshot.sourceHealth,
      } satisfies CarrierStrikeGroupApiResponse,
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=900" } },
    );
  }

  try {
    const snapshot = buildCarrierStrikeGroupSnapshot();
    const data = snapshot.collection;
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
        groupCount: snapshot.groupCount,
        activeSources: snapshot.activeSources,
        totalSources: snapshot.totalSources,
        averageConfidenceScore: snapshot.averageConfidenceScore,
        sourceHealth: snapshot.sourceHealth,
      } satisfies CarrierStrikeGroupApiResponse,
      { headers: { "Cache-Control": "public, max-age=900, s-maxage=900" } },
    );
  } catch (error) {
    const fallbackSnapshot = buildCarrierStrikeGroupSnapshot();
    if (cache) {
      return NextResponse.json({
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        groupCount: fallbackSnapshot.groupCount,
        activeSources: fallbackSnapshot.activeSources,
        totalSources: fallbackSnapshot.totalSources,
        averageConfidenceScore: fallbackSnapshot.averageConfidenceScore,
        sourceHealth: fallbackSnapshot.sourceHealth,
        error: error instanceof Error ? error.message : "Unknown CSG layer error",
      } satisfies CarrierStrikeGroupApiResponse);
    }

    const empty: CarrierStrikeGroupCollection = { type: "FeatureCollection", features: [] };
    return NextResponse.json(
      {
        data: empty,
        fetchedAt: new Date().toISOString(),
        stale: true,
        groupCount: 0,
        activeSources: 0,
        totalSources: 0,
        averageConfidenceScore: 0,
        sourceHealth: [],
        error: error instanceof Error ? error.message : "Unknown CSG layer error",
      } satisfies CarrierStrikeGroupApiResponse,
      { status: 503 },
    );
  }
}
