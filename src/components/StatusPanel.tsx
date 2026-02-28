"use client";

import type { LayerToggleState, RefreshTimes } from "@/layers";

type StatusPanelProps = {
  toggles: LayerToggleState;
  onToggle: (key: keyof LayerToggleState, next: boolean) => void;
  onSetAllLayers: (next: boolean) => void;
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
  quakeStale: boolean;
  error: string | null;
};

function formatIso(value?: string): string {
  if (!value) {
    return "Never";
  }

  return value;
}

export function StatusPanel({
  toggles,
  onToggle,
  onSetAllLayers,
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
  quakeStale,
  error,
}: StatusPanelProps) {
  return (
    <aside className="status-panel">
      <h1>GeoChron MVP</h1>

      <section>
        <h2>Quick</h2>
        <div className="quick-toggle-row">
          <button type="button" onClick={() => onSetAllLayers(true)}>All On</button>
          <button type="button" onClick={() => onSetAllLayers(false)}>All Off</button>
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
          Terminator
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.sunAnalemma}
            onChange={(event) => onToggle("sunAnalemma", event.target.checked)}
          />
          Sun Analemma
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.majorCities}
            onChange={(event) => onToggle("majorCities", event.target.checked)}
          />
          Major Cities
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.countryProfiles}
            onChange={(event) => onToggle("countryProfiles", event.target.checked)}
          />
          Country Profiles
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.earthquakes}
            onChange={(event) => onToggle("earthquakes", event.target.checked)}
          />
          Earthquakes
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.weatherRadar}
            onChange={(event) => onToggle("weatherRadar", event.target.checked)}
          />
          Weather Radar
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.airQuality}
            onChange={(event) => onToggle("airQuality", event.target.checked)}
          />
          Air Quality
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.oilPipelines}
            onChange={(event) => onToggle("oilPipelines", event.target.checked)}
          />
          Oil Pipelines
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.fiberCables}
            onChange={(event) => onToggle("fiberCables", event.target.checked)}
          />
          Fiber Cables (Undersea)
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.militaryBases}
            onChange={(event) => onToggle("militaryBases", event.target.checked)}
          />
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
          ISS Tracker
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.airTrafficCivilian}
            onChange={(event) => onToggle("airTrafficCivilian", event.target.checked)}
          />
          Civilian Flights
        </label>
        <label>
          <input
            type="checkbox"
            checked={toggles.airTrafficMilitary}
            onChange={(event) => onToggle("airTrafficMilitary", event.target.checked)}
          />
          Military Flights
        </label>
        <label className="placeholder-toggle">
          <input type="checkbox" checked={toggles.ships} disabled onChange={(event) => onToggle("ships", event.target.checked)} />
          Ships / AIS (placeholder)
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
        <p>ISS tracker refresh: {formatIso(refreshTimes.issTracker)}</p>
        <p>Terminator refresh: {formatIso(refreshTimes.terminator)}</p>
        {quakeStale ? <p className="warn">Earthquake feed is currently stale.</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </aside>
  );
}
