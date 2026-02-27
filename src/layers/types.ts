export type LayerKey =
  | "terminator"
  | "sunAnalemma"
  | "earthquakes"
  | "weatherRadar"
  | "airQuality"
  | "issTracker"
  | "airTraffic"
  | "ships";

export type LayerToggleState = Record<LayerKey, boolean>;

export type RefreshTimes = Partial<Record<LayerKey, string>>;
