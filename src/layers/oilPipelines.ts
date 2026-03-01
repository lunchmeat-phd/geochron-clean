import type { GeoJSONSource, Map } from "maplibre-gl";
import type { InfrastructureApiResponse } from "@/lib/infrastructure";

export const OIL_PIPELINES_SOURCE_ID = "oil-pipelines-source";
export const OIL_PIPELINES_LAYER_ID = "oil-pipelines-layer";

export function ensureOilPipelinesLayer(map: Map): void {
  if (!map.getSource(OIL_PIPELINES_SOURCE_ID)) {
    map.addSource(OIL_PIPELINES_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(OIL_PIPELINES_LAYER_ID)) {
    map.addLayer({
      id: OIL_PIPELINES_LAYER_ID,
      type: "line",
      source: OIL_PIPELINES_SOURCE_ID,
      paint: {
        "line-color": "#f59e0b",
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.9, 4, 3, 7, 4.2],
        "line-opacity": 0.96,
        "line-blur": 0.25,
      },
    });
  }
}

export function setOilPipelinesVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(OIL_PIPELINES_LAYER_ID)) {
    map.setLayoutProperty(OIL_PIPELINES_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchOilPipelines(map: Map): Promise<InfrastructureApiResponse> {
  const zoom = map.getZoom();
  const bounds = map.getBounds();
  const query = new URLSearchParams({
    zoom: zoom.toFixed(2),
    minLon: bounds.getWest().toFixed(5),
    minLat: bounds.getSouth().toFixed(5),
    maxLon: bounds.getEast().toFixed(5),
    maxLat: bounds.getNorth().toFixed(5),
  });
  const response = await fetch(`/api/pipelines?${query.toString()}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch pipeline data (${response.status})`);
  }

  return (await response.json()) as InfrastructureApiResponse;
}

export function updateOilPipelinesData(map: Map, collection: GeoJSON.FeatureCollection): void {
  const source = map.getSource(OIL_PIPELINES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }

  source.setData(collection);
}
