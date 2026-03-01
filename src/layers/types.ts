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
  | "rocketLaunches"
  | "carrierStrikeGroups"
  | "airTrafficCivilian"
  | "airTrafficMilitary";

export type LayerToggleState = Record<LayerKey, boolean>;

export type RefreshTimes = Partial<Record<LayerKey | "airTraffic", string>>;
