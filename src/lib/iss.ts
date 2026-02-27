export type IssApiPayload = {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  timestamp: number;
};

export type IssOrbitPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export type IssTrackerResponse = {
  data: IssApiPayload;
  orbit: IssOrbitPoint[];
  fetchedAt: string;
  stale: boolean;
  error?: string;
};
