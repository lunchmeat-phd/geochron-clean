"use client";

import type { LayerToggleState, RefreshTimes } from "@/layers";

type StatusPanelProps = {
  toggles: LayerToggleState;
  onToggle: (key: keyof LayerToggleState, next: boolean) => void;
  onSetAllLayers: (next: boolean) => void;
  panelColor: string;
  onPanelColorChange: (next: string) => void;
  brightnessPercent: number;
  onBrightnessChange: (next: number) => void;
  utcNow: string;
  refreshTimes: RefreshTimes;
  quakeCount: number;
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

function formatIso(value?: string): string {
  if (!value) {
    return "Never";
  }

  return value;
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
  toggles,
  onToggle,
  onSetAllLayers,
  panelColor,
  onPanelColorChange,
  brightnessPercent,
  onBrightnessChange,
  utcNow,
  refreshTimes,
  quakeCount,
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
  const grayscalePresets = ["#f9fafb", "#e5e7eb", "#d1d5db", "#9ca3af", "#4b5563"];
  const panelTextColor = textColorForHex(panelColor);

  return (
    <aside className="status-panel" style={{ backgroundColor: panelColor, color: panelTextColor }}>
      <h1>GeoChron MVP</h1>

      <section>
        <h2>Quick</h2>
        <div className="quick-toggle-row">
          <button type="button" onClick={() => onSetAllLayers(true)}>All On</button>
          <button type="button" onClick={() => onSetAllLayers(false)}>All Off</button>
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
      </section>

      <section>
        <h2>Layers</h2>
        <label>
          <input
            type="checkbox"
            checked={toggles.terminator}
            onChange={(event) => onToggle("terminator", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🌙</span>
          Terminator
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.sunAnalemma}
            onChange={(event) => onToggle("sunAnalemma", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">☀️</span>
          Sun Analemma
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.majorCities}
            onChange={(event) => onToggle("majorCities", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🏙️</span>
          Major Cities
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.countryProfiles}
            onChange={(event) => onToggle("countryProfiles", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🗺️</span>
          Country Profiles
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.earthquakes}
            onChange={(event) => onToggle("earthquakes", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">💥</span>
          Earthquakes
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.weatherRadar}
            onChange={(event) => onToggle("weatherRadar", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🌧️</span>
          Weather Radar
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.airQuality}
            onChange={(event) => onToggle("airQuality", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🌫️</span>
          Air Quality
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.oilPipelines}
            onChange={(event) => onToggle("oilPipelines", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🛢️</span>
          Oil Pipelines
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.fiberCables}
            onChange={(event) => onToggle("fiberCables", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🔌</span>
          Fiber Cables (Undersea)
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.militaryBases}
            onChange={(event) => onToggle("militaryBases", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🛡️</span>
          Military Bases
          <span className="legend-dot legend-us" />
          US
          <span className="legend-dot legend-non-us" />
          Non-US
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.issTracker}
            onChange={(event) => onToggle("issTracker", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🛰️</span>
          ISS Tracker
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.rocketLaunches}
            onChange={(event) => onToggle("rocketLaunches", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🚀</span>
          Rocket Launches (last/next 24h)
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.carrierStrikeGroups}
            onChange={(event) => onToggle("carrierStrikeGroups", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🚢</span>
          Carrier Strike Groups (Estimated)
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.airTrafficCivilian}
            onChange={(event) => onToggle("airTrafficCivilian", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">✈️</span>
          Civilian Flights
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.airTrafficMilitary}
            onChange={(event) => onToggle("airTrafficMilitary", event.target.checked)}
          />
          <span className="layer-key-icon" aria-hidden="true">🛩️</span>
          Military Flights
        </label>
      </section>

      <section>
        <h2>Status</h2>
        <p>UTC now: {utcNow}</p>
        <p>Major cities: {cityCount}</p>
        <p>Country profiles: {countryCount}</p>
        <p>Earthquakes: {quakeCount} events</p>
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
        <p>Rocket launches refresh: {formatIso(refreshTimes.rocketLaunches)}</p>
        <p>Carrier strike groups refresh: {formatIso(refreshTimes.carrierStrikeGroups)}</p>
        <p>ISS tracker refresh: {formatIso(refreshTimes.issTracker)}</p>
        <p>Terminator refresh: {formatIso(refreshTimes.terminator)}</p>
        {quakeStale ? <p className="warn">Earthquake feed is currently stale.</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </aside>
  );
}
