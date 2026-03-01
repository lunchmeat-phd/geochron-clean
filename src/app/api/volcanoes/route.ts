import { NextResponse } from "next/server";

type EventsApiResponse = {
  events?: Array<{
    id?: string;
    title?: string;
    closed?: string | null;
    categories?: Array<{ id?: string; title?: string }>;
    geometry?: Array<{
      date?: string;
      type?: string;
      coordinates?: number[] | number[][] | number[][][];
    }>;
    sources?: Array<{ id?: string; url?: string }>;
  }>;
};

type EventGeometry = {
  date?: string;
  type?: string;
  coordinates?: number[] | number[][] | number[][][];
};

type VolcanoApiResponse = {
  data: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

type CacheRecord = {
  data: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;
  fetchedAt: string;
  expiresAt: number;
};

const EONET_VOLCANO_OPEN_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=200";
const EONET_VOLCANO_FALLBACK_URL =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=all&category=volcanoes&days=365&limit=400";
const TTL_MS = 10 * 60_000;

let cache: CacheRecord | null = null;

const STATIC_FALLBACK: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>> = {
  type: "FeatureCollection",
  features: [
    ["Kilauea", -155.292, 19.421],
    ["Etna", 14.999, 37.751],
    ["Stromboli", 15.213, 38.789],
    ["Merapi", 110.446, -7.54],
    ["Sakurajima", 130.657, 31.585],
    ["Popocatepetl", -98.622, 19.023],
    ["Fuego", -90.88, 14.473],
    ["Reventador", -77.656, -0.077],
  ].map(([name, lon, lat], index) => ({
    type: "Feature" as const,
    id: `fallback-${index}`,
    properties: {
      title: name,
      observedAt: null,
      sourceUrl: null,
      fallback: true,
    },
    geometry: {
      type: "Point",
      coordinates: [lon as number, lat as number],
    },
  })),
};

function toLonLat(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return [lon, lat];
}

function geometryToPoint(geometry: EventGeometry): [number, number] | null {
  if (!geometry.coordinates) {
    return null;
  }
  if (geometry.type === "Point") {
    return toLonLat(geometry.coordinates);
  }
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    const ring = geometry.coordinates[0];
    if (Array.isArray(ring) && ring.length > 0) {
      const first = toLonLat(ring[0]);
      if (first) {
        return first;
      }
    }
  }
  return null;
}

function pickLatestPoint(
  event: NonNullable<EventsApiResponse["events"]>[number],
): { point: [number, number]; observedAt: string | null } | null {
  const geometries: EventGeometry[] = Array.isArray(event.geometry) ? event.geometry : [];
  for (let index = geometries.length - 1; index >= 0; index -= 1) {
    const geom = geometries[index];
    const point = geometryToPoint(geom);
    if (point) {
      return {
        point,
        observedAt: typeof geom.date === "string" ? geom.date : null,
      };
    }
  }
  return null;
}

function normalizeVolcanoEvents(payload: EventsApiResponse): GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>> {
  const events = Array.isArray(payload.events) ? payload.events : [];
  const features: GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>[] = [];

  for (const event of events) {
    const latest = pickLatestPoint(event);
    if (!latest) {
      continue;
    }

    const id = event.id ?? `${event.title ?? "volcano"}-${latest.observedAt ?? "unknown"}`;
    const sourceUrl = Array.isArray(event.sources) && event.sources[0]?.url ? event.sources[0].url : null;
    features.push({
      type: "Feature",
      id,
      properties: {
        id,
        title: event.title ?? "Active volcanic event",
        closed: event.closed ?? null,
        observedAt: latest.observedAt,
        sourceUrl,
      },
      geometry: {
        type: "Point",
        coordinates: latest.point,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

async function fetchVolcanoes(): Promise<GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>> {
  const openResponse = await fetch(EONET_VOLCANO_OPEN_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (openResponse.ok) {
    const openPayload = normalizeVolcanoEvents((await openResponse.json()) as EventsApiResponse);
    if (openPayload.features.length > 0) {
      return openPayload;
    }
  }

  const fallbackResponse = await fetch(EONET_VOLCANO_FALLBACK_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!fallbackResponse.ok) {
    throw new Error(`Volcano request failed (${fallbackResponse.status})`);
  }
  return normalizeVolcanoEvents((await fallbackResponse.json()) as EventsApiResponse);
}

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return NextResponse.json(
      {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: false,
      } satisfies VolcanoApiResponse,
      { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } },
    );
  }

  try {
    const data = await fetchVolcanoes();
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
      } satisfies VolcanoApiResponse,
      { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } },
    );
  } catch (error) {
    if (cache) {
      return NextResponse.json({
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown volcano feed error",
      } satisfies VolcanoApiResponse);
    }

    return NextResponse.json(
      {
        data: STATIC_FALLBACK,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown volcano feed error",
      } satisfies VolcanoApiResponse,
      { status: 200 },
    );
  }
}
