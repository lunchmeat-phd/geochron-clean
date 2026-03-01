import type { GeoJSONSource, Map } from "maplibre-gl";

type TropicalStormApiResponse = {
  data: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

export const TROPICAL_SOURCE_ID = "tropical-storms-source";
export const TROPICAL_LAYER_ID = "tropical-storms-layer";

export function ensureTropicalStormLayer(map: Map): void {
  if (!map.getSource(TROPICAL_SOURCE_ID)) {
    map.addSource(TROPICAL_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(TROPICAL_LAYER_ID)) {
    map.addLayer({
      id: TROPICAL_LAYER_ID,
      type: "circle",
      source: TROPICAL_SOURCE_ID,
      paint: {
        "circle-color": [
          "case",
          [">=", ["coalesce", ["to-number", ["get", "windKt"]], 0], 100],
          "#dc2626",
          [">=", ["coalesce", ["to-number", ["get", "windKt"]], 0], 64],
          "#f97316",
          "#facc15",
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.2, 4, 5.8, 7, 8],
        "circle-opacity": 0.82,
        "circle-stroke-color": "#7c2d12",
        "circle-stroke-width": 1,
      },
    });
  }
}

export function setTropicalStormVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(TROPICAL_LAYER_ID)) {
    map.setLayoutProperty(TROPICAL_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchTropicalStorms(): Promise<TropicalStormApiResponse> {
  const response = await fetch("/api/tropical-storms", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch tropical storms (${response.status})`);
  }
  return (await response.json()) as TropicalStormApiResponse;
}

export function updateTropicalStormData(
  map: Map,
  collection: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>,
): void {
  const source = map.getSource(TROPICAL_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}

