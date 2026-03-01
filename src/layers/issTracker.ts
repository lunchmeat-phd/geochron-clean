import type { FeatureCollection, LineString, Point } from "geojson";
import type { GeoJSONSource, Map } from "maplibre-gl";
import type { IssOrbitPoint, IssTrackerResponse } from "@/lib/iss";
import { ICONS } from "@/layers/icons";

export const ISS_SOURCE_ID = "iss-source";
export const ISS_POINT_LAYER_ID = "iss-point-layer";
export const ISS_TRAIL_LAYER_ID = "iss-trail-layer";
export const ISS_ORBIT_LAYER_ID = "iss-orbit-layer";

const ISS_TRAIL_MAX_POINTS = 180;
let issTrail: [number, number][] = [];

function normalizeLon(lon: number): number {
  return ((lon + 540) % 360) - 180;
}

function isValidCoordinate(lon: number, lat: number): boolean {
  return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

function toLineSegments(points: [number, number][]): [number, number][][] {
  if (points.length < 2) {
    return [];
  }

  const segments: [number, number][][] = [];
  let current: [number, number][] = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const next = points[i];
    const prev = current[current.length - 1];

    if (Math.abs(next[0] - prev[0]) > 180) {
      if (current.length > 1) {
        segments.push(current);
      }
      current = [next];
    } else {
      current.push(next);
    }
  }

  if (current.length > 1) {
    segments.push(current);
  }

  return segments;
}

function toFeatureCollection(lon: number, lat: number, orbit: IssOrbitPoint[] = []): FeatureCollection<Point | LineString> {
  const normalizedLon = normalizeLon(lon);
  if (!isValidCoordinate(normalizedLon, lat)) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  const point: [number, number] = [normalizedLon, lat];

  const last = issTrail[issTrail.length - 1];
  if (!last || Math.abs(last[0] - point[0]) <= 60) {
    issTrail.push(point);
  } else {
    issTrail = [point];
  }

  if (issTrail.length > ISS_TRAIL_MAX_POINTS) {
    issTrail = issTrail.slice(issTrail.length - ISS_TRAIL_MAX_POINTS);
  }

  const features: FeatureCollection<Point | LineString>["features"] = [
    {
      type: "Feature",
      properties: { kind: "iss" },
      geometry: { type: "Point", coordinates: point },
    },
  ];

  if (issTrail.length > 1) {
    const trailSegments = toLineSegments(issTrail);
    trailSegments.forEach((coordinates) => {
      features.push({
        type: "Feature",
        properties: { kind: "trail" },
        geometry: { type: "LineString", coordinates },
      });
    });
  }

  if (orbit.length > 1) {
    const orbitCoordinates = orbit
      .map((p) => [normalizeLon(p.longitude), p.latitude] as [number, number])
      .filter((p) => isValidCoordinate(p[0], p[1]));

    const orbitSegments = toLineSegments(orbitCoordinates);

    orbitSegments.forEach((coordinates) => {
      features.push({
        type: "Feature",
        properties: { kind: "orbit" },
        geometry: { type: "LineString", coordinates },
      });
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export function ensureIssTrackerLayer(map: Map): void {
  if (!map.getSource(ISS_SOURCE_ID)) {
    map.addSource(ISS_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(ISS_TRAIL_LAYER_ID)) {
    map.addLayer({
      id: ISS_TRAIL_LAYER_ID,
      type: "line",
      source: ISS_SOURCE_ID,
      filter: ["==", ["get", "kind"], "trail"],
      paint: {
        "line-color": "#22d3ee",
        "line-width": 1.5,
        "line-opacity": 0.65,
      },
    });
  }

  if (!map.getLayer(ISS_ORBIT_LAYER_ID)) {
    map.addLayer({
      id: ISS_ORBIT_LAYER_ID,
      type: "line",
      source: ISS_SOURCE_ID,
      filter: ["==", ["get", "kind"], "orbit"],
      paint: {
        "line-color": "#f43f5e",
        "line-width": 2.6,
        "line-opacity": 0.95,
        "line-dasharray": [2, 1.2],
      },
    });
  }

  if (!map.getLayer(ISS_POINT_LAYER_ID)) {
    map.addLayer({
      id: ISS_POINT_LAYER_ID,
      type: "symbol",
      source: ISS_SOURCE_ID,
      filter: ["==", ["get", "kind"], "iss"],
      layout: {
        "icon-image": ICONS.iss,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 1.08, 4, 0.86, 7, 0.68],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }
}

export function setIssTrackerVisibility(map: Map, visible: boolean): void {
  const visibility = visible ? "visible" : "none";

  if (map.getLayer(ISS_TRAIL_LAYER_ID)) {
    map.setLayoutProperty(ISS_TRAIL_LAYER_ID, "visibility", visibility);
  }

  if (map.getLayer(ISS_ORBIT_LAYER_ID)) {
    map.setLayoutProperty(ISS_ORBIT_LAYER_ID, "visibility", visibility);
  }

  if (map.getLayer(ISS_POINT_LAYER_ID)) {
    map.setLayoutProperty(ISS_POINT_LAYER_ID, "visibility", visibility);
  }
}

export async function fetchIssTracker(): Promise<IssTrackerResponse> {
  const response = await fetch("/api/iss", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch ISS position (${response.status})`);
  }

  return (await response.json()) as IssTrackerResponse;
}

export function updateIssTrackerData(map: Map, lon: number, lat: number, orbit: IssOrbitPoint[]): void {
  const source = map.getSource(ISS_SOURCE_ID) as GeoJSONSource | undefined;

  if (!source) {
    return;
  }

  try {
    source.setData(toFeatureCollection(lon, lat, orbit));
  } catch {
    source.setData({
      type: "FeatureCollection",
      features: [],
    });
  }
}
