import type { GeoJSONSource, Map } from "maplibre-gl";
import type { InfrastructureApiResponse } from "@/lib/infrastructure";

export const SHIPPING_LANES_SOURCE_ID = "shipping-lanes-source";
export const SHIPPING_LANES_LAYER_ID = "shipping-lanes-layer";

export function ensureShippingLanesLayer(map: Map): void {
  if (!map.getSource(SHIPPING_LANES_SOURCE_ID)) {
    map.addSource(SHIPPING_LANES_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(SHIPPING_LANES_LAYER_ID)) {
    map.addLayer({
      id: SHIPPING_LANES_LAYER_ID,
      type: "line",
      source: SHIPPING_LANES_SOURCE_ID,
      paint: {
        "line-color": "#f59e0b",
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 4, 1.5, 7, 2.6],
        "line-opacity": 0.72,
      },
    });
  }
}

export function setShippingLanesVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(SHIPPING_LANES_LAYER_ID)) {
    map.setLayoutProperty(SHIPPING_LANES_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchShippingLanes(): Promise<InfrastructureApiResponse> {
  const response = await fetch("/api/shipping-lanes", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch shipping lanes (${response.status})`);
  }
  return (await response.json()) as InfrastructureApiResponse;
}

export function updateShippingLanesData(map: Map, collection: GeoJSON.FeatureCollection): void {
  const source = map.getSource(SHIPPING_LANES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}
