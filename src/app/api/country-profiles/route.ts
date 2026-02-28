import { NextRequest, NextResponse } from "next/server";
import type {
  CountryProfile,
  CountryProfileApiResponse,
  CountryProfilesApiResponse,
  CountryProfilesCollection,
} from "@/lib/countryProfiles";

const REST_COUNTRIES_URL =
  "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,capital,population,latlng,region,subregion";
const WORLD_BANK_GDP_URL =
  "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=20000";
const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const HEAD_TTL_MS = 6 * 60 * 60 * 1000;

type RestCountry = {
  name?: { common?: string };
  cca2?: string;
  cca3?: string;
  capital?: string[];
  population?: number;
  latlng?: number[];
  region?: string;
  subregion?: string;
};

type WorldBankRow = {
  countryiso3code?: string;
  date?: string;
  value?: number | null;
};

type WorldBankResponse = [unknown, WorldBankRow[]] | [];

type CacheRecord = {
  profiles: CountryProfile[];
  byIso2: Map<string, CountryProfile>;
  fetchedAt: string;
  expiresAt: number;
};

type HeadGovCacheRecord = {
  value: string | null;
  expiresAt: number;
};

let profileCache: CacheRecord | null = null;
const headGovCache = new Map<string, HeadGovCacheRecord>();

function formatIndustries(region?: string): string[] {
  const normalized = (region ?? "").toLowerCase();
  if (normalized.includes("europe")) {
    return ["Manufacturing", "Services", "Technology", "Logistics"];
  }
  if (normalized.includes("asia")) {
    return ["Manufacturing", "Technology", "Energy", "Trade"];
  }
  if (normalized.includes("africa")) {
    return ["Agriculture", "Mining", "Energy", "Services"];
  }
  if (normalized.includes("americas")) {
    return ["Services", "Manufacturing", "Energy", "Agriculture"];
  }
  if (normalized.includes("oceania")) {
    return ["Services", "Mining", "Agriculture", "Tourism"];
  }
  return ["Services", "Manufacturing", "Agriculture", "Energy"];
}

function toIso2(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.trim().toUpperCase();
}

function toFeatureCollection(profiles: CountryProfile[]): CountryProfilesCollection {
  return {
    type: "FeatureCollection",
    features: profiles.map((profile) => ({
      type: "Feature",
      id: profile.iso2,
      properties: {
        name: profile.name,
        iso2: profile.iso2,
        iso3: profile.iso3,
        population: profile.population,
        gdpUsd: profile.gdpUsd,
        capital: profile.capital,
        region: profile.region,
        subregion: profile.subregion,
        headOfGovernment: profile.headOfGovernment,
        majorIndustries: profile.majorIndustries,
      },
      geometry: {
        type: "Point",
        coordinates: [profile.lon, profile.lat],
      },
    })),
  };
}

function parseLatestGdp(rows: WorldBankRow[]): Map<string, number> {
  const latest = new Map<string, { year: number; value: number }>();

  for (const row of rows) {
    const iso3 = typeof row.countryiso3code === "string" ? row.countryiso3code.trim().toUpperCase() : "";
    const value = row.value;
    const year = Number(row.date);

    if (!iso3 || !Number.isFinite(year) || typeof value !== "number") {
      continue;
    }

    const current = latest.get(iso3);
    if (!current || year > current.year) {
      latest.set(iso3, { year, value });
    }
  }

  const out = new Map<string, number>();
  for (const [iso3, entry] of latest.entries()) {
    out.set(iso3, entry.value);
  }
  return out;
}

async function fetchHeadOfGovernment(iso2: string): Promise<string | null> {
  const cached = headGovCache.get(iso2);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return cached.value;
  }

  try {
    const query = `SELECT ?headLabel WHERE {\n  ?country wdt:P297 \"${iso2}\".\n  OPTIONAL { ?country wdt:P6 ?head. }\n  SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". }\n}`;

    const response = await fetch(WIKIDATA_SPARQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        Accept: "application/sparql-results+json",
      },
      body: query,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      throw new Error(`Wikidata request failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      results?: { bindings?: Array<{ headLabel?: { value?: string } }> };
    };

    const bindings = payload.results?.bindings ?? [];
    const name = bindings[0]?.headLabel?.value?.trim() || null;
    headGovCache.set(iso2, { value: name, expiresAt: now + HEAD_TTL_MS });
    return name;
  } catch {
    headGovCache.set(iso2, { value: null, expiresAt: now + 30 * 60 * 1000 });
    return null;
  }
}

async function fetchProfiles(): Promise<CacheRecord> {
  const now = Date.now();
  if (profileCache && now < profileCache.expiresAt) {
    return profileCache;
  }

  const [countriesRes, gdpRes] = await Promise.all([
    fetch(REST_COUNTRIES_URL, { cache: "no-store", signal: AbortSignal.timeout(10000) }),
    fetch(WORLD_BANK_GDP_URL, { cache: "no-store", signal: AbortSignal.timeout(12000) }),
  ]);

  if (!countriesRes.ok) {
    throw new Error(`Country metadata fetch failed (${countriesRes.status})`);
  }
  if (!gdpRes.ok) {
    throw new Error(`World Bank GDP fetch failed (${gdpRes.status})`);
  }

  const countries = (await countriesRes.json()) as RestCountry[];
  const gdpPayload = (await gdpRes.json()) as WorldBankResponse;
  const gdpRows = Array.isArray(gdpPayload) && Array.isArray(gdpPayload[1]) ? gdpPayload[1] : [];
  const gdpByIso3 = parseLatestGdp(gdpRows);

  const profiles = countries
    .map((country) => {
      const iso2 = typeof country.cca2 === "string" ? country.cca2.trim().toUpperCase() : "";
      const iso3 = typeof country.cca3 === "string" ? country.cca3.trim().toUpperCase() : "";
      const name = country.name?.common?.trim() ?? "";
      const latlng = Array.isArray(country.latlng) ? country.latlng : [];
      const lat = typeof latlng[0] === "number" ? latlng[0] : NaN;
      const lon = typeof latlng[1] === "number" ? latlng[1] : NaN;

      if (!iso2 || !iso3 || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      return {
        name,
        iso2,
        iso3,
        population: typeof country.population === "number" ? country.population : undefined,
        gdpUsd: gdpByIso3.get(iso3),
        capital: Array.isArray(country.capital) ? country.capital[0] : undefined,
        region: country.region,
        subregion: country.subregion,
        majorIndustries: formatIndustries(country.region),
        lat,
        lon,
      } satisfies CountryProfile;
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const byIso2 = new Map<string, CountryProfile>();
  for (const profile of profiles) {
    byIso2.set(profile.iso2, profile);
  }

  const fetchedAt = new Date().toISOString();
  profileCache = {
    profiles,
    byIso2,
    fetchedAt,
    expiresAt: now + PROFILE_TTL_MS,
  };

  return profileCache;
}

export async function GET(request: NextRequest) {
  const iso2 = toIso2(request.nextUrl.searchParams.get("iso2"));

  try {
    const cache = await fetchProfiles();

    if (iso2) {
      const profile = cache.byIso2.get(iso2) ?? null;
      if (!profile) {
        const payload: CountryProfileApiResponse = {
          profile: null,
          fetchedAt: cache.fetchedAt,
          stale: false,
        };
        return NextResponse.json(payload);
      }

      const headOfGovernment = await fetchHeadOfGovernment(iso2);
      const payload: CountryProfileApiResponse = {
        profile: {
          ...profile,
          headOfGovernment: headOfGovernment ?? undefined,
        },
        fetchedAt: cache.fetchedAt,
        stale: false,
      };

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    const payload: CountryProfilesApiResponse = {
      data: toFeatureCollection(cache.profiles),
      fetchedAt: cache.fetchedAt,
      stale: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    if (profileCache) {
      if (iso2) {
        const profile = profileCache.byIso2.get(iso2) ?? null;
        const payload: CountryProfileApiResponse = {
          profile,
          fetchedAt: profileCache.fetchedAt,
          stale: true,
          error: error instanceof Error ? error.message : "Unknown country profile fetch error",
        };
        return NextResponse.json(payload, { status: 200 });
      }

      const payload: CountryProfilesApiResponse = {
        data: toFeatureCollection(profileCache.profiles),
        fetchedAt: profileCache.fetchedAt,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown country profile fetch error",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    if (iso2) {
      const payload: CountryProfileApiResponse = {
        profile: null,
        fetchedAt: new Date().toISOString(),
        stale: true,
        error: error instanceof Error ? error.message : "Unknown country profile fetch error",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const payload: CountryProfilesApiResponse = {
      data: {
        type: "FeatureCollection",
        features: [],
      },
      fetchedAt: new Date().toISOString(),
      stale: true,
      error: error instanceof Error ? error.message : "Unknown country profile fetch error",
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
