"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerToggleState, RefreshTimes } from "@/layers";

type StatusPanelProps = {
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  toggles: LayerToggleState;
  onToggle: (key: keyof LayerToggleState, next: boolean) => void;
  onSetAllLayers: (next: boolean) => void;
  stealthMode: boolean;
  onStealthModeChange: (next: boolean) => void;
  panelColor: string;
  onPanelColorChange: (next: string) => void;
  brightnessPercent: number;
  onBrightnessChange: (next: number) => void;
  stockTickerEnabled: boolean;
  onStockTickerEnabledChange: (next: boolean) => void;
  utcNow: string;
  refreshTimes: RefreshTimes;
  quakeCount: number;
  shippingLaneCount: number;
  flightCorridorCount: number;
  tfrCount: number;
  volcanoCount: number;
  tropicalStormCount: number;
  tsunamiWarningCount: number;
  cityCount: number;
  countryCount: number;
  pipelineCount: number;
  fiberCableCount: number;
  militaryAmericanCount: number;
  militaryNonAmericanCount: number;
  airTrafficCount: number;
  airTrafficMilitaryCount: number;
  rocketLaunchCount: number;
  carrierStrikeGroupCount: number;
  csgActiveSources: number;
  csgTotalSources: number;
  csgAverageConfidence: number;
  quakeStale: boolean;
  error: string | null;
};

type LayerCategoryId = "core" | "natural" | "aviation" | "maritime" | "defense";

type LayerToggleItem = {
  key: keyof LayerToggleState;
  label: string;
  icon: string;
  showBaseLegend?: boolean;
};

type LayerCategory = {
  id: LayerCategoryId;
  title: string;
  items: LayerToggleItem[];
};

function formatIso(value?: string): string {
  if (!value) {
    return "Never";
  }

  return value;
}

function formatLocalHeader(value: string): { date: string; time: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "Unknown date", time: "Unknown time" };
  }

  const date = parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  const time = parsed.toLocaleTimeString("en-US", {
    hour12: false,
  });

  return { date, time };
}

function formatUtcHeader(value: string): { date: string; time: string } {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "Unknown date", time: "Unknown time" };
  }

  const date = parsed.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  const time = parsed.toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour12: false,
  });

  return { date, time };
}

function textColorForHex(hex: string): string {
  const raw = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    return "#0f172a";
  }
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 150 ? "#f8fafc" : "#0f172a";
}

export function StatusPanel({
  collapsed,
  onCollapsedChange,
  toggles,
  onToggle,
  onSetAllLayers,
  stealthMode,
  onStealthModeChange,
  panelColor,
  onPanelColorChange,
  brightnessPercent,
  onBrightnessChange,
  stockTickerEnabled,
  onStockTickerEnabledChange,
  utcNow,
  refreshTimes,
  quakeCount,
  shippingLaneCount,
  flightCorridorCount,
  tfrCount,
  volcanoCount,
  tropicalStormCount,
  tsunamiWarningCount,
  cityCount,
  countryCount,
  pipelineCount,
  fiberCableCount,
  militaryAmericanCount,
  militaryNonAmericanCount,
  airTrafficCount,
  airTrafficMilitaryCount,
  rocketLaunchCount,
  carrierStrikeGroupCount,
  csgActiveSources,
  csgTotalSources,
  csgAverageConfidence,
  quakeStale,
  error,
}: StatusPanelProps) {
  const [statusCollapsed, setStatusCollapsed] = useState(false);
  const [showPanelControlVisible, setShowPanelControlVisible] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<LayerCategoryId, boolean>>({
    core: false,
    natural: false,
    aviation: false,
    maritime: false,
    defense: false,
  });
  const idleTimerRef = useRef<number | null>(null);
  const grayscalePresets = ["#f9fafb", "#e5e7eb", "#d1d5db", "#9ca3af", "#4b5563"];
  const panelTextColor = textColorForHex(panelColor);
  const localHeader = formatLocalHeader(utcNow);
  const utcHeader = formatUtcHeader(utcNow);
  const layerCategories: LayerCategory[] = [
    {
      id: "core",
      title: "Core & Reference",
      items: [
        { key: "terminator", label: "Terminator", icon: "🌙" },
        { key: "sunAnalemma", label: "Sun Analemma", icon: "☀️" },
        { key: "majorCities", label: "Major Cities", icon: "🏙️" },
        { key: "countryProfiles", label: "Country Profiles", icon: "🗺️" },
      ],
    },
    {
      id: "natural",
      title: "Natural Hazards",
      items: [
        { key: "earthquakes", label: "Earthquakes", icon: "💥" },
        { key: "weatherRadar", label: "Weather Radar", icon: "🌧️" },
        { key: "airQuality", label: "Air Quality", icon: "🌫️" },
        { key: "volcanoes", label: "Active Volcanic Eruptions", icon: "🌋" },
        { key: "tropicalStorms", label: "Active Hurricanes/Tropical Storms", icon: "🌀" },
        { key: "tsunamiWarnings", label: "Active Tsunami Warnings", icon: "🌊" },
      ],
    },
    {
      id: "aviation",
      title: "Aviation & Airspace",
      items: [
        { key: "airTrafficCivilian", label: "Civilian Flights", icon: "✈️" },
        { key: "airTrafficMilitary", label: "Military Flights", icon: "🛩️" },
        { key: "flightCorridors", label: "Air Traffic Corridors", icon: "🧭" },
        { key: "tfr", label: "Temporary Flight Restrictions", icon: "🚫" },
      ],
    },
    {
      id: "maritime",
      title: "Maritime & Infrastructure",
      items: [
        { key: "shippingLanes", label: "Global Shipping Lanes", icon: "🛳️" },
        { key: "oilPipelines", label: "Oil Pipelines", icon: "🛢️" },
        { key: "fiberCables", label: "Fiber Cables (Undersea)", icon: "🔌" },
      ],
    },
    {
      id: "defense",
      title: "Defense & Space",
      items: [
        { key: "militaryBases", label: "Military Bases", icon: "🛡️", showBaseLegend: true },
        { key: "carrierStrikeGroups", label: "Carrier Strike Groups (Estimated)", icon: "🚢" },
        { key: "issTracker", label: "ISS Tracker", icon: "🛰️" },
        { key: "rocketLaunches", label: "Rocket Launches (last/next 24h)", icon: "🚀" },
      ],
    },
  ];

  const handleToggleCategoryCollapse = (id: LayerCategoryId) => {
    setCollapsedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setCategoryLayers = (keys: Array<keyof LayerToggleState>, next: boolean) => {
    for (const key of keys) {
      onToggle(key, next);
    }
  };

  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const startIdleTimer = () => {
      clearIdleTimer();
      idleTimerRef.current = window.setTimeout(() => {
        setShowPanelControlVisible(false);
      }, 1800);
    };

    const handlePointerActivity = () => {
      if (!collapsed) {
        return;
      }
      setShowPanelControlVisible(true);
      startIdleTimer();
    };

    if (!collapsed) {
      clearIdleTimer();
      setShowPanelControlVisible(true);
      return () => {
        clearIdleTimer();
      };
    }

    setShowPanelControlVisible(true);
    startIdleTimer();
    window.addEventListener("mousemove", handlePointerActivity);
    window.addEventListener("pointermove", handlePointerActivity);

    return () => {
      clearIdleTimer();
      window.removeEventListener("mousemove", handlePointerActivity);
      window.removeEventListener("pointermove", handlePointerActivity);
    };
  }, [collapsed]);

  return (
    <aside
      className={`status-panel${stealthMode ? " status-panel-stealth" : ""}${collapsed ? " status-panel-collapsed" : ""}`}
      style={{
        backgroundColor: stealthMode ? "#000000" : panelColor,
        color: stealthMode ? "#d1fae5" : panelTextColor,
      }}
    >
      <h1>World Clock Plus</h1>
      <p className="toolbar-clock">Local {localHeader.date} {localHeader.time}</p>
      <p className="toolbar-clock">UTC {utcHeader.date} {utcHeader.time}</p>
      <div className="panel-top-row">
        <button
          type="button"
          className={`panel-collapse-btn${collapsed && !showPanelControlVisible ? " panel-control-hidden" : ""}`}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? "Expand Panel" : "Hide Panel"}
        </button>
      </div>
      {collapsed ? null : (
        <>

      <section>
        <h2>Quick</h2>
        <div className="quick-toggle-row">
          <button type="button" onClick={() => onSetAllLayers(true)}>All On</button>
          <button type="button" onClick={() => onSetAllLayers(false)}>All Off</button>
        </div>
        <div className="quick-toggle-row">
          <button
            type="button"
            className={stealthMode ? "quick-toggle-active" : ""}
            onClick={() => onStealthModeChange(!stealthMode)}
          >
            {stealthMode ? "Stealth On" : "Stealth Off"}
          </button>
        </div>
        <div className="panel-color-row">
          <label htmlFor="panel-color-picker">Overlay color</label>
          <input
            id="panel-color-picker"
            type="color"
            value={panelColor}
            onChange={(event) => onPanelColorChange(event.target.value)}
          />
        </div>
        <div className="panel-color-presets">
          {grayscalePresets.map((preset) => (
            <button
              key={preset}
              type="button"
              className="panel-color-preset"
              style={{ backgroundColor: preset }}
              onClick={() => onPanelColorChange(preset)}
              title={preset}
            />
          ))}
        </div>
        <div className="brightness-row">
          <label htmlFor="global-brightness-slider">Brightness</label>
          <div className="brightness-control">
            <input
              id="global-brightness-slider"
              type="range"
              min={20}
              max={100}
              step={1}
              value={brightnessPercent}
              onChange={(event) => onBrightnessChange(Number(event.target.value))}
            />
            <span>{brightnessPercent}%</span>
          </div>
        </div>
        <label>
          <input
            type="checkbox"
            checked={stockTickerEnabled}
            onChange={(event) => onStockTickerEnabledChange(event.target.checked)}
          />
          Stock Ticker
        </label>
      </section>

      <section>
        <h2>Layers</h2>
        {layerCategories.map((category) => {
          const categoryCollapsed = collapsedCategories[category.id];
          const keys = category.items.map((item) => item.key);

          return (
            <div key={category.id} className="layer-category">
              <div className="layer-category-header">
                <button
                  type="button"
                  className="layer-category-toggle"
                  onClick={() => handleToggleCategoryCollapse(category.id)}
                >
                  {categoryCollapsed ? "▸" : "▾"} {category.title}
                </button>
                <div className="layer-category-actions">
                  <button type="button" onClick={() => setCategoryLayers(keys, true)}>All On</button>
                  <button type="button" onClick={() => setCategoryLayers(keys, false)}>All Off</button>
                </div>
              </div>
              {categoryCollapsed ? null : (
                <div className="layer-category-body">
                  {category.items.map((item) => (
                    <label key={item.key}>
                      <input
                        type="checkbox"
                        checked={toggles[item.key]}
                        onChange={(event) => onToggle(item.key, event.target.checked)}
                      />
                      <span className="layer-key-icon" aria-hidden="true">{item.icon}</span>
                      {item.label}
                      {item.showBaseLegend ? (
                        <>
                          <span className="legend-dot legend-us" />
                          US
                          <span className="legend-dot legend-non-us" />
                          Non-US
                        </>
                      ) : null}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <div className="status-section-header">
          <h2>Status</h2>
          <button type="button" className="section-collapse-btn" onClick={() => setStatusCollapsed((prev) => !prev)}>
            {statusCollapsed ? "Show" : "Hide"}
          </button>
        </div>
        {statusCollapsed ? null : (
          <>
            <p>UTC now: {utcNow}</p>
            <p>Major cities: {cityCount}</p>
            <p>Country profiles: {countryCount}</p>
            <p>Earthquakes: {quakeCount} events</p>
            <p>Shipping lanes: {shippingLaneCount}</p>
            <p>Flight corridors: {flightCorridorCount}</p>
            <p>TFR zones: {tfrCount}</p>
            <p>Active volcanoes: {volcanoCount}</p>
            <p>Tropical systems: {tropicalStormCount}</p>
            <p>Tsunami warnings: {tsunamiWarningCount}</p>
            <p>Oil pipelines: {pipelineCount}</p>
            <p>Fiber cable segments: {fiberCableCount}</p>
            <p>US military bases: {militaryAmericanCount}</p>
            <p>Non-US military bases: {militaryNonAmericanCount}</p>
            <p>Civilian flights: {airTrafficCount}</p>
            <p>Military flights: {airTrafficMilitaryCount}</p>
            <p>Rocket launches (48h): {rocketLaunchCount}</p>
            <p>Carrier strike groups: {carrierStrikeGroupCount}</p>
            <p>CSG active sources: {csgActiveSources}/{csgTotalSources}</p>
            <p>CSG avg confidence: {csgAverageConfidence}/100</p>
            <p>Major cities refresh: {formatIso(refreshTimes.majorCities)}</p>
            <p>Country profiles refresh: {formatIso(refreshTimes.countryProfiles)}</p>
            <p>Military bases refresh: {formatIso(refreshTimes.militaryBases)}</p>
            <p>Earthquake refresh: {formatIso(refreshTimes.earthquakes)}</p>
            <p>Pipelines refresh: {formatIso(refreshTimes.oilPipelines)}</p>
            <p>Fiber refresh: {formatIso(refreshTimes.fiberCables)}</p>
            <p>Air traffic refresh: {formatIso(refreshTimes.airTraffic)}</p>
            <p>Sun analemma refresh: {formatIso(refreshTimes.sunAnalemma)}</p>
            <p>Weather radar refresh: {formatIso(refreshTimes.weatherRadar)}</p>
            <p>Air quality refresh: {formatIso(refreshTimes.airQuality)}</p>
            <p>Shipping lanes refresh: {formatIso(refreshTimes.shippingLanes)}</p>
            <p>Flight corridors refresh: {formatIso(refreshTimes.flightCorridors)}</p>
            <p>TFR refresh: {formatIso(refreshTimes.tfr)}</p>
            <p>Volcanoes refresh: {formatIso(refreshTimes.volcanoes)}</p>
            <p>Tropical storms refresh: {formatIso(refreshTimes.tropicalStorms)}</p>
            <p>Tsunami refresh: {formatIso(refreshTimes.tsunamiWarnings)}</p>
            <p>Rocket launches refresh: {formatIso(refreshTimes.rocketLaunches)}</p>
            <p>Carrier strike groups refresh: {formatIso(refreshTimes.carrierStrikeGroups)}</p>
            <p>ISS tracker refresh: {formatIso(refreshTimes.issTracker)}</p>
            <p>Terminator refresh: {formatIso(refreshTimes.terminator)}</p>
            {quakeStale ? <p className="warn">Earthquake feed is currently stale.</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </>
        )}
      </section>
        </>
      )}
    </aside>
  );
}
