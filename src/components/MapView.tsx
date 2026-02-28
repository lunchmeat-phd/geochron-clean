"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import {
  attachAirTrafficHoverTooltip,
  attachEarthquakeHoverTooltip,
  attachCountryProfilesHoverTooltip,
  attachMajorCityHoverTooltip,
  attachMilitaryBasesHoverTooltip,
  ensureAirQualityLayer,
  ensureAirTrafficLayer,
  ensureBoundaryLayers,
  ensureCountryProfilesLayer,
  ensureEarthquakeLayer,
  ensureFiberCablesLayer,
  ensureIssTrackerLayer,
  ensureMajorCitiesLayer,
  ensureMilitaryBasesLayer,
  ensureOilPipelinesLayer,
  ensureSunAnalemmaLayer,
  ensureTerminatorLayer,
  ensureWeatherRadarLayer,
  fetchCountryProfiles,
  fetchFiberCables,
  fetchAirTraffic,
  fetchIssTracker,
  fetchMilitaryBases,
  fetchEarthquakes,
  fetchOilPipelines,
  setFiberCablesVisibility,
  setCivilianAirTrafficVisibility,
  setCountryProfilesVisibility,
  setIssTrackerVisibility,
  setMajorCitiesVisibility,
  setMilitaryAirTrafficVisibility,
  setMilitaryBasesVisibility,
  setOilPipelinesVisibility,
  setSunAnalemmaVisibility,
  setEarthquakeData,
  setAirQualityVisibility,
  setEarthquakesVisibility,
  setTerminatorVisibility,
  setWeatherRadarVisibility,
  updateAirTrafficData,
  updateCountryProfilesData,
  updateFiberCablesData,
  updateIssTrackerData,
  updateMilitaryBasesData,
  updateOilPipelinesData,
  updateSunAnalemma,
  updateWeatherRadarLayer,
  updateTerminator,
  type LayerToggleState,
  type RefreshTimes,
} from "@/layers";
import type { UsgsEarthquakeCollection } from "@/lib/earthquakes";
import { isMilitaryAircraftModel } from "@/lib/military";
import { StatusPanel } from "@/components/StatusPanel";

const DEFAULT_TOGGLES: LayerToggleState = {
  terminator: true,
  sunAnalemma: true,
  majorCities: true,
  countryProfiles: false,
  earthquakes: true,
  weatherRadar: true,
  airQuality: false,
  oilPipelines: true,
  fiberCables: true,
  militaryBases: false,
  issTracker: false,
  airTrafficCivilian: false,
  airTrafficMilitary: true,
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
  const [cityCount, setCityCount] = useState(0);
  const [countryCount, setCountryCount] = useState(0);
  const [quakeCount, setQuakeCount] = useState(0);
  const [pipelineCount, setPipelineCount] = useState(0);
  const [fiberCableCount, setFiberCableCount] = useState(0);
  const [militaryAmericanCount, setMilitaryAmericanCount] = useState(0);
  const [militaryNonAmericanCount, setMilitaryNonAmericanCount] = useState(0);
  const [airTrafficCount, setAirTrafficCount] = useState(0);
  const [airTrafficMilitaryCount, setAirTrafficMilitaryCount] = useState(0);
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
      safeRun(() => ensureOilPipelinesLayer(map));
      safeRun(() => ensureFiberCablesLayer(map));
      safeRun(() => ensureMilitaryBasesLayer(map));
      safeRun(() => ensureAirTrafficLayer(map));
      safeRun(() => ensureBoundaryLayers(map));
      safeRun(() => ensureMajorCitiesLayer(map));
      safeRun(() => ensureCountryProfilesLayer(map));

      safeRun(() => setEarthquakesVisibility(map, DEFAULT_TOGGLES.earthquakes));
      safeRun(() => setTerminatorVisibility(map, DEFAULT_TOGGLES.terminator));
      safeRun(() => setSunAnalemmaVisibility(map, DEFAULT_TOGGLES.sunAnalemma));
      safeRun(() => setMajorCitiesVisibility(map, DEFAULT_TOGGLES.majorCities));
      safeRun(() => setCountryProfilesVisibility(map, DEFAULT_TOGGLES.countryProfiles));
      safeRun(() => setWeatherRadarVisibility(map, DEFAULT_TOGGLES.weatherRadar));
      safeRun(() => setAirQualityVisibility(map, DEFAULT_TOGGLES.airQuality));
      safeRun(() => setOilPipelinesVisibility(map, DEFAULT_TOGGLES.oilPipelines));
      safeRun(() => setFiberCablesVisibility(map, DEFAULT_TOGGLES.fiberCables));
      safeRun(() => setMilitaryBasesVisibility(map, DEFAULT_TOGGLES.militaryBases));
      safeRun(() => setCivilianAirTrafficVisibility(map, DEFAULT_TOGGLES.airTrafficCivilian));
      safeRun(() => setMilitaryAirTrafficVisibility(map, DEFAULT_TOGGLES.airTrafficMilitary));

      const terminateAt = updateTerminator(map);
      const sunAt = updateSunAnalemma(map);
      setRefreshTimes((prev) => ({ ...prev, terminator: terminateAt, sunAnalemma: sunAt }));
    });

    mapRef.current = map;

    const cleanups: Array<() => void> = [];

    map.on("load", () => {
      cleanups.push(attachEarthquakeHoverTooltip(map));
      cleanups.push(attachMajorCityHoverTooltip(map));
    });

    return () => {
      setMapReady(false);
      cleanups.forEach((cleanup) => cleanup());
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
    setMajorCitiesVisibility(map, toggles.majorCities);
    setCountryProfilesVisibility(map, toggles.countryProfiles);
    setWeatherRadarVisibility(map, toggles.weatherRadar);
    setAirQualityVisibility(map, toggles.airQuality);
    setOilPipelinesVisibility(map, toggles.oilPipelines);
    setFiberCablesVisibility(map, toggles.fiberCables);
    setMilitaryBasesVisibility(map, toggles.militaryBases);
    setCivilianAirTrafficVisibility(map, toggles.airTrafficCivilian);
    setMilitaryAirTrafficVisibility(map, toggles.airTrafficMilitary);
    setIssTrackerVisibility(map, toggles.issTracker);
  }, [
    toggles.earthquakes,
    toggles.terminator,
    toggles.sunAnalemma,
    toggles.majorCities,
    toggles.countryProfiles,
    toggles.weatherRadar,
    toggles.airQuality,
    toggles.oilPipelines,
    toggles.fiberCables,
    toggles.militaryBases,
    toggles.airTrafficCivilian,
    toggles.airTrafficMilitary,
    toggles.issTracker,
  ]);

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
    if (!map || !mapReady || !toggles.oilPipelines) {
      return;
    }

    let active = true;
    let delayTimer: number | null = null;

    const refreshPipelines = async () => {
      try {
        const payload = await fetchOilPipelines(map);
        if (!active) {
          return;
        }

        updateOilPipelinesData(map, payload.data);
        setPipelineCount(payload.data.features.length);
        setRefreshTimes((prev) => ({ ...prev, oilPipelines: payload.fetchedAt }));
        if (payload.error) {
          setError(payload.error);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch pipeline data");
      }
    };

    const scheduleRefresh = () => {
      if (delayTimer) {
        window.clearTimeout(delayTimer);
      }
      delayTimer = window.setTimeout(() => {
        void refreshPipelines();
      }, 350);
    };

    void refreshPipelines();
    map.on("zoomend", scheduleRefresh);
    map.on("moveend", scheduleRefresh);
    const interval = window.setInterval(refreshPipelines, 10 * 60_000);

    return () => {
      active = false;
      if (delayTimer) {
        window.clearTimeout(delayTimer);
      }
      map.off("zoomend", scheduleRefresh);
      map.off("moveend", scheduleRefresh);
      window.clearInterval(interval);
      setPipelineCount(0);
    };
  }, [mapReady, toggles.oilPipelines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !toggles.fiberCables) {
      return;
    }

    let active = true;

    const refreshFiberCables = async () => {
      try {
        const payload = await fetchFiberCables();
        if (!active) {
          return;
        }

        updateFiberCablesData(map, payload.data);
        setFiberCableCount(payload.data.features.length);
        setRefreshTimes((prev) => ({ ...prev, fiberCables: payload.fetchedAt }));
        if (payload.error) {
          setError(payload.error);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch fiber cable data");
      }
    };

    void refreshFiberCables();
    const interval = window.setInterval(refreshFiberCables, 60 * 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
      setFiberCableCount(0);
    };
  }, [mapReady, toggles.fiberCables]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    let active = true;

    const pullCityCount = async () => {
      try {
        const response = await fetch(
          "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson",
          { cache: "force-cache" },
        );
        if (!response.ok) {
          throw new Error(`City source fetch failed (${response.status})`);
        }

        const payload = (await response.json()) as {
          features?: Array<{ properties?: Record<string, unknown> }>;
        };
        if (!active) {
          return;
        }

        const features = Array.isArray(payload.features) ? payload.features : [];
        const count = features.filter((feature) => {
          const props = feature.properties ?? {};
          const worldcity = props.worldcity;
          const scalerank = props.scalerank;
          const popMax = props.pop_max;

          return (
            worldcity === 1 ||
            (typeof scalerank === "number" && scalerank <= 2) ||
            (typeof popMax === "number" && popMax >= 3_000_000)
          );
        }).length;

        setCityCount(count);
        setRefreshTimes((prev) => ({ ...prev, majorCities: new Date().toISOString() }));
      } catch {
        if (active) {
          setCityCount(0);
        }
      }
    };

    void pullCityCount();

    return () => {
      active = false;
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !toggles.countryProfiles) {
      return;
    }

    let active = true;
    let cleanupHover: (() => void) | null = null;

    try {
      ensureCountryProfilesLayer(map);
      setCountryProfilesVisibility(map, true);
      cleanupHover = attachCountryProfilesHoverTooltip(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize country profiles layer");
      return;
    }

    const refreshCountryProfiles = async () => {
      try {
        const payload = await fetchCountryProfiles();
        if (!active) {
          return;
        }

        updateCountryProfilesData(map, payload.data);
        setCountryCount(payload.data.features.length);
        setRefreshTimes((prev) => ({ ...prev, countryProfiles: payload.fetchedAt }));
        if (payload.error) {
          setError(payload.error);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch country profile data");
      }
    };

    void refreshCountryProfiles();
    const interval = window.setInterval(refreshCountryProfiles, 6 * 60 * 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
      if (cleanupHover) {
        cleanupHover();
      }
      setCountryProfilesVisibility(map, false);
      setCountryCount(0);
    };
  }, [mapReady, toggles.countryProfiles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !toggles.militaryBases) {
      return;
    }

    let active = true;
    let delayTimer: number | null = null;
    let cleanupHover: (() => void) | null = null;

    try {
      ensureMilitaryBasesLayer(map);
      setMilitaryBasesVisibility(map, true);
      cleanupHover = attachMilitaryBasesHoverTooltip(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize military-base layer");
      return;
    }

    const refreshMilitaryBases = async () => {
      try {
        const payload = await fetchMilitaryBases(map);
        if (!active) {
          return;
        }

        updateMilitaryBasesData(map, payload.data);
        setMilitaryAmericanCount(payload.americanCount);
        setMilitaryNonAmericanCount(payload.nonAmericanCount);
        setRefreshTimes((prev) => ({ ...prev, militaryBases: payload.fetchedAt }));
        if (payload.error) {
          setError(payload.error);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch military-base data");
      }
    };

    const scheduleRefresh = () => {
      if (delayTimer) {
        window.clearTimeout(delayTimer);
      }
      delayTimer = window.setTimeout(() => {
        void refreshMilitaryBases();
      }, 400);
    };

    void refreshMilitaryBases();
    map.on("moveend", scheduleRefresh);
    map.on("zoomend", scheduleRefresh);
    const interval = window.setInterval(refreshMilitaryBases, 90_000);

    return () => {
      active = false;
      if (delayTimer) {
        window.clearTimeout(delayTimer);
      }
      map.off("moveend", scheduleRefresh);
      map.off("zoomend", scheduleRefresh);
      window.clearInterval(interval);
      if (cleanupHover) {
        cleanupHover();
      }
      setMilitaryBasesVisibility(map, false);
      setMilitaryAmericanCount(0);
      setMilitaryNonAmericanCount(0);
    };
  }, [mapReady, toggles.militaryBases]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || (!toggles.airTrafficCivilian && !toggles.airTrafficMilitary)) {
      return;
    }

    let active = true;
    let delayTimer: number | null = null;
    let cleanupHover: (() => void) | null = null;

    try {
      ensureAirTrafficLayer(map);
      setCivilianAirTrafficVisibility(map, toggles.airTrafficCivilian);
      setMilitaryAirTrafficVisibility(map, toggles.airTrafficMilitary);
      cleanupHover = attachAirTrafficHoverTooltip(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize air traffic layer");
      return;
    }

    const refreshAirTraffic = async () => {
      try {
        const payload = await fetchAirTraffic(map, {
          militaryOnly: map.getZoom() < 4 && toggles.airTrafficMilitary,
        });
        if (!active) {
          return;
        }

        updateAirTrafficData(map, payload.flights);
        const military = payload.flights.filter((flight) => isMilitaryAircraftModel(flight.t)).length;
        setAirTrafficMilitaryCount(military);
        setAirTrafficCount(payload.flights.length - military);
        setRefreshTimes((prev) => ({ ...prev, airTraffic: payload.fetchedAt }));
        if (payload.error) {
          setError(payload.error);
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to fetch air traffic");
      }
    };

    const scheduleRefresh = () => {
      if (delayTimer) {
        window.clearTimeout(delayTimer);
      }
      delayTimer = window.setTimeout(() => {
        void refreshAirTraffic();
      }, 350);
    };

    void refreshAirTraffic();
    map.on("moveend", scheduleRefresh);
    map.on("zoomend", scheduleRefresh);
    const interval = window.setInterval(() => {
      void refreshAirTraffic();
    }, 15_000);

    return () => {
      active = false;
      if (delayTimer) {
        window.clearTimeout(delayTimer);
      }
      map.off("moveend", scheduleRefresh);
      map.off("zoomend", scheduleRefresh);
      window.clearInterval(interval);
      if (cleanupHover) {
        cleanupHover();
      }
      setCivilianAirTrafficVisibility(map, false);
      setMilitaryAirTrafficVisibility(map, false);
      setAirTrafficCount(0);
      setAirTrafficMilitaryCount(0);
    };
  }, [mapReady, toggles.airTrafficCivilian, toggles.airTrafficMilitary]);

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

  const handleSetAllLayers = (next: boolean) => {
    setToggles((prev) => ({
      ...prev,
      terminator: next,
      sunAnalemma: next,
      majorCities: next,
      countryProfiles: next,
      earthquakes: next,
      weatherRadar: next,
      airQuality: next,
      oilPipelines: next,
      fiberCables: next,
      militaryBases: next,
      issTracker: next,
      airTrafficCivilian: next,
      airTrafficMilitary: next,
    }));
  };

  return (
    <main className="map-shell">
      <div ref={containerRef} className="map-container" />
      <StatusPanel
        toggles={toggles}
        onToggle={handleToggle}
        onSetAllLayers={handleSetAllLayers}
        utcNow={utcNow}
        refreshTimes={refreshTimes}
        cityCount={cityCount}
        countryCount={countryCount}
        quakeCount={quakeCount}
        pipelineCount={pipelineCount}
        fiberCableCount={fiberCableCount}
        militaryAmericanCount={militaryAmericanCount}
        militaryNonAmericanCount={militaryNonAmericanCount}
        airTrafficCount={airTrafficCount}
        airTrafficMilitaryCount={airTrafficMilitaryCount}
        quakeStale={quakeStale}
        error={error}
      />
    </main>
  );
}
