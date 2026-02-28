import type { Map } from "maplibre-gl";

const COUNTRY_BORDERS_SOURCE_ID = "country-borders-source";
const COUNTRY_BORDERS_LAYER_ID = "country-borders-layer";
const TIMEZONE_BORDERS_SOURCE_ID = "timezone-borders-source";
const TIMEZONE_BORDERS_LAYER_ID = "timezone-borders-layer";

const COUNTRY_BORDERS_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_boundary_lines_land.geojson";
const TIMEZONE_BORDERS_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_time_zones.geojson";

export function ensureBoundaryLayers(map: Map): void {
  if (!map.getSource(COUNTRY_BORDERS_SOURCE_ID)) {
    map.addSource(COUNTRY_BORDERS_SOURCE_ID, {
      type: "geojson",
      data: COUNTRY_BORDERS_URL,
    });
  }

  if (!map.getLayer(COUNTRY_BORDERS_LAYER_ID)) {
    map.addLayer({
      id: COUNTRY_BORDERS_LAYER_ID,
      type: "line",
      source: COUNTRY_BORDERS_SOURCE_ID,
      paint: {
        "line-color": "#f8fafc",
        "line-width": 1,
        "line-opacity": 0.85,
      },
    });
  }

  if (!map.getSource(TIMEZONE_BORDERS_SOURCE_ID)) {
    map.addSource(TIMEZONE_BORDERS_SOURCE_ID, {
      type: "geojson",
      data: TIMEZONE_BORDERS_URL,
    });
  }

  if (!map.getLayer(TIMEZONE_BORDERS_LAYER_ID)) {
    map.addLayer({
      id: TIMEZONE_BORDERS_LAYER_ID,
      type: "line",
      source: TIMEZONE_BORDERS_SOURCE_ID,
      paint: {
        "line-color": "#38bdf8",
        "line-width": 0.7,
        "line-opacity": 0.55,
        "line-dasharray": [2, 1],
      },
    });
  }
}
