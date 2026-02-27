"use client";

import type { LayerToggleState, RefreshTimes } from "@/layers";

type StatusPanelProps = {
  toggles: LayerToggleState;
  onToggle: (key: keyof LayerToggleState, next: boolean) => void;
  utcNow: string;
  refreshTimes: RefreshTimes;
  quakeCount: number;
  quakeStale: boolean;
  error: string | null;
};

function formatIso(value?: string): string {
  if (!value) {
    return "Never";
  }

  return value;
}

export function StatusPanel({ toggles, onToggle, utcNow, refreshTimes, quakeCount, quakeStale, error }: StatusPanelProps) {
  return (
    <aside className="status-panel">
      <h1>GeoChron MVP</h1>

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
            checked={toggles.issTracker}
            onChange={(event) => onToggle("issTracker", event.target.checked)}
          />
          ISS Tracker
        </label>
        <label className="placeholder-toggle">
          <input
            type="checkbox"
            checked={toggles.airTraffic}
            disabled
            onChange={(event) => onToggle("airTraffic", event.target.checked)}
          />
          Air Traffic (placeholder)
        </label>
        <label className="placeholder-toggle">
          <input type="checkbox" checked={toggles.ships} disabled onChange={(event) => onToggle("ships", event.target.checked)} />
          Ships / AIS (placeholder)
        </label>
      </section>

      <section>
        <h2>Status</h2>
        <p>UTC now: {utcNow}</p>
        <p>Earthquakes: {quakeCount} events</p>
        <p>Earthquake refresh: {formatIso(refreshTimes.earthquakes)}</p>
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
