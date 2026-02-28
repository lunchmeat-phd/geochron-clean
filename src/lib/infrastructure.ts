export type GeoLineGeometry = GeoJSON.LineString | GeoJSON.MultiLineString;

export type GeoLineCollection = GeoJSON.FeatureCollection<GeoLineGeometry, Record<string, unknown>>;

export type InfrastructureApiResponse = {
  data: GeoLineCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};
