import type { GeoJSONSource, Map } from "maplibre-gl";
import { createNightTerminatorGeoJson } from "@/lib/terminator";

export const TERMINATOR_SOURCE_ID = "terminator-source";
export const TERMINATOR_LAYER_ID = "terminator-layer";

export function ensureTerminatorLayer(map: Map): void {
  if (!map.getSource(TERMINATOR_SOURCE_ID)) {
    map.addSource(TERMINATOR_SOURCE_ID, {
      type: "geojson",
      data: createNightTerminatorGeoJson(),
    });
  }

  if (!map.getLayer(TERMINATOR_LAYER_ID)) {
    map.addLayer({
      id: TERMINATOR_LAYER_ID,
      type: "fill",
      source: TERMINATOR_SOURCE_ID,
      paint: {
        "fill-color": "#0f172a",
        "fill-opacity": 0.35,
      },
    });
  }
}

export function updateTerminator(map: Map): string {
  const source = map.getSource(TERMINATOR_SOURCE_ID) as GeoJSONSource | undefined;
  const updatedAt = new Date();

  if (!source) {
    return updatedAt.toISOString();
  }

  source.setData(createNightTerminatorGeoJson(updatedAt));
  return updatedAt.toISOString();
}

export function setTerminatorVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(TERMINATOR_LAYER_ID)) {
    map.setLayoutProperty(TERMINATOR_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}
