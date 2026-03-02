export type AdsbFlight = {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  squawk?: string;
  lat: number;
  lon: number;
  alt_baro?: number | string;
  gs?: number;
  track?: number;
  category?: string;
};

export type FlightsApiResponse = {
  flights: AdsbFlight[];
  fetchedAt: string;
  stale: boolean;
  error?: string;
  filteredFrom?: number;
};
