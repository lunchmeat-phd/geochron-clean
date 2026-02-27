"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import {
  attachEarthquakeHoverTooltip,
  ensureAirQualityLayer,
  ensureBoundaryLayers,
  ensureEarthquakeLayer,
  ensureIssTrackerLayer,
  ensureSunAnalemmaLayer,
  ensureTerminatorLayer,
  ensureWeatherRadarLayer,
  fetchIssTracker,
  fetchEarthquakes,
  setIssTrackerVisibility,
  setSunAnalemmaVisibility,
  setEarthquakeData,
  setAirQualityVisibility,
  setEarthquakesVisibility,
  setTerminatorVisibility,
  setWeatherRadarVisibility,
  updateIssTrackerData,
  updateSunAnalemma,
  updateWeatherRadarLayer,
  updateTerminator,
  type LayerToggleState,
  type RefreshTimes,
} from "@/layers";
import type { UsgsEarthquakeCollection } from "@/lib/earthquakes";
import { StatusPanel } from "@/components/StatusPanel";

const DEFAULT_TOGGLES: LayerToggleState = {
  terminator: true,
  sunAnalemma: true,
  earthquakes: true,
  weatherRadar: true,
  airQuality: false,
  issTracker: false,
  airTraffic: false,
  ships: false,
};

function createBaseStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution:
          "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
    },
    layers: [
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
      },
    ],
  };
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  const [toggles, setToggles] = useState<LayerToggleState>(DEFAULT_TOGGLES);
  const [refreshTimes, setRefreshTimes] = useState<RefreshTimes>({});
  const [utcNow, setUtcNow] = useState("—");
  const [quakeCount, setQuakeCount] = useState(0);
  const [quakeStale, setQuakeStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earthquakeData, setEarthquakeDataState] = useState<UsgsEarthquakeCollection | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const style = useMemo(() => createBaseStyle(), []);

  useEffect(() => {
    setUtcNow(new Date().toISOString());
    const tick = window.setInterval(() => {
      setUtcNow(new Date().toISOString());
    }, 1000);

    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [0, 12],
      zoom: 1.5,
      minZoom: 1,
      maxZoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.on("error", (event) => {
      const message = event.error?.message ?? "Map rendering error";
      setError(message);
    });

    map.on("load", () => {
      setMapReady(true);
      const safeRun = (fn: () => void) => {
        try {
          fn();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Layer initialization error");
        }
      };

      safeRun(() => ensureEarthquakeLayer(map));
      safeRun(() => ensureTerminatorLayer(map));
      safeRun(() => ensureSunAnalemmaLayer(map));
      safeRun(() => ensureWeatherRadarLayer(map));
      safeRun(() => ensureAirQualityLayer(map));
      safeRun(() => ensureBoundaryLayers(map));

      safeRun(() => setEarthquakesVisibility(map, DEFAULT_TOGGLES.earthquakes));
      safeRun(() => setTerminatorVisibility(map, DEFAULT_TOGGLES.terminator));
      safeRun(() => setSunAnalemmaVisibility(map, DEFAULT_TOGGLES.sunAnalemma));
      safeRun(() => setWeatherRadarVisibility(map, DEFAULT_TOGGLES.weatherRadar));
      safeRun(() => setAirQualityVisibility(map, DEFAULT_TOGGLES.airQuality));

      const terminateAt = updateTerminator(map);
      const sunAt = updateSunAnalemma(map);
      setRefreshTimes((prev) => ({ ...prev, terminator: terminateAt, sunAnalemma: sunAt }));
    });

    mapRef.current = map;

    let cleanupTooltip: (() => void) | null = null;

    map.on("load", () => {
      cleanupTooltip = attachEarthquakeHoverTooltip(map);
    });

    return () => {
      setMapReady(false);
      if (cleanupTooltip) {
        cleanupTooltip();
      }
      map.remove();
      mapRef.current = null;
    };
  }, [style]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    setEarthquakesVisibility(map, toggles.earthquakes);
    setTerminatorVisibility(map, toggles.terminator);
    setSunAnalemmaVisibility(map, toggles.sunAnalemma);
    setWeatherRadarVisibility(map, toggles.weatherRadar);
    setAirQualityVisibility(map, toggles.airQuality);
    setIssTrackerVisibility(map, toggles.issTracker);
  }, [toggles.earthquakes, toggles.terminator, toggles.sunAnalemma, toggles.weatherRadar, toggles.airQuality, toggles.issTracker]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady || !earthquakeData) {
      return;
    }

    setEarthquakeData(map, earthquakeData);
  }, [earthquakeData, mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const refreshTerminator = () => {
      const updatedAt = updateTerminator(map);
      setRefreshTimes((prev) => ({ ...prev, terminator: updatedAt }));
    };

    refreshTerminator();

    const interval = window.setInterval(refreshTerminator, 60_000);

    return () => window.clearInterval(interval);
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const refreshSun = () => {
      const updatedAt = updateSunAnalemma(map);
      setRefreshTimes((prev) => ({ ...prev, sunAnalemma: updatedAt }));
    };

    refreshSun();
    const interval = window.setInterval(refreshSun, 60_000);

    return () => window.clearInterval(interval);
  }, [mapReady]);

  useEffect(() => {
    let isActive = true;

    const pullEarthquakes = async () => {
      try {
        const payload = await fetchEarthquakes();

        if (!isActive) {
          return;
        }

        setEarthquakeDataState(payload.data);
        setQuakeCount(payload.data.features.length);
        setQuakeStale(payload.stale);
        setError(payload.error ?? null);
        setRefreshTimes((prev) => ({ ...prev, earthquakes: payload.fetchedAt }));
      } catch (err) {
        if (!isActive) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to fetch earthquakes");
      }
    };

    pullEarthquakes();

    const interval = window.setInterval(pullEarthquakes, 60_000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    let active = true;

    const refreshRadar = async () => {
      try {
        const refreshedAt = await updateWeatherRadarLayer(map);
        if (!active) {
          return;
        }
        setRefreshTimes((prev) => ({ ...prev, weatherRadar: refreshedAt }));
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch weather radar");
      }
    };

    refreshRadar();
    const interval = window.setInterval(refreshRadar, 5 * 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !toggles.issTracker) {
      return;
    }

    let active = true;

    try {
      ensureIssTrackerLayer(map);
      setIssTrackerVisibility(map, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize ISS layer");
      return;
    }

    const refreshIss = async () => {
      try {
        const payload = await fetchIssTracker();
        if (!active) {
          return;
        }

        updateIssTrackerData(map, payload.data.longitude, payload.data.latitude, payload.orbit);
        setRefreshTimes((prev) => ({ ...prev, issTracker: payload.fetchedAt }));
        if (payload.error) {
          setError(payload.error);
        } else {
          setError(null);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch ISS position");
      }
    };

    refreshIss();
    const interval = window.setInterval(refreshIss, 10_000);

    return () => {
      active = false;
      window.clearInterval(interval);
      setIssTrackerVisibility(map, false);
    };
  }, [mapReady, toggles.issTracker]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    const markRefresh = () => {
      setRefreshTimes((prev) => ({ ...prev, airQuality: new Date().toISOString() }));
    };

    markRefresh();
    const interval = window.setInterval(markRefresh, 10 * 60_000);

    return () => window.clearInterval(interval);
  }, [mapReady]);

  const handleToggle = (key: keyof LayerToggleState, next: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <main className="map-shell">
      <div ref={containerRef} className="map-container" />
      <StatusPanel
        toggles={toggles}
        onToggle={handleToggle}
        utcNow={utcNow}
        refreshTimes={refreshTimes}
        quakeCount={quakeCount}
        quakeStale={quakeStale}
        error={error}
      />
    </main>
  );
}
