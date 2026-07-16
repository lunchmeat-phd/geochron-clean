import type { Map } from "maplibre-gl";

export const ICONS = {
  earthquake: "icon-earthquake",
  volcano: "icon-volcano",
  aircraftCivilian: "icon-aircraft-civilian",
  aircraftMilitary: "icon-aircraft-military",
  aircraftEmergency: "icon-aircraft-emergency",
  aircraftComms: "icon-aircraft-comms",
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

const ICON_SIZE = 48;

function createIconContext(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create icon canvas context");
  }
  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
  return { canvas, ctx };
}

function ensureImage(map: Map, id: string, draw: (ctx: CanvasRenderingContext2D, size: number) => void): void {
  if (map.hasImage(id)) {
    return;
  }
  // Isolate failures: a single bad icon must not throw out of ensureMapIcons and leave later
  // icons unregistered (which would crash symbol layers that reference them).
  try {
    const { ctx } = createIconContext();
    draw(ctx, ICON_SIZE);
    map.addImage(id, ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE), { pixelRatio: 2 });
  } catch {
    // Skipped; the map's styleimagemissing handler supplies a placeholder if needed.
  }
}

// Earthquake: seismic epicenter ripple (concentric rings fading outward).
function drawEarthquake(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.lineWidth = 3;
  const rings = [8, 13, 18];
  rings.forEach((r, i) => {
    ctx.globalAlpha = 1 - i * 0.28;
    ctx.strokeStyle = i === 0 ? "#f97316" : "#fb923c";
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(c, c, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

// Volcano: gray cone with a glowing eruption plume.
function drawVolcano(ctx: CanvasRenderingContext2D, size: number): void {
  const w = size;
  ctx.fillStyle = "#4b5563";
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.16, w * 0.8);
  ctx.lineTo(w * 0.37, w * 0.42);
  ctx.lineTo(w * 0.63, w * 0.42);
  ctx.lineTo(w * 0.84, w * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eruption plume.
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(w * 0.39, w * 0.42);
  ctx.lineTo(w * 0.5, w * 0.14);
  ctx.lineTo(w * 0.61, w * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  ctx.moveTo(w * 0.45, w * 0.32);
  ctx.lineTo(w * 0.5, w * 0.18);
  ctx.lineTo(w * 0.55, w * 0.32);
  ctx.closePath();
  ctx.fill();
}

// Top-down airliner silhouette, nose pointing up (north) so icon-rotate=heading works.
function drawAirliner(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const c = size / 2;
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(2,6,23,0.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c, size * 0.12);
  ctx.lineTo(c + 3, size * 0.32);
  ctx.lineTo(c + 3, size * 0.46);
  ctx.lineTo(size * 0.86, size * 0.58);
  ctx.lineTo(size * 0.86, size * 0.64);
  ctx.lineTo(c + 3, size * 0.56);
  ctx.lineTo(c + 3, size * 0.74);
  ctx.lineTo(c + 7, size * 0.82);
  ctx.lineTo(c + 7, size * 0.86);
  ctx.lineTo(c, size * 0.8);
  ctx.lineTo(c - 7, size * 0.86);
  ctx.lineTo(c - 7, size * 0.82);
  ctx.lineTo(c - 3, size * 0.74);
  ctx.lineTo(c - 3, size * 0.56);
  ctx.lineTo(size * 0.14, size * 0.64);
  ctx.lineTo(size * 0.14, size * 0.58);
  ctx.lineTo(c - 3, size * 0.46);
  ctx.lineTo(c - 3, size * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Top-down fighter jet silhouette (sharper nose, delta wings), nose up.
function drawFighter(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const c = size / 2;
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(2,6,23,0.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c, size * 0.1);
  ctx.lineTo(c + 2.4, size * 0.52);
  ctx.lineTo(size * 0.8, size * 0.76);
  ctx.lineTo(c + 2.4, size * 0.68);
  ctx.lineTo(c + 5, size * 0.88);
  ctx.lineTo(c, size * 0.82);
  ctx.lineTo(c - 5, size * 0.88);
  ctx.lineTo(c - 2.4, size * 0.68);
  ctx.lineTo(size * 0.2, size * 0.76);
  ctx.lineTo(c - 2.4, size * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

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
  try {
    map.addImage(id, createBadgeImage(options), { pixelRatio: 2 });
  } catch {
    // Skipped; the map's styleimagemissing handler supplies a placeholder if needed.
  }
}

export function ensureMapIcons(map: Map): void {
  ensureImage(map, ICONS.earthquake, drawEarthquake);
  ensureImage(map, ICONS.volcano, drawVolcano);
  ensureImage(map, ICONS.aircraftCivilian, (ctx, size) => drawAirliner(ctx, size, "#bae6fd"));
  ensureImage(map, ICONS.aircraftMilitary, (ctx, size) => drawFighter(ctx, size, "#fb7185"));
  ensureImage(map, ICONS.aircraftEmergency, (ctx, size) => drawAirliner(ctx, size, "#ef4444"));
  ensureImage(map, ICONS.aircraftComms, (ctx, size) => drawAirliner(ctx, size, "#f59e0b"));
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
