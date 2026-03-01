import type { GeoJSONSource, Map } from "maplibre-gl";

type VolcanoApiResponse = {
  data: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;
  fetchedAt: string;
  stale: boolean;
  error?: string;
};

export const VOLCANO_SOURCE_ID = "volcano-source";
export const VOLCANO_LAYER_ID = "volcano-layer";

export function ensureVolcanoLayer(map: Map): void {
  if (!map.getSource(VOLCANO_SOURCE_ID)) {
    map.addSource(VOLCANO_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(VOLCANO_LAYER_ID)) {
    map.addLayer({
      id: VOLCANO_LAYER_ID,
      type: "circle",
      source: VOLCANO_SOURCE_ID,
      paint: {
        "circle-color": "#ef4444",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3, 4, 5.2, 7, 7.2],
        "circle-opacity": 0.85,
        "circle-stroke-color": "#7f1d1d",
        "circle-stroke-width": 1.2,
      },
    });
  }
}

export function setVolcanoVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(VOLCANO_LAYER_ID)) {
    map.setLayoutProperty(VOLCANO_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchVolcanoes(): Promise<VolcanoApiResponse> {
  const response = await fetch("/api/volcanoes", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch volcanoes (${response.status})`);
  }
  return (await response.json()) as VolcanoApiResponse;
}

export function updateVolcanoData(map: Map, collection: GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>): void {
  const source = map.getSource(VOLCANO_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}

