import { NextResponse } from "next/server";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  type EciVec3,
  type SatRec,
} from "satellite.js";
import type { IssApiPayload, IssOrbitPoint, IssTrackerResponse } from "@/lib/iss";

// Primary source is now the orbital elements (TLE), propagated locally with satellite.js.
// This gives both live position AND the predicted orbit without depending on a live
// position API. The old HTTP position APIs remain only as a last-resort fallback.
const TLE_PRIMARY_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";
const TLE_FALLBACK_URL = "https://tle.ivanstanojevic.me/api/tle/25544"; // JSON TLE mirror
const ISS_API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_NOW_FALLBACK_URL = "http://api.open-notify.org/iss-now.json";

const POSITION_TTL_MS = 5_000;
const TLE_TTL_MS = 2 * 60 * 60_000; // TLEs stay accurate for well over a day; refresh every 2h.
const ORBIT_STEP_SECONDS = 120;
const ORBIT_SPAN_SECONDS = 90 * 60;

type TleRecord = {
  satrec: SatRec;
  fetchedAt: number;
};

type CacheRecord = {
  data: IssApiPayload;
  orbit: IssOrbitPoint[];
  fetchedAt: string;
  expiresAt: number;
};

let tleCache: TleRecord | null = null;
let cache: CacheRecord | null = null;

function parseTleText(text: string): [string, string] | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const line1 = lines.find((line) => line.startsWith("1 "));
  const line2 = lines.find((line) => line.startsWith("2 "));
  return line1 && line2 ? [line1, line2] : null;
}

async function loadSatrec(): Promise<SatRec> {
  const now = Date.now();
  if (tleCache && now - tleCache.fetchedAt < TLE_TTL_MS) {
    return tleCache.satrec;
  }

  // Try Celestrak (plain TLE), then a JSON mirror.
  try {
    const res = await fetch(TLE_PRIMARY_URL, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const pair = parseTleText(await res.text());
      if (pair) {
        const satrec = twoline2satrec(pair[0], pair[1]);
        tleCache = { satrec, fetchedAt: now };
        return satrec;
      }
    }
  } catch {
    // Fall through to the mirror.
  }

  const res = await fetch(TLE_FALLBACK_URL, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`TLE fetch failed (${res.status})`);
  }
  const json = (await res.json()) as { line1?: string; line2?: string };
  if (!json.line1 || !json.line2) {
    throw new Error("TLE mirror returned no elements");
  }
  const satrec = twoline2satrec(json.line1, json.line2);
  tleCache = { satrec, fetchedAt: now };
  return satrec;
}

function propagateAt(satrec: SatRec, date: Date): { lat: number; lon: number; altKm: number; velKmh: number } | null {
  const pv = propagate(satrec, date);
  if (!pv || typeof pv.position === "boolean" || typeof pv.velocity === "boolean") {
    return null;
  }
  const position = pv.position as EciVec3<number>;
  const velocity = pv.velocity as EciVec3<number>;
  const gmst = gstime(date);
  const geo = eciToGeodetic(position, gmst);
  const lat = degreesLat(geo.latitude);
  const lon = degreesLong(geo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  const velKmh = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2) * 3600;
  return { lat, lon, altKm: geo.height, velKmh };
}

function computeFromTle(satrec: SatRec): { data: IssApiPayload; orbit: IssOrbitPoint[] } | null {
  const now = new Date();
  const current = propagateAt(satrec, now);
  if (!current) {
    return null;
  }

  const nowSec = Math.floor(now.getTime() / 1000);
  const orbit: IssOrbitPoint[] = [];
  for (let offset = 0; offset <= ORBIT_SPAN_SECONDS; offset += ORBIT_STEP_SECONDS) {
    const point = propagateAt(satrec, new Date((nowSec + offset) * 1000));
    if (point) {
      orbit.push({ latitude: point.lat, longitude: point.lon, timestamp: nowSec + offset });
    }
  }

  return {
    data: {
      latitude: current.lat,
      longitude: current.lon,
      altitude: Math.round(current.altKm * 10) / 10,
      velocity: Math.round(current.velKmh),
      visibility: "unknown",
      timestamp: nowSec,
    },
    orbit,
  };
}

// Last-resort position-only fallback if TLE propagation is unavailable.
async function fetchPositionFallback(): Promise<IssApiPayload> {
  try {
    const res = await fetch(ISS_API_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      return {
        latitude: Number(raw.latitude),
        longitude: Number(raw.longitude),
        altitude: Number(raw.altitude),
        velocity: Number(raw.velocity),
        visibility: String(raw.visibility ?? "unknown"),
        timestamp: Number(raw.timestamp),
      };
    }
  } catch {
    // Fall through to open-notify.
  }

  const res = await fetch(ISS_NOW_FALLBACK_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) {
    throw new Error(`ISS fallback fetch failed (${res.status})`);
  }
  const raw = (await res.json()) as {
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
      headers: { "Cache-Control": "public, max-age=5, s-maxage=5" },
    });
  }

  try {
    const satrec = await loadSatrec();
    const computed = computeFromTle(satrec);
    if (!computed) {
      throw new Error("TLE propagation produced no position");
    }

    const fetchedAt = new Date().toISOString();
    cache = {
      data: computed.data,
      orbit: computed.orbit,
      fetchedAt,
      expiresAt: now + POSITION_TTL_MS,
    };

    const payload: IssTrackerResponse = {
      data: computed.data,
      orbit: computed.orbit,
      fetchedAt,
      stale: false,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=5, s-maxage=5" },
    });
  } catch (tleError) {
    // TLE path failed — try position-only fallback so the marker still moves.
    try {
      const data = await fetchPositionFallback();
      const fetchedAt = new Date().toISOString();
      const orbit = cache?.orbit ?? [];
      cache = { data, orbit, fetchedAt, expiresAt: now + POSITION_TTL_MS };
      const payload: IssTrackerResponse = {
        data,
        orbit,
        fetchedAt,
        stale: true,
        error: tleError instanceof Error ? tleError.message : "TLE unavailable; using position fallback",
      };
      return NextResponse.json(payload, { status: 200 });
    } catch (fallbackError) {
      if (cache) {
        const payload: IssTrackerResponse = {
          data: cache.data,
          orbit: cache.orbit,
          fetchedAt: cache.fetchedAt,
          stale: true,
          error: fallbackError instanceof Error ? fallbackError.message : "Unknown ISS fetch error",
        };
        return NextResponse.json(payload, { status: 200 });
      }
      return NextResponse.json(
        { error: fallbackError instanceof Error ? fallbackError.message : "Unknown ISS fetch error" },
        { status: 503 },
      );
    }
  }
}
