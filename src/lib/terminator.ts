import type { Feature, Polygon } from "geojson";

type Vec3 = [number, number, number];

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function normalize(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function toLonLat(v: Vec3): [number, number] {
  const lon = Math.atan2(v[1], v[0]) * RAD2DEG;
  const lat = Math.asin(v[2]) * RAD2DEG;
  return [lon, lat];
}

function isPointInsidePolygon(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || 1e-9) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function getSunPosition(date: Date): { latitude: number; longitude: number } {
  const unixDays = date.getTime() / 86400000 + 2440587.5 - 2451545;
  const meanLongitude = (280.46 + 0.9856474 * unixDays) % 360;
  const meanAnomaly = (357.528 + 0.9856003 * unixDays) % 360;
  const lambda = meanLongitude + 1.915 * Math.sin(meanAnomaly * DEG2RAD) + 0.02 * Math.sin(2 * meanAnomaly * DEG2RAD);
  const obliquity = 23.439 - 0.0000004 * unixDays;

  const alpha = Math.atan2(Math.cos(obliquity * DEG2RAD) * Math.sin(lambda * DEG2RAD), Math.cos(lambda * DEG2RAD));
  const declination = Math.asin(Math.sin(obliquity * DEG2RAD) * Math.sin(lambda * DEG2RAD));

  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const greenwichMeanSidereal = (6.697375 + 0.0657098242 * unixDays + utcHours) * 15;
  const longitude = ((alpha * RAD2DEG - greenwichMeanSidereal + 540) % 360) - 180;

  return {
    latitude: declination * RAD2DEG,
    longitude,
  };
}

export function createNightTerminatorGeoJson(date = new Date()): Feature<Polygon> {
  const sun = getSunPosition(date);
  const sunLat = sun.latitude * DEG2RAD;
  const sunLon = sun.longitude * DEG2RAD;

  const s: Vec3 = [
    Math.cos(sunLat) * Math.cos(sunLon),
    Math.cos(sunLat) * Math.sin(sunLon),
    Math.sin(sunLat),
  ];

  const axis: Vec3 = Math.abs(s[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
  const u = normalize(cross(s, axis));
  const v = normalize(cross(s, u));

  const ring: [number, number][] = [];

  // Great-circle boundary of the dark hemisphere (solar zenith angle = 90 deg).
  for (let d = 0; d <= 360; d += 2) {
    const t = d * DEG2RAD;
    const p: Vec3 = [u[0] * Math.cos(t) + v[0] * Math.sin(t), u[1] * Math.cos(t) + v[1] * Math.sin(t), u[2] * Math.cos(t) + v[2] * Math.sin(t)];
    ring.push(toLonLat(p));
  }

  const antiSolarPoint: [number, number] = toLonLat([-s[0], -s[1], -s[2]]);

  if (!isPointInsidePolygon(antiSolarPoint, ring)) {
    ring.reverse();
  }

  if (ring.length > 0) {
    ring.push(ring[0]);
  }

  return {
    type: "Feature",
    properties: {
      updatedAt: date.toISOString(),
    },
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}
