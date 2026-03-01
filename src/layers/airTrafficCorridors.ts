import type { Map } from "maplibre-gl";

export const AIR_CORRIDORS_SOURCE_ID = "air-corridors-source";
export const AIR_CORRIDORS_LAYER_ID = "air-corridors-layer";

function buildCorridors(): GeoJSON.FeatureCollection<GeoJSON.LineString, Record<string, unknown>> {
  const corridors: Array<{ name: string; coords: [number, number][] }> = [
    { name: "North Atlantic Track", coords: [[-74, 40.7], [-50, 48], [-25, 53], [0, 51]] },
    { name: "North Pacific Eastbound", coords: [[139.7, 35.7], [170, 47], [-150, 50], [-122.3, 47.6]] },
    { name: "North Pacific Westbound", coords: [[-118.4, 33.9], [-150, 42], [170, 42], [121, 31.2]] },
    { name: "Europe to Gulf", coords: [[2.35, 48.85], [20, 45], [40, 35], [55.3, 25.2]] },
    { name: "Trans-Siberian", coords: [[2.55, 49], [37.6, 55.8], [90, 58], [139.7, 35.7]] },
    { name: "South Atlantic", coords: [[-46.6, -23.5], [-25, -15], [-8.6, 41.1]] },
    { name: "Middle East to India", coords: [[55.3, 25.2], [66, 24], [77.1, 28.6]] },
    { name: "Australia to Southeast Asia", coords: [[151.2, -33.9], [130, -15], [103.9, 1.3]] },
    { name: "US East to South America", coords: [[-73.8, 40.6], [-66, 28], [-58.4, -34.6]] },
  ];

  return {
    type: "FeatureCollection",
    features: corridors.map((corridor, index) => ({
      type: "Feature",
      id: `corridor-${index}`,
      properties: {
        name: corridor.name,
      },
      geometry: {
        type: "LineString",
        coordinates: corridor.coords,
      },
    })),
  };
}

export function ensureAirTrafficCorridorsLayer(map: Map): void {
  if (!map.getSource(AIR_CORRIDORS_SOURCE_ID)) {
    map.addSource(AIR_CORRIDORS_SOURCE_ID, {
      type: "geojson",
      data: buildCorridors(),
    });
  }

  if (!map.getLayer(AIR_CORRIDORS_LAYER_ID)) {
    map.addLayer({
      id: AIR_CORRIDORS_LAYER_ID,
      type: "line",
      source: AIR_CORRIDORS_SOURCE_ID,
      paint: {
        "line-color": "#93c5fd",
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 4, 1.4, 7, 2.2],
        "line-opacity": 0.6,
        "line-dasharray": [1.6, 1.1],
      },
    });
  }
}

export function setAirTrafficCorridorsVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(AIR_CORRIDORS_LAYER_ID)) {
    map.setLayoutProperty(AIR_CORRIDORS_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

