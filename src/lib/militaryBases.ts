export type MilitaryBasePointProperties = {
  name: string;
  militaryType: string;
  source: "ntad" | "osm";
  american: boolean;
  country?: string;
  operator?: string;
};

export type MilitaryBasesCollection = GeoJSON.FeatureCollection<GeoJSON.Point, MilitaryBasePointProperties>;

export type MilitaryBasesApiResponse = {
  data: MilitaryBasesCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
  americanCount: number;
  nonAmericanCount: number;
};
