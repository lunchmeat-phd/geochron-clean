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

// Lightweight shape for the prominent upcoming-launches side panel (not tied to the map layer).
export type UpcomingLaunch = {
  id: string;
  name: string;
  provider: string;
  rocket?: string;
  net: string;
  locationName?: string;
  countryCode?: string;
  status: string;
  statusAbbrev?: string;
};

export type UpcomingLaunchesApiResponse = {
  launches: UpcomingLaunch[];
  fetchedAt: string;
  stale: boolean;
  error?: string;
};
