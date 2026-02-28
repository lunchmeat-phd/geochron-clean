import maplibregl, { type GeoJSONSource, type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import type { CountryProfileApiResponse, CountryProfilesApiResponse, CountryProfilesCollection } from "@/lib/countryProfiles";

export const COUNTRY_PROFILES_SOURCE_ID = "country-profiles-source";
export const COUNTRY_PROFILES_LAYER_ID = "country-profiles-layer";

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

function formatList(values: unknown): string {
  if (!Array.isArray(values) || values.length === 0) {
    return "Unknown";
  }
  return values.filter((item) => typeof item === "string").join(", ");
}

function countryPopupHtml(feature: GeoJSON.Feature, enriched?: CountryProfileApiResponse["profile"]): string {
  const props = feature.properties as Record<string, unknown>;
  const name = typeof props.name === "string" ? props.name : enriched?.name ?? "Unknown";
  const iso2 = typeof props.iso2 === "string" ? props.iso2 : enriched?.iso2 ?? "--";
  const region = typeof props.region === "string" ? props.region : enriched?.region ?? "Unknown";
  const subregion = typeof props.subregion === "string" ? props.subregion : enriched?.subregion ?? "Unknown";

  return `
    <details open style="font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.45; color: #0f172a; max-width: 320px;">
      <summary style="cursor: pointer; font-weight: 600;">${name} (${iso2})</summary>
      <div style="margin-top: 6px;">
        <div><strong>Population:</strong> ${formatNum(enriched?.population ?? props.population)}</div>
        <div><strong>GDP (USD):</strong> ${formatMoney(enriched?.gdpUsd ?? props.gdpUsd)}</div>
        <div><strong>Capital:</strong> ${enriched?.capital ?? (props.capital as string | undefined) ?? "Unknown"}</div>
        <div><strong>Head of Government:</strong> ${enriched?.headOfGovernment ?? (props.headOfGovernment as string | undefined) ?? "Unknown"}</div>
        <div><strong>Major Industries:</strong> ${formatList(enriched?.majorIndustries ?? props.majorIndustries)}</div>
        <div><strong>Region:</strong> ${region}</div>
        <div><strong>Subregion:</strong> ${subregion}</div>
      </div>
    </details>
  `;
}

export function ensureCountryProfilesLayer(map: Map): void {
  if (!map.getSource(COUNTRY_PROFILES_SOURCE_ID)) {
    map.addSource(COUNTRY_PROFILES_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    });
  }

  if (!map.getLayer(COUNTRY_PROFILES_LAYER_ID)) {
    map.addLayer({
      id: COUNTRY_PROFILES_LAYER_ID,
      type: "circle",
      source: COUNTRY_PROFILES_SOURCE_ID,
      paint: {
        "circle-color": "#c4b5fd",
        "circle-opacity": 0.86,
        "circle-stroke-color": "#312e81",
        "circle-stroke-width": 0.8,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2, 4, 3.3, 7, 5],
      },
    });
  }
}

export function setCountryProfilesVisibility(map: Map, visible: boolean): void {
  if (map.getLayer(COUNTRY_PROFILES_LAYER_ID)) {
    map.setLayoutProperty(COUNTRY_PROFILES_LAYER_ID, "visibility", visible ? "visible" : "none");
  }
}

export async function fetchCountryProfiles(): Promise<CountryProfilesApiResponse> {
  const response = await fetch("/api/country-profiles", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch country profiles (${response.status})`);
  }

  return (await response.json()) as CountryProfilesApiResponse;
}

export function updateCountryProfilesData(map: Map, collection: CountryProfilesCollection): void {
  const source = map.getSource(COUNTRY_PROFILES_SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) {
    return;
  }

  source.setData(collection);
}

export function attachCountryProfilesHoverTooltip(map: Map): () => void {
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

    popup.setLngLat(event.lngLat).setHTML(countryPopupHtml(feature)).addTo(map);

    const iso2 = (feature.properties as Record<string, unknown>).iso2;
    if (typeof iso2 !== "string" || !iso2) {
      return;
    }

    try {
      const response = await fetch(`/api/country-profiles?iso2=${encodeURIComponent(iso2)}`, { cache: "no-store" });
      if (!response.ok || !popup || seq !== hoverSeq) {
        return;
      }

      const payload = (await response.json()) as CountryProfileApiResponse;
      popup.setHTML(countryPopupHtml(feature, payload.profile));
    } catch {
      // Keep basic popup content on failure.
    }
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    if (popup) {
      popup.remove();
      popup = null;
    }
  };

  map.on("mousemove", COUNTRY_PROFILES_LAYER_ID, onMove);
  map.on("mouseleave", COUNTRY_PROFILES_LAYER_ID, onLeave);

  return () => {
    map.off("mousemove", COUNTRY_PROFILES_LAYER_ID, onMove);
    map.off("mouseleave", COUNTRY_PROFILES_LAYER_ID, onLeave);
    if (popup) {
      popup.remove();
      popup = null;
    }
    map.getCanvas().style.cursor = "";
  };
}
