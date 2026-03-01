import type { GeoJSONSource, Map } from "maplibre-gl";

type TsunamiApiResponse = {
  data: GeoJSON.FeatureCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

export const TSUNAMI_SOURCE_ID = "tsunami-source";
export const TSUNAMI_FILL_LAYER_ID = "tsunami-fill-layer";
export const TSUNAMI_OUTLINE_LAYER_ID = "tsunami-outline-layer";
export const TSUNAMI_POINT_LAYER_ID = "tsunami-point-layer";

export function ensureTsunamiLayer(map: Map): void {
  if (!map.getSource(TSUNAMI_SOURCE_ID)) {
    map.addSource(TSUNAMI_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(TSUNAMI_FILL_LAYER_ID)) {
    map.addLayer({
      id: TSUNAMI_FILL_LAYER_ID,
      type: "fill",
      source: TSUNAMI_SOURCE_ID,
      filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
      paint: {
        "fill-color": "#7c3aed",
        "fill-opacity": 0.23,
      },
    });
  }

  if (!map.getLayer(TSUNAMI_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: TSUNAMI_OUTLINE_LAYER_ID,
      type: "line",
      source: TSUNAMI_SOURCE_ID,
      filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
      paint: {
        "line-color": "#5b21b6",
        "line-width": 1.3,
        "line-opacity": 0.85,
      },
    });
  }

  if (!map.getLayer(TSUNAMI_POINT_LAYER_ID)) {
    map.addLayer({
      id: TSUNAMI_POINT_LAYER_ID,
      type: "circle",
      source: TSUNAMI_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": "#8b5cf6",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.8, 7, 6.4],
        "circle-opacity": 0.8,
        "circle-stroke-color": "#4c1d95",
        "circle-stroke-width": 1.1,
      },
    });
  }
}

export function setTsunamiVisibility(map: Map, visible: boolean): void {
  const value = visible ? "visible" : "none";
  if (map.getLayer(TSUNAMI_FILL_LAYER_ID)) {
    map.setLayoutProperty(TSUNAMI_FILL_LAYER_ID, "visibility", value);
  }
  if (map.getLayer(TSUNAMI_OUTLINE_LAYER_ID)) {
    map.setLayoutProperty(TSUNAMI_OUTLINE_LAYER_ID, "visibility", value);
  }
  if (map.getLayer(TSUNAMI_POINT_LAYER_ID)) {
    map.setLayoutProperty(TSUNAMI_POINT_LAYER_ID, "visibility", value);
  }
}

export async function fetchTsunamiWarnings(): Promise<TsunamiApiResponse> {
  const response = await fetch("/api/tsunami", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch tsunami warnings (${response.status})`);
  }
  return (await response.json()) as TsunamiApiResponse;
}

export function updateTsunamiData(map: Map, collection: GeoJSON.FeatureCollection): void {
  const source = map.getSource(TSUNAMI_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}

