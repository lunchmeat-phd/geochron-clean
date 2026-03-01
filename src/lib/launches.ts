export type RocketLaunchProperties = {
  id: string;
  name: string;
  provider: string;
  rocket?: string;
  net: string;
  windowStart?: string;
  windowEnd?: string;
  status: string;
  locationName?: string;
  countryCode?: string;
};

export type RocketLaunchCollection = GeoJSON.FeatureCollection<GeoJSON.Point, RocketLaunchProperties>;

export type RocketLaunchApiResponse = {
  data: RocketLaunchCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};
