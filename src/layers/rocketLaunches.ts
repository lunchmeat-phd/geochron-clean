import maplibregl, { type GeoJSONSource, type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { RocketLaunchApiResponse, RocketLaunchCollection } from "@/lib/launches";
import { ICONS } from "@/layers/icons";

export const ROCKET_LAUNCHES_SOURCE_ID = "rocket-launches-source";
export const ROCKET_LAUNCHES_LAYER_ID = "rocket-launches-layer";

function formatLaunchPopup(feature: GeoJSON.Feature): string {
  const props = feature.properties as Record<string, unknown>;
  const name = typeof props.name === "string" ? props.name : "Unnamed launch";
  const provider = typeof props.provider === "string" ? props.provider : "Unknown provider";
  const rocket = typeof props.rocket === "string" ? props.rocket : "Unknown rocket";
  const net = typeof props.net === "string" ? props.net : "Unknown";
  const status = typeof props.status === "string" ? props.status : "Unknown";
  const location = typeof props.locationName === "string" ? props.locationName : "Unknown location";
  const country = typeof props.countryCode === "string" ? props.countryCode : "";
  const netDate = new Date(net);
  const launchUtc = Number.isNaN(netDate.getTime()) ? "Unknown" : netDate.toISOString();
  const launchLocal = Number.isNaN(netDate.getTime()) ? "Unknown" : netDate.toLocaleString();

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a;">
      <strong>${name}</strong><br/>
      Provider: ${provider}<br/>
      Rocket: ${rocket}<br/>
      Launch (UTC): ${launchUtc}<br/>
      Launch (Local): ${launchLocal}<br/>
      Status: ${status}<br/>
      Site: ${location}${country ? ` (${country})` : ""}
    </div>
  `;
}

export function ensureRocketLaunchesLayer(map: Map): void {
  if (!map.getSource(ROCKET_LAUNCHES_SOURCE_ID)) {
    map.addSource(ROCKET_LAUNCHES_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(ROCKET_LAUNCHES_LAYER_ID)) {
    map.addLayer({
      id: ROCKET_LAUNCHES_LAYER_ID,
      type: "symbol",
      source: ROCKET_LAUNCHES_SOURCE_ID,
      layout: {
        "icon-image": [
          "match",
          ["coalesce", ["get", "provider"], ""],
          "SpaceX",
          ICONS.rocketSpacex,
          "Rocket Lab",
          ICONS.rocketLab,
          "United Launch Alliance",
          ICONS.rocketUla,
          "ULA",
          ICONS.rocketUla,
          ICONS.rocketDefault,
        ],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 1.02, 4, 0.82, 7, 0.64],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }
}

export function setRocketLaunchesVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(ROCKET_LAUNCHES_LAYER_ID)) {
    map.setLayoutProperty(ROCKET_LAUNCHES_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchRocketLaunches(): Promise<RocketLaunchApiResponse> {
  const response = await fetch("/api/launches", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch launch data (${response.status})`);
  }
  return (await response.json()) as RocketLaunchApiResponse;
}

export function updateRocketLaunchesData(map: Map, collection: RocketLaunchCollection): void {
  const source = map.getSource(ROCKET_LAUNCHES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}

export function attachRocketLaunchesHoverTooltip(map: Map): () => void {
  const popupRef: { current: Popup | null } = { current: null };

  const onMove = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }

    map.getCanvas().style.cursor = "pointer";
    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    }
    popupRef.current.setLngLat(event.lngLat).setHTML(formatLaunchPopup(feature)).addTo(map);
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  };

  map.on("mousemove", ROCKET_LAUNCHES_LAYER_ID, onMove);
  map.on("mouseleave", ROCKET_LAUNCHES_LAYER_ID, onLeave);

  return () => {
    map.off("mousemove", ROCKET_LAUNCHES_LAYER_ID, onMove);
    map.off("mouseleave", ROCKET_LAUNCHES_LAYER_ID, onLeave);
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    map.getCanvas().style.cursor = "";
  };
}
