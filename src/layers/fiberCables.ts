import type { GeoJSONSource, Map } from "maplibre-gl";
import type { InfrastructureApiResponse } from "@/lib/infrastructure";

export const FIBER_CABLES_SOURCE_ID = "fiber-cables-source";
export const FIBER_CABLES_LAYER_ID = "fiber-cables-layer";

export function ensureFiberCablesLayer(map: Map): void {
  if (!map.getSource(FIBER_CABLES_SOURCE_ID)) {
    map.addSource(FIBER_CABLES_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(FIBER_CABLES_LAYER_ID)) {
    map.addLayer({
      id: FIBER_CABLES_LAYER_ID,
      type: "line",
      source: FIBER_CABLES_SOURCE_ID,
      paint: {
        "line-color": "#22d3ee",
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 4, 1.9, 7, 2.8],
        "line-opacity": 0.92,
        "line-blur": 0.12,
      },
    });
  }
}

export function setFiberCablesVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(FIBER_CABLES_LAYER_ID)) {
    map.setLayoutProperty(FIBER_CABLES_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchFiberCables(): Promise<InfrastructureApiResponse> {
  const response = await fetch("/api/fiber-cables", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch fiber cable data (${response.status})`);
  }

  return (await response.json()) as InfrastructureApiResponse;
}

export function updateFiberCablesData(map: Map, collection: GeoJSON.FeatureCollection): void {
  const source = map.getSource(FIBER_CABLES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }

  source.setData(collection);
}
