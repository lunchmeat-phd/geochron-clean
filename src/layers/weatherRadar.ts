import type { Map } from "maplibre-gl";

export const WEATHER_RADAR_SOURCE_ID = "weather-radar-source";
export const WEATHER_RADAR_LAYER_ID = "weather-radar-layer";

const WEATHER_META_URL = "https://api.rainviewer.com/public/weather-maps.json";
const WEATHER_FALLBACK_TILE = "https://tilecache.rainviewer.com/v2/radar/1772216400/256/{z}/{x}/{y}/6/1_1.png";

type RainViewerFrame = {
  time: number;
  path: string;
};

type RainViewerPayload = {
  host: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
};

let cachedTileUrl: string | null = null;
let cacheExpiresAt = 0;

function buildTileUrl(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/6/1_1.png`;
}

export async function fetchLatestWeatherRadarTileUrl(): Promise<string> {
  const now = Date.now();
  if (cachedTileUrl && now < cacheExpiresAt) {
    return cachedTileUrl;
  }

  const response = await fetch(WEATHER_META_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Weather radar metadata fetch failed (${response.status})`);
  }

  const payload = (await response.json()) as RainViewerPayload;
  const radarFrames = [...(payload.radar?.past ?? []), ...(payload.radar?.nowcast ?? [])];
  const latest = radarFrames[radarFrames.length - 1];

  if (!latest || !payload.host) {
    throw new Error("No weather radar frames available");
  }

  cachedTileUrl = buildTileUrl(payload.host, latest.path);
  cacheExpiresAt = now + 5 * 60_000;
  return cachedTileUrl;
}

export function ensureWeatherRadarLayer(map: Map): void {
  if (!map.getSource(WEATHER_RADAR_SOURCE_ID)) {
    map.addSource(WEATHER_RADAR_SOURCE_ID, {
      type: "raster",
      tiles: [WEATHER_FALLBACK_TILE],
      tileSize: 256,
      attribution: "Radar: RainViewer",
    });
  }

  if (!map.getLayer(WEATHER_RADAR_LAYER_ID)) {
    map.addLayer({
      id: WEATHER_RADAR_LAYER_ID,
      type: "raster",
      source: WEATHER_RADAR_SOURCE_ID,
      paint: {
        "raster-opacity": 0.55,
      },
    });
  }
}

// Apply new radar tiles by recreating the source+layer in place, NOT via
// RasterTileSource.setTiles(): setTiles performs an in-place raster reload that intermittently
// crashes MapLibre's renderer ("bind" TypeError) when symbol layers are also present. Removing
// and re-adding the layer at its original stacking position avoids that code path.
export async function updateWeatherRadarLayer(map: Map): Promise<string> {
  if (!map.getSource(WEATHER_RADAR_SOURCE_ID) && !map.getLayer(WEATHER_RADAR_LAYER_ID)) {
    return new Date().toISOString();
  }

  const tileUrl = await fetchLatestWeatherRadarTileUrl();

  // Preserve stacking position and current visibility so the swap is invisible.
  const layers = map.getStyle()?.layers ?? [];
  const index = layers.findIndex((layer) => layer.id === WEATHER_RADAR_LAYER_ID);
  const beforeId = index >= 0 && index + 1 < layers.length ? layers[index + 1].id : undefined;
  const visible = map.getLayer(WEATHER_RADAR_LAYER_ID)
    ? map.getLayoutProperty(WEATHER_RADAR_LAYER_ID, "visibility") !== "none"
    : true;

  try {
    if (map.getLayer(WEATHER_RADAR_LAYER_ID)) {
      map.removeLayer(WEATHER_RADAR_LAYER_ID);
    }
    if (map.getSource(WEATHER_RADAR_SOURCE_ID)) {
      map.removeSource(WEATHER_RADAR_SOURCE_ID);
    }
    map.addSource(WEATHER_RADAR_SOURCE_ID, {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
      attribution: "Radar: RainViewer",
    });
    map.addLayer(
      {
        id: WEATHER_RADAR_LAYER_ID,
        type: "raster",
        source: WEATHER_RADAR_SOURCE_ID,
        paint: { "raster-opacity": 0.55 },
        layout: { visibility: visible ? "visible" : "none" },
      },
      beforeId,
    );
  } catch {
    // Ignore transient errors during style transitions/teardown.
  }
  return new Date().toISOString();
}

export function setWeatherRadarVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(WEATHER_RADAR_LAYER_ID)) {
    map.setLayoutProperty(WEATHER_RADAR_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}
