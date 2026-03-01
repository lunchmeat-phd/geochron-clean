import type { FeatureCollection, LineString, Point } from "geojson";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { getSunPosition } from "@/lib/terminator";
import { ICONS } from "@/layers/icons";

export const SUN_ANALEMMA_SOURCE_ID = "sun-analemma-source";
export const SUN_ANALEMMA_LINE_LAYER_ID = "sun-analemma-line-layer";
export const SUN_POSITION_LAYER_ID = "sun-position-layer";
const ATLANTIC_CENTER_LON = -30;

function normalizeLon(lon: number): number {
  return ((lon + 540) % 360) - 180;
}

function shiftLonToPacific(lon: number, offset: number): number {
  return normalizeLon(lon + offset);
}

function buildAnalemmaSegments(now: Date, lonOffset: number): number[][][] {
  const year = now.getUTCFullYear();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const s = now.getUTCSeconds();

  const points: [number, number][] = [];
  for (let day = 0; day < 366; day += 1) {
    const date = new Date(Date.UTC(year, 0, 1 + day, h, m, s));
    if (date.getUTCFullYear() !== year) {
      break;
    }
    const sun = getSunPosition(date);
    points.push([shiftLonToPacific(sun.longitude, lonOffset), sun.latitude]);
  }

  const segments: number[][][] = [];
  let current: number[][] = [];

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (current.length === 0) {
      current.push(p);
      continue;
    }

    const prev = current[current.length - 1];
    if (Math.abs(p[0] - prev[0]) > 180) {
      if (current.length > 1) {
        segments.push(current);
      }
      current = [p];
    } else {
      current.push(p);
    }
  }

  if (current.length > 1) {
    segments.push(current);
  }

  return segments;
}

function createSunAnalemmaCollection(now = new Date()): FeatureCollection<LineString | Point> {
  const sun = getSunPosition(now);
  // Re-center analemma each update so the current sun marker stays over the Pacific.
  const lonOffset = ATLANTIC_CENTER_LON - sun.longitude;
  const segments = buildAnalemmaSegments(now, lonOffset);

  const lineFeatures = segments.map((coordinates, idx) => ({
    type: "Feature" as const,
    properties: {
      kind: "analemma",
      id: `segment-${idx}`,
    },
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
  }));

  const sunFeature = {
    type: "Feature" as const,
    properties: {
      kind: "sun",
      updatedAt: now.toISOString(),
    },
    geometry: {
      type: "Point" as const,
      coordinates: [shiftLonToPacific(sun.longitude, lonOffset), sun.latitude],
    },
  };

  return {
    type: "FeatureCollection",
    features: [...lineFeatures, sunFeature],
  };
}

export function ensureSunAnalemmaLayer(map: Map): void {
  if (!map.getSource(SUN_ANALEMMA_SOURCE_ID)) {
    map.addSource(SUN_ANALEMMA_SOURCE_ID, {
      type: "geojson",
      data: createSunAnalemmaCollection(),
    });
  }

  if (!map.getLayer(SUN_ANALEMMA_LINE_LAYER_ID)) {
    map.addLayer({
      id: SUN_ANALEMMA_LINE_LAYER_ID,
      type: "line",
      source: SUN_ANALEMMA_SOURCE_ID,
      filter: ["==", ["get", "kind"], "analemma"],
      paint: {
        "line-color": "#fde047",
        "line-width": 1.8,
        "line-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer(SUN_POSITION_LAYER_ID)) {
    map.addLayer({
      id: SUN_POSITION_LAYER_ID,
      type: "symbol",
      source: SUN_ANALEMMA_SOURCE_ID,
      filter: ["==", ["get", "kind"], "sun"],
      layout: {
        "icon-image": ICONS.sun,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.96, 4, 0.78, 7, 0.62],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }
}

export function updateSunAnalemma(map: Map): string {
  const source = map.getSource(SUN_ANALEMMA_SOURCE_ID) as GeoJSONSource | undefined;
  const now = new Date();

  if (!source) {
    return now.toISOString();
  }

  source.setData(createSunAnalemmaCollection(now));
  return now.toISOString();
}

export function setSunAnalemmaVisibility(map: Map, visible: boolean): void {
  const visibility = visible ? "visible" : "none";

  if (map.getLayer(SUN_ANALEMMA_LINE_LAYER_ID)) {
    map.setLayoutProperty(SUN_ANALEMMA_LINE_LAYER_ID, "visibility", visibility);
  }

  if (map.getLayer(SUN_POSITION_LAYER_ID)) {
    map.setLayoutProperty(SUN_POSITION_LAYER_ID, "visibility", visibility);
  }
}
