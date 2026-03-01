import maplibregl, { type GeoJSONSource, type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { MilitaryBasesApiResponse, MilitaryBasesCollection } from "@/lib/militaryBases";
import { ICONS } from "@/layers/icons";

export const MILITARY_BASES_SOURCE_ID = "military-bases-source";
export const MILITARY_BASES_US_LAYER_ID = "military-bases-us-layer";
export const MILITARY_BASES_NON_US_LAYER_ID = "military-bases-non-us-layer";

function formatMilitaryPopup(feature: GeoJSON.Feature): string {
  const props = feature.properties as Record<string, unknown>;
  const name = typeof props.name === "string" ? props.name : "Unknown";
  const militaryType = typeof props.militaryType === "string" ? props.militaryType : "unknown";
  const country = typeof props.country === "string" ? props.country.toUpperCase() : "Unknown";
  const operator = typeof props.operator === "string" ? props.operator : "Unknown";
  const american = props.american === true ? "American" : "Non-American";

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.4; color: #0f172a;">
      <strong>${name}</strong><br/>
      Type: ${militaryType}<br/>
      Country: ${country}<br/>
      Operator: ${operator}<br/>
      Classification: ${american}
    </div>
  `;
}

export function ensureMilitaryBasesLayer(map: Map): void {
  if (!map.getSource(MILITARY_BASES_SOURCE_ID)) {
    map.addSource(MILITARY_BASES_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(MILITARY_BASES_NON_US_LAYER_ID)) {
    map.addLayer({
      id: MILITARY_BASES_NON_US_LAYER_ID,
      type: "symbol",
      source: MILITARY_BASES_SOURCE_ID,
      filter: ["==", ["coalesce", ["get", "american"], false], false],
      layout: {
        "icon-image": ICONS.militaryBaseNonUs,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.18, 4, 0.25, 7, 0.31],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }

  if (!map.getLayer(MILITARY_BASES_US_LAYER_ID)) {
    map.addLayer({
      id: MILITARY_BASES_US_LAYER_ID,
      type: "symbol",
      source: MILITARY_BASES_SOURCE_ID,
      filter: ["==", ["coalesce", ["get", "american"], false], true],
      layout: {
        "icon-image": ICONS.militaryBaseUs,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.19, 4, 0.26, 7, 0.32],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }
}

export function setMilitaryBasesVisibility(map: Map, visible: boolean): void {
  const visibility = visible ? "visible" : "none";

  if (map.getLayer(MILITARY_BASES_NON_US_LAYER_ID)) {
    map.setLayoutProperty(MILITARY_BASES_NON_US_LAYER_ID, "visibility", visibility);
  }

  if (map.getLayer(MILITARY_BASES_US_LAYER_ID)) {
    map.setLayoutProperty(MILITARY_BASES_US_LAYER_ID, "visibility", visibility);
  }
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

    popupRef.current.setLngLat(event.lngLat).setHTML(formatMilitaryPopup(feature)).addTo(map);
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

export function attachMilitaryBasesHoverTooltip(map: Map): () => void {
  const popupRef: { current: Popup | null } = { current: null };
  const cleanups: (() => void)[] = [];

  cleanups.push(...attachHoverForLayer(map, MILITARY_BASES_US_LAYER_ID, popupRef));
  cleanups.push(...attachHoverForLayer(map, MILITARY_BASES_NON_US_LAYER_ID, popupRef));

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    map.getCanvas().style.cursor = "";
  };
}

export async function fetchMilitaryBases(map: Map): Promise<MilitaryBasesApiResponse> {
  const zoom = map.getZoom();
  const bounds = map.getBounds();
  const query = new URLSearchParams({
    zoom: zoom.toFixed(2),
    minLon: bounds.getWest().toFixed(5),
    minLat: bounds.getSouth().toFixed(5),
    maxLon: bounds.getEast().toFixed(5),
    maxLat: bounds.getNorth().toFixed(5),
  });

  const response = await fetch(`/api/military-bases?${query.toString()}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch military bases (${response.status})`);
  }

  return (await response.json()) as MilitaryBasesApiResponse;
}

export function updateMilitaryBasesData(map: Map, collection: MilitaryBasesCollection): void {
  const source = map.getSource(MILITARY_BASES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }

  source.setData(collection);
}
