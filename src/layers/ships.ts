import maplibregl, { type GeoJSONSource, type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { ShipsApiResponse, ShipsCollection } from "@/lib/ships";

export const SHIPS_SOURCE_ID = "ships-source";
export const SHIPS_LAYER_ID = "ships-layer";

function colorByShipClass(shipClass: unknown): string {
  switch (shipClass) {
    case "Cargo":
      return "#f59e0b";
    case "Tanker":
      return "#ef4444";
    case "Passenger":
      return "#22c55e";
    case "Service Vessel":
      return "#3b82f6";
    case "High-Speed Craft":
      return "#a855f7";
    default:
      return "#cbd5e1";
  }
}

function formatMaybe(value: unknown, suffix = ""): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}${suffix}`;
  }
  if (typeof value === "string" && value.trim()) {
    return `${value}${suffix}`;
  }
  return "Unknown";
}

function formatShipPopup(feature: GeoJSON.Feature): string {
  const props = feature.properties as Record<string, unknown>;
  const name = typeof props.name === "string" ? props.name : "Unnamed";
  const shipClass = typeof props.shipClass === "string" ? props.shipClass : "Unknown";
  const destination = typeof props.destination === "string" ? props.destination : "Unknown";

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a;">
      <strong>${name}</strong><br/>
      Class: ${shipClass}<br/>
      MMSI: ${formatMaybe(props.mmsi)}<br/>
      IMO: ${formatMaybe(props.imo)}<br/>
      Call Sign: ${formatMaybe(props.callSign)}<br/>
      Speed: ${formatMaybe(props.speedKnots, " kn")}<br/>
      Course: ${formatMaybe(props.courseDeg, "°")}<br/>
      Draught: ${formatMaybe(props.draughtMeters, " m")}<br/>
      Destination: ${destination}<br/>
      AIS age: ${formatMaybe(props.ageMinutes, " min")}
    </div>
  `;
}

export function ensureShipsLayer(map: Map): void {
  if (!map.getSource(SHIPS_SOURCE_ID)) {
    map.addSource(SHIPS_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(SHIPS_LAYER_ID)) {
    map.addLayer({
      id: SHIPS_LAYER_ID,
      type: "circle",
      source: SHIPS_SOURCE_ID,
      paint: {
        "circle-color": [
          "case",
          ["==", ["get", "shipClass"], "Cargo"],
          colorByShipClass("Cargo"),
          ["==", ["get", "shipClass"], "Tanker"],
          colorByShipClass("Tanker"),
          ["==", ["get", "shipClass"], "Passenger"],
          colorByShipClass("Passenger"),
          ["==", ["get", "shipClass"], "Service Vessel"],
          colorByShipClass("Service Vessel"),
          ["==", ["get", "shipClass"], "High-Speed Craft"],
          colorByShipClass("High-Speed Craft"),
          colorByShipClass("Unknown"),
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 4, 3.2, 7, 5],
        "circle-opacity": 0.88,
        "circle-stroke-color": "#111827",
        "circle-stroke-width": 0.9,
      },
    });
  }
}

export function setShipsVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(SHIPS_LAYER_ID)) {
    map.setLayoutProperty(SHIPS_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchShips(map: Map): Promise<ShipsApiResponse> {
  const zoom = map.getZoom();
  const bounds = map.getBounds();
  const query = new URLSearchParams({
    zoom: zoom.toFixed(2),
    minLon: bounds.getWest().toFixed(5),
    minLat: bounds.getSouth().toFixed(5),
    maxLon: bounds.getEast().toFixed(5),
    maxLat: bounds.getNorth().toFixed(5),
  });

  const response = await fetch(`/api/ships?${query.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ship data (${response.status})`);
  }

  return (await response.json()) as ShipsApiResponse;
}

export function updateShipsData(map: Map, collection: ShipsCollection): void {
  const source = map.getSource(SHIPS_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}

export function attachShipsHoverTooltip(map: Map): () => void {
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

    popupRef.current.setLngLat(event.lngLat).setHTML(formatShipPopup(feature)).addTo(map);
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  };

  map.on("mousemove", SHIPS_LAYER_ID, onMove);
  map.on("mouseleave", SHIPS_LAYER_ID, onLeave);

  return () => {
    map.off("mousemove", SHIPS_LAYER_ID, onMove);
    map.off("mouseleave", SHIPS_LAYER_ID, onLeave);
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    map.getCanvas().style.cursor = "";
  };
}
