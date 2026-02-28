import { NextResponse } from "next/server";
import type { GeoLineCollection, InfrastructureApiResponse } from "@/lib/infrastructure";

const CABLES_URL =
  "https://servicesdev1.arcgis.com/5uh3wwYLNzBuU0Eu/ArcGIS/rest/services/Global_TeleComm/FeatureServer/1/query";
const PAGE_SIZE = 2000;
const MAX_PAGES = 16;
const TTL_MS = 6 * 60 * 60 * 1000;

type CacheRecord = {
  data: GeoLineCollection;
  fetchedAt: string;
  expiresAt: number;
};

type ArcGisGeoJson = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> & {
  properties?: {
    exceededTransferLimit?: boolean;
  };
};

let cache: CacheRecord | null = null;

const EMPTY_LINES: GeoLineCollection = {
  type: "FeatureCollection",
  features: [],
};

function toLineCollection(collection: ArcGisGeoJson): GeoLineCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.filter(
      (feature): feature is GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString, Record<string, unknown>> =>
        feature.geometry?.type === "LineString" || feature.geometry?.type === "MultiLineString",
    ),
  };
}

async function fetchCables(): Promise<GeoLineCollection> {
  const features: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString, Record<string, unknown>>[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      f: "geojson",
      outSR: "4326",
      returnGeometry: "true",
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(page * PAGE_SIZE),
    });

    const upstream = await fetch(`${CABLES_URL}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      throw new Error(`Fiber cable fetch failed (${upstream.status})`);
    }

    const data = (await upstream.json()) as ArcGisGeoJson;
    const lines = toLineCollection(data);
    features.push(...lines.features);

    if (!data.properties?.exceededTransferLimit || lines.features.length < PAGE_SIZE) {
      break;
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export async function GET() {
  const now = Date.now();

  if (cache && now < cache.expiresAt) {
    const payload: InfrastructureApiResponse = {
      data: cache.data,
      fetchedAt: cache.fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }

  try {
    const data = await fetchCables();
    const fetchedAt = new Date().toISOString();

    cache = {
      data,
      fetchedAt,
      expiresAt: now + TTL_MS,
    };

    const payload: InfrastructureApiResponse = {
      data,
      fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    if (cache) {
      const payload: InfrastructureApiResponse = {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown fiber cable fetch error",
      };

      return NextResponse.json(payload, { status: 200 });
    }

    const payload: InfrastructureApiResponse = {
      data: EMPTY_LINES,
      fetchedAt: new Date().toISOString(),
      stale: true,
      error: error instanceof Error ? error.message : "Unknown fiber cable fetch error",
    };

    return NextResponse.json(payload, { status: 200 });
  }
}
