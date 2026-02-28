import maplibregl, { type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { CountryProfileApiResponse } from "@/lib/countryProfiles";

export const MAJOR_CITIES_SOURCE_ID = "major-cities-source";
export const MAJOR_CITIES_LAYER_ID = "major-cities-layer";

const MAJOR_CITIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson";

function formatNum(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unknown";
  }
  return Math.round(value).toLocaleString();
}

function formatMoney(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unknown";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatList(values?: string[]): string {
  if (!values || values.length === 0) {
    return "Unknown";
  }
  return values.join(", ");
}

function cityPopupHtml(feature: GeoJSON.Feature, profile?: CountryProfileApiResponse["profile"]): string {
  const props = feature.properties as Record<string, unknown>;
  const cityName = typeof props.name === "string" ? props.name : "Unknown City";
  const countryName = typeof props.adm0name === "string" ? props.adm0name : profile?.name ?? "Unknown";
  const cityPopulation = typeof props.pop_max === "number" ? props.pop_max : undefined;
  const label = typeof props.featurecla === "string" ? props.featurecla : "Populated place";

  return `
    <details open style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.45; color: #0f172a; max-width: 320px;">
      <summary style="cursor: pointer; font-weight: 600;">${cityName} (${countryName})</summary>
      <div style="margin-top: 6px;">
        <div><strong>City Population:</strong> ${formatNum(cityPopulation)}</div>
        <div><strong>City Class:</strong> ${label}</div>
        <div><strong>Country Population:</strong> ${formatNum(profile?.population)}</div>
        <div><strong>Country GDP (USD):</strong> ${formatMoney(profile?.gdpUsd)}</div>
        <div><strong>Capital:</strong> ${profile?.capital ?? "Unknown"}</div>
        <div><strong>Head of Government:</strong> ${profile?.headOfGovernment ?? "Unknown"}</div>
        <div><strong>Major Industries:</strong> ${formatList(profile?.majorIndustries)}</div>
      </div>
    </details>
  `;
}

export function ensureMajorCitiesLayer(map: Map): void {
  if (!map.getSource(MAJOR_CITIES_SOURCE_ID)) {
    map.addSource(MAJOR_CITIES_SOURCE_ID, {
      type: "geojson",
      data: MAJOR_CITIES_URL,
    });
  }

  if (!map.getLayer(MAJOR_CITIES_LAYER_ID)) {
    map.addLayer({
      id: MAJOR_CITIES_LAYER_ID,
      type: "circle",
      source: MAJOR_CITIES_SOURCE_ID,
      filter: [
        "any",
        ["==", ["coalesce", ["get", "worldcity"], 0], 1],
        ["<=", ["coalesce", ["get", "scalerank"], 10], 2],
        [">=", ["coalesce", ["get", "pop_max"], 0], 3000000],
      ],
      paint: {
        "circle-color": "#f8fafc",
        "circle-opacity": 0.88,
        "circle-stroke-color": "#020617",
        "circle-stroke-width": 0.8,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1.8, 4, 3.4, 7, 5],
      },
    });
  }
}

export function setMajorCitiesVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(MAJOR_CITIES_LAYER_ID)) {
    map.setLayoutProperty(MAJOR_CITIES_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export function attachMajorCityHoverTooltip(map: Map): () => void {
  let popup: Popup | null = null;
  let hoverSeq = 0;

  const onMove = async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }

    hoverSeq += 1;
    const seq = hoverSeq;
    map.getCanvas().style.cursor = "pointer";

    if (!popup) {
      popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    }

    popup.setLngLat(event.lngLat).setHTML(cityPopupHtml(feature)).addTo(map);

    const props = feature.properties as Record<string, unknown>;
    const iso2 = typeof props.iso_a2 === "string" ? props.iso_a2 : "";
    if (!iso2) {
      return;
    }

    try {
      const response = await fetch(`/api/country-profiles?iso2=${encodeURIComponent(iso2)}`, { cache: "no-store" });
      if (!response.ok || seq !== hoverSeq || !popup) {
        return;
      }

      const payload = (await response.json()) as CountryProfileApiResponse;
      popup.setHTML(cityPopupHtml(feature, payload.profile));
    } catch {
      // Keep basic popup content on network/API failure.
    }
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    if (popup) {
      popup.remove();
      popup = null;
    }
  };

  map.on("mousemove", MAJOR_CITIES_LAYER_ID, onMove);
  map.on("mouseleave", MAJOR_CITIES_LAYER_ID, onLeave);

  return () => {
    map.off("mousemove", MAJOR_CITIES_LAYER_ID, onMove);
    map.off("mouseleave", MAJOR_CITIES_LAYER_ID, onLeave);
    if (popup) {
      popup.remove();
      popup = null;
    }
    map.getCanvas().style.cursor = "";
  };
}
