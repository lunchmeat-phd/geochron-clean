import maplibregl, { type GeoJSONSource, type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { CarrierStrikeGroupApiResponse, CarrierStrikeGroupCollection } from "@/lib/csg";
import { ICONS } from "@/layers/icons";

export const CSG_SOURCE_ID = "carrier-strike-groups-source";
export const CSG_AREA_LAYER_ID = "carrier-strike-groups-area-layer";
export const CSG_AREA_OUTLINE_LAYER_ID = "carrier-strike-groups-area-outline-layer";
export const CSG_POINT_LAYER_ID = "carrier-strike-groups-point-layer";

function confidenceColor(confidence: unknown): string {
  if (confidence === "High") {
    return "#ef4444";
  }
  if (confidence === "Medium") {
    return "#f59e0b";
  }
  return "#94a3b8";
}

function formatCsgPopup(feature: GeoJSON.Feature): string {
  const props = feature.properties as Record<string, unknown>;
  const groupName = typeof props.groupName === "string" ? props.groupName : "Unknown group";
  const carrier = typeof props.carrier === "string" ? props.carrier : "Unknown carrier";
  const navy = typeof props.navy === "string" ? props.navy : "Unknown navy";
  const confidence = typeof props.confidence === "string" ? props.confidence : "Unknown";
  const confidenceScore = typeof props.confidenceScore === "number" ? props.confidenceScore : null;
  const updatedAt = typeof props.updatedAt === "string" ? props.updatedAt : "Unknown";
  const uncertaintyKm = typeof props.uncertaintyKm === "number" ? props.uncertaintyKm : null;
  const evidenceCount = typeof props.evidenceCount === "number" ? props.evidenceCount : null;
  const sourceCount = typeof props.sourceCount === "number" ? props.sourceCount : null;
  const sourceSummary = typeof props.sourceSummary === "string" ? props.sourceSummary : "Unknown sources";
  const summary = typeof props.summary === "string" ? props.summary : "No summary available";
  const sourceName = typeof props.sourceName === "string" ? props.sourceName : "Unknown source";
  const sourceUrl = typeof props.sourceUrl === "string" ? props.sourceUrl : "";
  const featureKind = props.featureKind === "operatingArea" ? "Estimated Operating Area" : "Last Known Position";

  const sourceHtml = sourceUrl
    ? `<a href="${sourceUrl}" target="_blank" rel="noreferrer">${sourceName}</a>`
    : sourceName;

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.45; color: #0f172a;">
      <strong>${groupName}</strong><br/>
      Carrier: ${carrier}<br/>
      Navy: ${navy}<br/>
      Confidence: ${confidence}<br/>
      Confidence Score: ${confidenceScore !== null ? `${confidenceScore}/100` : "Unknown"}<br/>
      Layer Type: ${featureKind}<br/>
      Uncertainty: ${uncertaintyKm !== null ? `${uncertaintyKm} km` : "Unknown"}<br/>
      Evidence Points: ${evidenceCount ?? "Unknown"}<br/>
      Source Count: ${sourceCount ?? "Unknown"}<br/>
      Sources: ${sourceSummary}<br/>
      Updated: ${updatedAt}<br/>
      Notes: ${summary}<br/>
      Source: ${sourceHtml}
    </div>
  `;
}

export function ensureCarrierStrikeGroupsLayer(map: Map): void {
  if (!map.getSource(CSG_SOURCE_ID)) {
    map.addSource(CSG_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(CSG_AREA_LAYER_ID)) {
    map.addLayer({
      id: CSG_AREA_LAYER_ID,
      type: "fill",
      source: CSG_SOURCE_ID,
      filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "featureKind"], "operatingArea"]],
      paint: {
        "fill-color": [
          "match",
          ["coalesce", ["get", "confidence"], "Low"],
          "High",
          confidenceColor("High"),
          "Medium",
          confidenceColor("Medium"),
          confidenceColor("Low"),
        ],
        "fill-opacity": 0.18,
      },
    });
  }

  if (!map.getLayer(CSG_AREA_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: CSG_AREA_OUTLINE_LAYER_ID,
      type: "line",
      source: CSG_SOURCE_ID,
      filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "featureKind"], "operatingArea"]],
      paint: {
        "line-color": [
          "match",
          ["coalesce", ["get", "confidence"], "Low"],
          "High",
          confidenceColor("High"),
          "Medium",
          confidenceColor("Medium"),
          confidenceColor("Low"),
        ],
        "line-opacity": 0.8,
        "line-width": 1.2,
      },
    });
  }

  if (!map.getLayer(CSG_POINT_LAYER_ID)) {
    map.addLayer({
      id: CSG_POINT_LAYER_ID,
      type: "symbol",
      source: CSG_SOURCE_ID,
      filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "featureKind"], "lastKnown"]],
      layout: {
        "icon-image": [
          "match",
          ["coalesce", ["get", "confidence"], "Low"],
          "High",
          ICONS.csgHigh,
          "Medium",
          ICONS.csgMedium,
          ICONS.csgLow,
        ],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 1.08, 4, 0.86, 7, 0.68],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }
}

export function setCarrierStrikeGroupsVisibility(map: Map, visible: boolean): void {
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(CSG_AREA_LAYER_ID)) {
    map.setLayoutProperty(CSG_AREA_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(CSG_AREA_OUTLINE_LAYER_ID)) {
    map.setLayoutProperty(CSG_AREA_OUTLINE_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(CSG_POINT_LAYER_ID)) {
    map.setLayoutProperty(CSG_POINT_LAYER_ID, "visibility", visibility);
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
    popupRef.current.setLngLat(event.lngLat).setHTML(formatCsgPopup(feature)).addTo(map);
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

export function attachCarrierStrikeGroupsHoverTooltip(map: Map): () => void {
  const popupRef: { current: Popup | null } = { current: null };
  const cleanups: (() => void)[] = [];

  cleanups.push(...attachHoverForLayer(map, CSG_AREA_LAYER_ID, popupRef));
  cleanups.push(...attachHoverForLayer(map, CSG_AREA_OUTLINE_LAYER_ID, popupRef));
  cleanups.push(...attachHoverForLayer(map, CSG_POINT_LAYER_ID, popupRef));

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    map.getCanvas().style.cursor = "";
  };
}

export async function fetchCarrierStrikeGroups(): Promise<CarrierStrikeGroupApiResponse> {
  const response = await fetch("/api/csg", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch carrier strike groups (${response.status})`);
  }
  return (await response.json()) as CarrierStrikeGroupApiResponse;
}

export function updateCarrierStrikeGroupsData(map: Map, collection: CarrierStrikeGroupCollection): void {
  const source = map.getSource(CSG_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }
  source.setData(collection);
}
