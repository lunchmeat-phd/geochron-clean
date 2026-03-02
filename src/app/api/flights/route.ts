import { NextRequest, NextResponse } from "next/server";
import type { AdsbFlight, FlightsApiResponse } from "@/lib/flights";
import { isMilitaryAircraftModel } from "@/lib/military";

const ADSB_POINT_URL = "https://api.adsb.lol/v2/point";
const ADSB_MIL_URL = "https://api.adsb.lol/v2/mil";
const TTL_MS = 15_000;

type CacheRecord = {
  key: string;
  flights: AdsbFlight[];
  fetchedAt: string;
  expiresAt: number;
};

let cache: CacheRecord | null = null;

function toNumber(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function rankFlight(flight: AdsbFlight): number {
  let score = 0;
  if (isMilitaryAircraftModel(flight.t)) {
    score += 1000;
  }
  if (typeof flight.alt_baro === "number" && flight.alt_baro > 5000) {
    score += 80;
  }
  if (typeof flight.gs === "number") {
    score += Math.min(120, flight.gs / 5);
  }
  return score;
}

function maxFlightsForZoom(zoom: number): number {
  if (zoom < 5) {
    return 80;
  }
  if (zoom < 6) {
    return 140;
  }
  if (zoom < 7) {
    return 220;
  }
  return 320;
}

function sanitizeFlights(raw: unknown): AdsbFlight[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      hex: String(item.hex ?? ""),
      flight: typeof item.flight === "string" ? item.flight.trim() : undefined,
      r: typeof item.r === "string" ? item.r.trim() : undefined,
      t: typeof item.t === "string" ? item.t.trim() : undefined,
      squawk: typeof item.squawk === "string"
        ? item.squawk.trim()
        : typeof item.sqk === "string"
          ? item.sqk.trim()
          : undefined,
      lat: Number(item.lat),
      lon: Number(item.lon),
      alt_baro: typeof item.alt_baro === "number" || typeof item.alt_baro === "string" ? (item.alt_baro as number | string) : undefined,
      gs: typeof item.gs === "number" ? item.gs : undefined,
      track: typeof item.track === "number" ? item.track : undefined,
      category: typeof item.category === "string" ? item.category : undefined,
    }))
    .filter((f) => f.hex && Number.isFinite(f.lat) && Number.isFinite(f.lon) && Math.abs(f.lat) <= 90 && Math.abs(f.lon) <= 180);
}

export async function GET(request: NextRequest) {
  const lat = toNumber(request.nextUrl.searchParams.get("lat"), 0);
  const lon = toNumber(request.nextUrl.searchParams.get("lon"), 0);
  const radiusKm = Math.max(50, Math.min(1800, toNumber(request.nextUrl.searchParams.get("radiusKm"), 600)));
  const zoom = Math.max(0, Math.min(12, toNumber(request.nextUrl.searchParams.get("zoom"), 5)));
  const militaryOnly = request.nextUrl.searchParams.get("militaryOnly") === "1";

  const key = `${lat.toFixed(2)}:${lon.toFixed(2)}:${Math.round(radiusKm)}:${Math.round(zoom * 10)}:${militaryOnly ? "mil" : "all"}`;
  const now = Date.now();

  if (cache && cache.key === key && now < cache.expiresAt) {
    const payload: FlightsApiResponse = {
      flights: cache.flights,
      fetchedAt: cache.fetchedAt,
      stale: false,
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } });
  }

  try {
    const url = militaryOnly ? ADSB_MIL_URL : `${ADSB_POINT_URL}/${lat}/${lon}/${Math.round(radiusKm)}`;
    const upstream = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });

    if (!upstream.ok) {
      throw new Error(`ADSB fetch failed (${upstream.status})`);
    }

    const data = (await upstream.json()) as { ac?: unknown[] };
    const allFlights = sanitizeFlights(data.ac);

    const limit = militaryOnly ? 600 : maxFlightsForZoom(zoom);
    const prioritized = [...allFlights].sort((a, b) => rankFlight(b) - rankFlight(a));
    const flights = prioritized.slice(0, limit);
    const fetchedAt = new Date().toISOString();

    cache = {
      key,
      flights,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    const payload: FlightsApiResponse = {
      flights,
      filteredFrom: allFlights.length,
      fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } });
  } catch (error) {
    if (cache) {
      const payload: FlightsApiResponse = {
        flights: cache.flights,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown ADS-B fetch error",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown ADS-B fetch error" },
      { status: 503 },
    );
  }
}
