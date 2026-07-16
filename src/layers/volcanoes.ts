import type { GeoJSONSource, Map } from "maplibre-gl";
import { ICONS } from "@/layers/icons";

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
      type: "symbol",
      source: VOLCANO_SOURCE_ID,
      layout: {
        "icon-image": ICONS.volcano,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 4, 1.2, 7, 1.55],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
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

