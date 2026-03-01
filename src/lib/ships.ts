export type ShipPointProperties = {
  mmsi: number;
  name?: string;
  callSign?: string;
  imo?: string;
  destination?: string;
  shipType?: number;
  shipClass: string;
  speedKnots?: number;
  courseDeg?: number;
  draughtMeters?: number;
  ageMinutes?: number;
};

export type ShipsCollection = GeoJSON.FeatureCollection<GeoJSON.Point, ShipPointProperties>;

export type ShipsApiResponse = {
  data: ShipsCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
  source?: string;
};
