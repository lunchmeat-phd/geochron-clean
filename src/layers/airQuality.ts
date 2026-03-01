import type { Map } from "maplibre-gl";

export const AIR_QUALITY_SOURCE_ID = "air-quality-source";
export const AIR_QUALITY_LAYER_ID = "air-quality-layer";

// NASA GIBS aerosol optical depth as a global air-quality proxy heatmap.
// Use MERRA-2 gridded aerosol analysis for continuous global coverage.
const AIR_QUALITY_TILES = [
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" +
    "MERRA2_Aerosol_Optical_Depth_Analysis_Monthly/default/default/" +
    "GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
];

export function ensureAirQualityLayer(map: Map): void {
  if (!map.getSource(AIR_QUALITY_SOURCE_ID)) {
    map.addSource(AIR_QUALITY_SOURCE_ID, {
      type: "raster",
      tiles: AIR_QUALITY_TILES,
      tileSize: 256,
      bounds: [-180, -85.051129, 180, 85.051129],
      minzoom: 0,
      maxzoom: 6,
      attribution: "Air quality proxy: NASA GIBS (MERRA-2 Aerosol Optical Depth Analysis, Monthly)",
    });
  }

  if (!map.getLayer(AIR_QUALITY_LAYER_ID)) {
    map.addLayer({
      id: AIR_QUALITY_LAYER_ID,
      type: "raster",
      source: AIR_QUALITY_SOURCE_ID,
      paint: {
        "raster-opacity": 0.42,
        "raster-fade-duration": 0,
      },
    });
  }
}

export function setAirQualityVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(AIR_QUALITY_LAYER_ID)) {
    map.setLayoutProperty(AIR_QUALITY_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}
