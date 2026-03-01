import maplibregl, { type GeoJSONSource, type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { EarthquakesApiResponse, UsgsEarthquakeCollection } from "@/lib/earthquakes";
import { ICONS } from "@/layers/icons";

export const EARTHQUAKE_SOURCE_ID = "earthquakes-source";
export const EARTHQUAKE_LAYER_ID = "earthquakes-layer";

function formatEarthquakePopup(feature: GeoJSON.Feature): string {
  const props = feature.properties as Record<string, unknown>;
  const coords = (feature.geometry as GeoJSON.Point).coordinates;
  const mag = typeof props.mag === "number" ? props.mag.toFixed(1) : "N/A";
  const place = typeof props.place === "string" ? props.place : "Unknown";
  const time = typeof props.time === "number" ? new Date(props.time).toISOString() : "Unknown";
  const depth = typeof coords[2] === "number" ? `${coords[2].toFixed(1)} km` : "Unknown";

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a;">
      <strong>${place}</strong><br/>
      Magnitude: ${mag}<br/>
      Time (UTC): ${time}<br/>
      Depth: ${depth}
    </div>
  `;
}

export function ensureEarthquakeLayer(map: Map): void {
  if (!map.getSource(EARTHQUAKE_SOURCE_ID)) {
    map.addSource(EARTHQUAKE_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(EARTHQUAKE_LAYER_ID)) {
    map.addLayer({
      id: EARTHQUAKE_LAYER_ID,
      type: "symbol",
      source: EARTHQUAKE_SOURCE_ID,
      layout: {
        "icon-image": ICONS.earthquake,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-size": [
          "*",
          ["interpolate", ["linear"], ["zoom"], 1, 1.2, 4, 0.95, 7, 0.72],
          ["interpolate", ["linear"], ["coalesce", ["get", "mag"], 0], 0, 0.45, 2, 0.65, 4, 0.95, 7, 1.25],
        ],
      },
    });
  }
}

export function setEarthquakesVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(EARTHQUAKE_LAYER_ID)) {
    map.setLayoutProperty(EARTHQUAKE_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export function attachEarthquakeHoverTooltip(map: Map): () => void {
  let popup: Popup | null = null;

  const onMove = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];

    if (!feature) {
      if (popup) {
        popup.remove();
        popup = null;
      }
      map.getCanvas().style.cursor = "";
      return;
    }

    map.getCanvas().style.cursor = "pointer";

    if (!popup) {
      popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    }

    popup
      .setLngLat(event.lngLat)
      .setHTML(formatEarthquakePopup(feature))
      .addTo(map);
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    if (popup) {
      popup.remove();
      popup = null;
    }
  };

  map.on("mousemove", EARTHQUAKE_LAYER_ID, onMove);
  map.on("mouseleave", EARTHQUAKE_LAYER_ID, onLeave);

  return () => {
    map.off("mousemove", EARTHQUAKE_LAYER_ID, onMove);
    map.off("mouseleave", EARTHQUAKE_LAYER_ID, onLeave);
    if (popup) {
      popup.remove();
      popup = null;
    }
  };
}

export async function fetchEarthquakes(): Promise<EarthquakesApiResponse> {
  const response = await fetch("/api/earthquakes", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch earthquakes: ${response.status}`);
  }

  return (await response.json()) as EarthquakesApiResponse;
}

export function setEarthquakeData(map: Map, collection: UsgsEarthquakeCollection): void {
  const source = map.getSource(EARTHQUAKE_SOURCE_ID) as GeoJSONSource | undefined;

  if (!source) {
    return;
  }

  source.setData(collection);
}
