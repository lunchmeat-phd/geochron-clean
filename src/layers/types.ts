export type LayerKey =
  | "terminator"
  | "sunAnalemma"
  | "majorCities"
  | "countryProfiles"
  | "earthquakes"
  | "weatherRadar"
  | "airQuality"
  | "oilPipelines"
  | "fiberCables"
  | "militaryBases"
  | "issTracker"
  | "airTrafficCivilian"
  | "airTrafficMilitary"
  | "ships";

export type LayerToggleState = Record<LayerKey, boolean>;

export type RefreshTimes = Partial<Record<LayerKey | "airTraffic", string>>;
