"use client";

import { useEffect, useState } from "react";
import type { UpcomingLaunch, UpcomingLaunchesApiResponse } from "@/lib/launches";

const MAX_LAUNCHES = 6;
const REFRESH_MS = 15 * 60_000;

type LaunchPanelProps = {
  theme: "classic" | "stealth" | "mahogany" | "evergreen" | "midnight";
};

function statusClass(abbrev: string | undefined, status: string): string {
  const value = (abbrev || status || "").toLowerCase();
  if (value.includes("go") || value.includes("success")) {
    return "launch-status-go";
  }
  if (value.includes("tbc") || value.includes("tbd") || value.includes("hold")) {
    return "launch-status-tbd";
  }
  return "launch-status-other";
}

// "T- 2d 04h 12m" (drops to minutes+seconds inside the final hour); "T+ …" once net has passed.
function formatCountdown(netIso: string, nowMs: number): string {
  const netMs = Date.parse(netIso);
  if (!Number.isFinite(netMs)) {
    return "TBD";
  }
  const diff = netMs - nowMs;
  const sign = diff >= 0 ? "T-" : "T+";
  let s = Math.floor(Math.abs(diff) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) {
    return `${sign} ${d}d ${pad(h)}h ${pad(m)}m`;
  }
  if (h > 0) {
    return `${sign} ${pad(h)}h ${pad(m)}m`;
  }
  return `${sign} ${pad(m)}m ${pad(s)}s`;
}

function formatNet(netIso: string): string {
  const d = new Date(netIso);
  if (Number.isNaN(d.getTime())) {
    return "Date TBD";
  }
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function LaunchPanel({ theme }: LaunchPanelProps) {
  const [open, setOpen] = useState(true);
  const [launches, setLaunches] = useState<UpcomingLaunch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Self-contained data fetch.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/launches-upcoming", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Launch feed failed (${res.status})`);
        }
        const payload = (await res.json()) as UpcomingLaunchesApiResponse;
        if (!active) {
          return;
        }
        setLaunches(payload.launches.slice(0, MAX_LAUNCHES));
        setStale(payload.stale);
        setError(payload.error ?? null);
        setLoaded(true);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Launch feed unavailable");
        setLoaded(true);
      }
    };
    void load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Own countdown tick — isolated to this component so MapView never re-renders.
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isStealth = theme === "stealth";

  if (!open) {
    return (
      <button
        type="button"
        className={`launch-reopen-btn launch-panel-theme-${theme}${isStealth ? " launch-panel-stealth" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Show upcoming launches"
      >
        🚀 Launches
      </button>
    );
  }

  return (
    <aside
      className={`launch-panel launch-panel-theme-${theme}${isStealth ? " launch-panel-stealth" : ""}`}
      aria-label="Upcoming rocket launches"
    >
      <div className="launch-panel-header">
        <span>🚀 Upcoming Launches</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide upcoming launches">
          Hide
        </button>
      </div>

      {!loaded ? (
        <p className="launch-empty">Loading launches…</p>
      ) : launches.length === 0 ? (
        <p className="launch-empty">{error ? `Unavailable: ${error}` : "No upcoming launches"}</p>
      ) : (
        <div className="launch-list">
          {launches.map((launch) => (
            <div key={launch.id} className="launch-row">
              <div className="launch-row-top">
                <span className="launch-name">{launch.name}</span>
                <span className={`launch-status ${statusClass(launch.statusAbbrev, launch.status)}`}>
                  {launch.statusAbbrev || launch.status}
                </span>
              </div>
              <div className="launch-countdown">{formatCountdown(launch.net, nowMs)}</div>
              <div className="launch-meta">
                {launch.provider}
                {launch.locationName ? ` · ${launch.locationName}` : ""}
              </div>
              <div className="launch-net">{formatNet(launch.net)}</div>
            </div>
          ))}
          {stale ? <p className="launch-cached">Showing cached data</p> : null}
        </div>
      )}
    </aside>
  );
}
