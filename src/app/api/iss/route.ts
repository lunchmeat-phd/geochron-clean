import { NextResponse } from "next/server";
import type { IssApiPayload, IssOrbitPoint, IssTrackerResponse } from "@/lib/iss";

const ISS_API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_FALLBACK_URL = "http://api.open-notify.org/iss-now.json";
const TTL_MS = 5_000;
const ORBIT_TTL_MS = 60_000;

type CacheRecord = {
  data: IssApiPayload;
  orbit: IssOrbitPoint[];
  fetchedAt: string;
  expiresAt: number;
  orbitExpiresAt: number;
};

let cache: CacheRecord | null = null;

async function fetchCurrentIss(): Promise<IssApiPayload> {
  try {
    const upstream = await fetch(ISS_API_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!upstream.ok) {
      throw new Error(`ISS fetch failed (${upstream.status})`);
    }

    const raw = (await upstream.json()) as Record<string, unknown>;
    return {
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      altitude: Number(raw.altitude),
      velocity: Number(raw.velocity),
      visibility: String(raw.visibility ?? "unknown"),
      timestamp: Number(raw.timestamp),
    };
  } catch {
    const fallback = await fetch(ISS_FALLBACK_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!fallback.ok) {
      throw new Error(`ISS fallback fetch failed (${fallback.status})`);
    }

    const raw = (await fallback.json()) as {
      timestamp?: number;
      iss_position?: { latitude?: string; longitude?: string };
    };

    return {
      latitude: Number(raw.iss_position?.latitude),
      longitude: Number(raw.iss_position?.longitude),
      altitude: 0,
      velocity: 0,
      visibility: "unknown",
      timestamp: Number(raw.timestamp),
    };
  }
}

function buildOrbitTimestamps(startTimestamp: number): number[] {
  const points: number[] = [];
  const endTimestamp = startTimestamp + 90 * 60;

  for (let ts = startTimestamp; ts <= endTimestamp; ts += 120) {
    points.push(ts);
  }

  return points;
}

async function fetchOrbitPath(startTimestamp: number): Promise<IssOrbitPoint[]> {
  const timestamps = buildOrbitTimestamps(startTimestamp);
  const url = `${ISS_API_URL}/positions?timestamps=${timestamps.join(",")}&units=kilometers`;
  const orbitResponse = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });

  if (!orbitResponse.ok) {
    throw new Error(`ISS orbit fetch failed (${orbitResponse.status})`);
  }

  const raw = (await orbitResponse.json()) as Array<Record<string, unknown>>;

  return raw
    .map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      timestamp: Number(point.timestamp),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        Number.isFinite(point.timestamp) &&
        point.latitude >= -90 &&
        point.latitude <= 90 &&
        point.longitude >= -180 &&
        point.longitude <= 180,
    );
}

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    const payload: IssTrackerResponse = {
      data: cache.data,
      orbit: cache.orbit,
      fetchedAt: cache.fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=5",
      },
    });
  }

  try {
    const data = await fetchCurrentIss();
    let orbit = cache?.orbit ?? [];
    if (!cache || now >= cache.orbitExpiresAt || orbit.length === 0) {
      try {
        orbit = await fetchOrbitPath(data.timestamp);
      } catch {
        try {
          orbit = await fetchOrbitPath(Math.floor(Date.now() / 1000));
        } catch {
          orbit = cache?.orbit ?? [];
        }
      }
    }

    const fetchedAt = new Date().toISOString();

    cache = {
      data,
      orbit,
      fetchedAt,
      expiresAt: now + TTL_MS,
      orbitExpiresAt: now + ORBIT_TTL_MS,
    };

    const payload: IssTrackerResponse = {
      data,
      orbit,
      fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=5",
      },
    });
  } catch (error) {
    if (cache) {
      const payload: IssTrackerResponse = {
        data: cache.data,
        orbit: cache.orbit,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown ISS fetch error",
      };

      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown ISS fetch error",
      },
      { status: 503 },
    );
  }
}
