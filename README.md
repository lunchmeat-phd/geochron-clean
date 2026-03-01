# GeoChron MVP (Next.js + MapLibre)

## How to run
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Open `http://localhost:3000`

### Stable run modes
- Clean dev start (resets Next cache): `npm run dev:clean`
- Production-like local run (no HMR): `npm run start:prod`

## What the MVP includes
- Next.js App Router + TypeScript setup.
- Full-screen MapLibre map using free Esri World Imagery satellite tiles.
- Earthquakes layer from USGS `all_day` GeoJSON feed.
- Weather radar layer from RainViewer public map tiles (no API key).
- Global air quality proxy heatmap layer from NASA GIBS MODIS aerosol tiles.
- Global oil pipeline line layer (ArcGIS public dataset).
- Global fiber optic submarine cable line layer (ArcGIS Global TeleComm dataset).
- Major cities dot layer (Natural Earth populated places).
- Military bases layer with U.S. vs non-U.S. color split:
  - U.S.-affiliated installations from NTAD (DoD)
  - Non-U.S. installations from OpenStreetMap military tagging
- Sun analemma line + live subsolar point marker.
- Live ISS tracker with a short trail and predicted ~90-minute orbit path.
- Rocket launches layer for events in the last 24 hours and next 24 hours (SpaceX, ULA, Rocket Lab, and others).
- ADS-B air traffic overlay with zoom-based loading and military-model priority.
- AIS ships overlay with hover details (MMSI/name/class/speed/course/etc.) and 60-second cache.
- Magnitude-scaled earthquake circles with hover tooltip:
  - place
  - magnitude
  - time (UTC)
  - depth (km)
- Day/night terminator overlay (night polygon) that updates every 60 seconds.
- Layer toggles for Terminator, Sun Analemma, Major Cities, Country Profiles, Earthquakes, Weather Radar, Air Quality, Oil Pipelines, Fiber Cables, Military Bases, ISS Tracker, Rocket Launches (±24h), split Civilian/Military flights, and Ships/AIS.
- Status panel with current UTC time + last refresh times.
- 60-second in-memory server cache for earthquake feed and stale-data fallback on errors.
- 5-second in-memory server cache for ISS position with stale-data fallback on errors.
- 6-hour in-memory server cache for infrastructure layers (pipelines/cables) with stale-data fallback on errors.

## Layer extension structure
New layers follow the `src/layers/` pattern:
- Add a module in `src/layers/<layerName>.ts`.
- Export setup/update/visibility helpers as needed.
- Re-export from `src/layers/index.ts`.
- Connect toggle and refresh status from `src/components/MapView.tsx`.

Future placeholders:
- `src/layers/airTraffic.ts` (for alternate providers and richer metadata)

## Known limitations
- Terminator geometry is an MVP approximation and can show minor artifacts near date-line/poles.
- In-memory cache resets when the server restarts.
- Fiber layer currently uses submarine cable routes; terrestrial fiber backbone coverage is not yet included.
- Non-U.S. military installations depend on live OSM/Overpass responses and may be sparse or temporarily unavailable when upstream rate-limited.
- Ships/AIS source currently covers the Baltic/Nordic area (Digitraffic view), not full global vessel coverage.
- Launch data comes from Launch Library 2; coverage and launch timing precision depend on upstream updates.
