import type { FeatureCollection, Point } from "geojson";
import maplibregl, { type GeoJSONSource, type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { AdsbFlight, FlightsApiResponse } from "@/lib/flights";
import { isMilitaryAircraftModel } from "@/lib/military";
import { ICONS } from "@/layers/icons";

export const AIR_TRAFFIC_SOURCE_ID = "air-traffic-source";
export const AIR_TRAFFIC_LAYER_ID = "air-traffic-layer";
export const AIR_TRAFFIC_MIL_LAYER_ID = "air-traffic-military-layer";

function radiusByZoom(zoom: number): number {
  if (zoom < 4) {
    return 1800;
  }
  if (zoom < 5) {
    return 1500;
  }
  if (zoom < 6) {
    return 1000;
  }
  if (zoom < 7) {
    return 700;
  }
  return 450;
}

function toGeoJson(flights: AdsbFlight[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: flights.map((flight) => ({
      type: "Feature",
      properties: {
        hex: flight.hex,
        callsign: flight.flight || flight.r || flight.hex,
        model: flight.t || "unknown",
        altitude: typeof flight.alt_baro === "number" ? flight.alt_baro : null,
        speed: typeof flight.gs === "number" ? flight.gs : null,
        heading: typeof flight.track === "number" ? flight.track : null,
        military: isMilitaryAircraftModel(flight.t),
      },
      geometry: {
        type: "Point",
        coordinates: [flight.lon, flight.lat],
      },
    })),
  };
}

export function ensureAirTrafficLayer(map: Map): void {
  if (!map.getSource(AIR_TRAFFIC_SOURCE_ID)) {
    map.addSource(AIR_TRAFFIC_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(AIR_TRAFFIC_LAYER_ID)) {
    map.addLayer({
      id: AIR_TRAFFIC_LAYER_ID,
      type: "symbol",
      source: AIR_TRAFFIC_SOURCE_ID,
      minzoom: 4,
      filter: ["==", ["get", "military"], false],
      layout: {
        "icon-image": ICONS.aircraftCivilian,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.9, 6, 0.72, 8, 0.56],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotate": ["coalesce", ["get", "heading"], 0],
        "icon-rotation-alignment": "map",
      },
    });
  }

  if (!map.getLayer(AIR_TRAFFIC_MIL_LAYER_ID)) {
    map.addLayer({
      id: AIR_TRAFFIC_MIL_LAYER_ID,
      type: "symbol",
      source: AIR_TRAFFIC_SOURCE_ID,
      filter: ["==", ["get", "military"], true],
      layout: {
        "icon-image": ICONS.aircraftMilitary,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 1.05, 4, 0.86, 8, 0.68],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotate": ["coalesce", ["get", "heading"], 0],
        "icon-rotation-alignment": "map",
      },
    });
  }
}

export function setAirTrafficVisibility(map: Map, visible: boolean): void {
  if (!map || typeof (map as unknown as { getLayer?: unknown }).getLayer !== "function") {
    return;
  }
  setCivilianAirTrafficVisibility(map, visible);
  setMilitaryAirTrafficVisibility(map, visible);
}

export function setCivilianAirTrafficVisibility(map: Map, visible: boolean): void {
  if (!map || typeof (map as unknown as { getLayer?: unknown }).getLayer !== "function") {
    return;
  }
  try {
    const visibility = visible ? "visible" : "none";
    if (map.getLayer(AIR_TRAFFIC_LAYER_ID)) {
      map.setLayoutProperty(AIR_TRAFFIC_LAYER_ID, "visibility", visibility);
    }
  } catch {
    // Ignore layer visibility changes during map/style teardown.
  }
}

export function setMilitaryAirTrafficVisibility(map: Map, visible: boolean): void {
  if (!map || typeof (map as unknown as { getLayer?: unknown }).getLayer !== "function") {
    return;
  }
  try {
    const visibility = visible ? "visible" : "none";
    if (map.getLayer(AIR_TRAFFIC_MIL_LAYER_ID)) {
      map.setLayoutProperty(AIR_TRAFFIC_MIL_LAYER_ID, "visibility", visibility);
    }
  } catch {
    // Ignore layer visibility changes during map/style teardown.
  }
}

function formatAlt(altitude: unknown): string {
  if (typeof altitude === "number") {
    return `${Math.round(altitude).toLocaleString()} ft`;
  }
  return "Unknown";
}

function formatKts(speed: unknown): string {
  if (typeof speed === "number") {
    return `${Math.round(speed)} kt`;
  }
  return "Unknown";
}

function formatHeading(heading: unknown): string {
  if (typeof heading === "number") {
    return `${Math.round(heading)}°`;
  }
  return "Unknown";
}

function formatAircraftPopup(feature: GeoJSON.Feature): string {
  const props = feature.properties as Record<string, unknown>;
  const callsign = typeof props.callsign === "string" ? props.callsign : "Unknown";
  const model = typeof props.model === "string" ? props.model : "Unknown";
  const hex = typeof props.hex === "string" ? props.hex.toUpperCase() : "Unknown";
  const military = props.military === true ? "Yes" : "No";

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a;">
      <strong>${callsign}</strong><br/>
      Model: ${model}<br/>
      Altitude: ${formatAlt(props.altitude)}<br/>
      Speed: ${formatKts(props.speed)}<br/>
      Heading: ${formatHeading(props.heading)}<br/>
      Military: ${military}<br/>
      ICAO: ${hex}
    </div>
  `;
}

function attachHoverForLayer(map: Map, layerId: string, popupRef: { current: Popup | null }): (() => void)[] {
  const onMove = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }

    map.getCanvas().style.cursor = "pointer";

    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    }

    popupRef.current.setLngLat(event.lngLat).setHTML(formatAircraftPopup(feature)).addTo(map);
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  };

  map.on("mousemove", layerId, onMove);
  map.on("mouseleave", layerId, onLeave);

  return [
    () => map.off("mousemove", layerId, onMove),
    () => map.off("mouseleave", layerId, onLeave),
  ];
}

export function attachAirTrafficHoverTooltip(map: Map): () => void {
  const popupRef: { current: Popup | null } = { current: null };
  const cleanups: (() => void)[] = [];

  cleanups.push(...attachHoverForLayer(map, AIR_TRAFFIC_LAYER_ID, popupRef));
  cleanups.push(...attachHoverForLayer(map, AIR_TRAFFIC_MIL_LAYER_ID, popupRef));

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    map.getCanvas().style.cursor = "";
  };
}

export async function fetchAirTraffic(map: Map, opts?: { militaryOnly?: boolean }): Promise<FlightsApiResponse> {
  const zoom = map.getZoom();

  const center = map.getCenter();
  const radiusKm = radiusByZoom(zoom);
  const militaryOnly = opts?.militaryOnly ? "&militaryOnly=1" : "";
  const url = `/api/flights?lat=${center.lat.toFixed(4)}&lon=${center.lng.toFixed(4)}&radiusKm=${radiusKm}&zoom=${zoom.toFixed(2)}${militaryOnly}`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch air traffic (${response.status})`);
  }

  return (await response.json()) as FlightsApiResponse;
}

export function updateAirTrafficData(map: Map, flights: AdsbFlight[]): void {
  const source = map.getSource(AIR_TRAFFIC_SOURCE_ID) as GeoJSONSource | undefined;

  if (!source) {
    return;
  }

  source.setData(toGeoJson(flights));
}
