export type CountryProfile = {
  name: string;
  iso2: string;
  iso3: string;
  population?: number;
  gdpUsd?: number;
  capital?: string;
  region?: string;
  subregion?: string;
  headOfGovernment?: string;
  majorIndustries?: string[];
  lat: number;
  lon: number;
};

export type CountryProfilesCollection = GeoJSON.FeatureCollection<GeoJSON.Point, Omit<CountryProfile, "lat" | "lon">>;

export type CountryProfilesApiResponse = {
  data: CountryProfilesCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

export type CountryProfileApiResponse = {
  profile: CountryProfile | null;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};
