import type { Map } from "maplibre-gl";

export const ICONS = {
  earthquake: "icon-earthquake",
  aircraftCivilian: "icon-aircraft-civilian",
  aircraftMilitary: "icon-aircraft-military",
  city: "icon-city",
  countryProfile: "icon-country-profile",
  sun: "icon-sun",
  militaryBaseUs: "icon-military-base-us",
  militaryBaseNonUs: "icon-military-base-non-us",
  iss: "icon-iss",
  rocketDefault: "icon-rocket-default",
  rocketSpacex: "icon-rocket-spacex",
  rocketUla: "icon-rocket-ula",
  rocketLab: "icon-rocket-lab",
  csgHigh: "icon-csg-high",
  csgMedium: "icon-csg-medium",
  csgLow: "icon-csg-low",
} as const;

type BadgeOptions = {
  fill: string;
  stroke: string;
  text: string;
  textColor?: string;
};

function createBadgeImage(options: BadgeOptions): ImageData {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create icon canvas context");
  }

  const center = size / 2;
  const radius = 17;

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = options.fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = options.stroke;
  ctx.stroke();

  ctx.fillStyle = options.textColor ?? "#ffffff";
  ctx.font = "700 15px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(options.text, center, center + 0.5);

  return ctx.getImageData(0, 0, size, size);
}

function ensureBadge(map: Map, id: string, options: BadgeOptions): void {
  if (map.hasImage(id)) {
    return;
  }
  map.addImage(id, createBadgeImage(options), { pixelRatio: 2 });
}

export function ensureMapIcons(map: Map): void {
  ensureBadge(map, ICONS.earthquake, { fill: "#f97316", stroke: "#7c2d12", text: "EQ" });
  ensureBadge(map, ICONS.aircraftCivilian, { fill: "#38bdf8", stroke: "#0c4a6e", text: "✈" });
  ensureBadge(map, ICONS.aircraftMilitary, { fill: "#fb7185", stroke: "#881337", text: "M" });
  ensureBadge(map, ICONS.city, { fill: "#e2e8f0", stroke: "#020617", text: "C", textColor: "#0f172a" });
  ensureBadge(map, ICONS.countryProfile, { fill: "#c4b5fd", stroke: "#312e81", text: "P" });
  ensureBadge(map, ICONS.sun, { fill: "#facc15", stroke: "#854d0e", text: "☀", textColor: "#4a3400" });
  ensureBadge(map, ICONS.militaryBaseUs, { fill: "#f43f5e", stroke: "#4c0519", text: "US" });
  ensureBadge(map, ICONS.militaryBaseNonUs, { fill: "#38bdf8", stroke: "#082f49", text: "INT" });
  ensureBadge(map, ICONS.iss, { fill: "#22d3ee", stroke: "#083344", text: "ISS", textColor: "#062f3a" });
  ensureBadge(map, ICONS.rocketDefault, { fill: "#a78bfa", stroke: "#111827", text: "R" });
  ensureBadge(map, ICONS.rocketSpacex, { fill: "#38bdf8", stroke: "#111827", text: "SX" });
  ensureBadge(map, ICONS.rocketUla, { fill: "#facc15", stroke: "#111827", text: "ULA", textColor: "#3f2c00" });
  ensureBadge(map, ICONS.rocketLab, { fill: "#f97316", stroke: "#111827", text: "RL" });
  ensureBadge(map, ICONS.csgHigh, { fill: "#ef4444", stroke: "#450a0a", text: "CV" });
  ensureBadge(map, ICONS.csgMedium, { fill: "#f59e0b", stroke: "#78350f", text: "CV", textColor: "#3f2c00" });
  ensureBadge(map, ICONS.csgLow, { fill: "#94a3b8", stroke: "#334155", text: "CV" });
}
