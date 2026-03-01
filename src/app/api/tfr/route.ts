import { NextResponse } from "next/server";

type TfrApiResponse = {
  data: GeoJSON.FeatureCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

type CacheRecord = {
  data: GeoJSON.FeatureCollection;
  fetchedAt: string;
  expiresAt: number;
};

const TFR_URL =
  "https://services1.arcgis.com/n4Ot9Qz0t5espY4s/arcgis/rest/services/FAA_TFRs/FeatureServer/0/query";
const NATIONAL_SECURITY_TFR_URL =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/DoD_Mar_13/FeatureServer/0/query";
const TTL_MS = 5 * 60_000;

let cache: CacheRecord | null = null;

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function normalizeTfrCollection(collection: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features = Array.isArray(collection.features) ? collection.features : [];
  return {
    type: "FeatureCollection",
    features: features.filter((feature) => {
      const type = feature.geometry?.type;
      return type === "Polygon" || type === "MultiPolygon" || type === "Point";
    }),
  };
}

export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return NextResponse.json(
      {
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: false,
      } satisfies TfrApiResponse,
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  }

  try {
    const commonQuery = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      f: "geojson",
      returnGeometry: "true",
      outSR: "4326",
    });

    const primaryRes = await fetch(`${TFR_URL}?${commonQuery.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    let data: GeoJSON.FeatureCollection = EMPTY;
    let fallbackReason: string | null = null;

    if (primaryRes.ok) {
      const primaryRaw = (await primaryRes.json()) as { error?: { message?: string } } & GeoJSON.FeatureCollection;
      if (primaryRaw.error) {
        fallbackReason = primaryRaw.error.message ?? "Primary FAA TFR source unavailable";
      } else {
        data = normalizeTfrCollection(primaryRaw);
        if (data.features.length === 0) {
          fallbackReason = "Primary FAA TFR source returned zero features";
        }
      }
    } else {
      fallbackReason = `Primary FAA TFR request failed (${primaryRes.status})`;
    }

    if (fallbackReason) {
      const fallbackQuery = new URLSearchParams({
        where: "1=1",
        outFields: "*",
        f: "geojson",
        returnGeometry: "true",
        outSR: "4326",
        resultRecordCount: "1000",
      });
      const fallbackRes = await fetch(`${NATIONAL_SECURITY_TFR_URL}?${fallbackQuery.toString()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (!fallbackRes.ok) {
        throw new Error(`${fallbackReason}; fallback failed (${fallbackRes.status})`);
      }

      const fallbackRaw = (await fallbackRes.json()) as { error?: { message?: string } } & GeoJSON.FeatureCollection;
      if (fallbackRaw.error) {
        throw new Error(`${fallbackReason}; fallback error: ${fallbackRaw.error.message ?? "Unknown error"}`);
      }
      data = normalizeTfrCollection(fallbackRaw);
    }

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
      } satisfies TfrApiResponse,
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (error) {
    if (cache) {
      return NextResponse.json({
        data: cache.data,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown TFR error",
      } satisfies TfrApiResponse);
    }

    return NextResponse.json(
      {
        data: EMPTY,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown TFR error",
      } satisfies TfrApiResponse,
      { status: 200 },
    );
  }
}
