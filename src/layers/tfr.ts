import type { GeoJSONSource, Map } from "maplibre-gl";

type TfrApiResponse = {
  data: GeoJSON.FeatureCollection;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

export const TFR_SOURCE_ID = "tfr-source";
export const TFR_FILL_LAYER_ID = "tfr-fill-layer";
export const TFR_OUTLINE_LAYER_ID = "tfr-outline-layer";
export const TFR_POINT_LAYER_ID = "tfr-point-layer";

export function ensureTfrLayer(map: Map): void {
  if (!map.getSource(TFR_SOURCE_ID)) {
    map.addSource(TFR_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(TFR_FILL_LAYER_ID)) {
    map.addLayer({
      id: TFR_FILL_LAYER_ID,
      type: "fill",
      source: TFR_SOURCE_ID,
      filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
      paint: {
        "fill-color": "#f97316",
        "fill-opacity": 0.2,
      },
    });
  }

  if (!map.getLayer(TFR_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: TFR_OUTLINE_LAYER_ID,
      type: "line",
      source: TFR_SOURCE_ID,
      filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
      paint: {
        "line-color": "#ea580c",
        "line-width": 1.2,
        "line-opacity": 0.85,
      },
    });
  }

  if (!map.getLayer(TFR_POINT_LAYER_ID)) {
    map.addLayer({
      id: TFR_POINT_LAYER_ID,
      type: "circle",
      source: TFR_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": "#fb923c",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.5, 7, 6],
        "circle-opacity": 0.75,
        "circle-stroke-color": "#7c2d12",
        "circle-stroke-width": 1,
      },
    });
  }
}

export function setTfrVisibility(map: Map, visible: boolean): void {
  const value = visible ? "visible" : "none";
  if (map.getLayer(TFR_FILL_LAYER_ID)) {
    map.setLayoutProperty(TFR_FILL_LAYER_ID, "visibility", value);
  }
  if (map.getLayer(TFR_OUTLINE_LAYER_ID)) {
    map.setLayoutProperty(TFR_OUTLINE_LAYER_ID, "visibility", value);
  }
  if (map.getLayer(TFR_POINT_LAYER_ID)) {
    map.setLayoutProperty(TFR_POINT_LAYER_ID, "visibility", value);
  }
}

export async function fetchTfr(): Promise<TfrApiResponse> {
  const response = await fetch("/api/tfr", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch TFR data (${response.status})`);
  }
  return (await response.json()) as TfrApiResponse;
}

export function updateTfrData(map: Map, collection: GeoJSON.FeatureCollection): void {
  const source = map.getSource(TFR_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}

