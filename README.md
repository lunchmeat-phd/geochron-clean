# GeoChron MVP (Next.js + MapLibre)

## How to run
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Open `http://localhost:3000`

## What the MVP includes
- Next.js App Router + TypeScript setup.
- Full-screen MapLibre map using free Esri World Imagery satellite tiles.
- Earthquakes layer from USGS `all_day` GeoJSON feed.
- Weather radar layer from RainViewer public map tiles (no API key).
- Global air quality proxy heatmap layer from NASA GIBS MODIS aerosol tiles.
- Sun analemma line + live subsolar point marker.
- Live ISS tracker with a short trail and predicted ~90-minute orbit path.
- Magnitude-scaled earthquake circles with hover tooltip:
  - place
  - magnitude
  - time (UTC)
  - depth (km)
- Day/night terminator overlay (night polygon) that updates every 60 seconds.
- Layer toggles for Terminator, Sun Analemma, Earthquakes, Weather Radar, Air Quality, and ISS Tracker.
- Status panel with current UTC time + last refresh times.
- 60-second in-memory server cache for earthquake feed and stale-data fallback on errors.
- 5-second in-memory server cache for ISS position with stale-data fallback on errors.

## Layer extension structure
New layers follow the `src/layers/` pattern:
- Add a module in `src/layers/<layerName>.ts`.
- Export setup/update/visibility helpers as needed.
- Re-export from `src/layers/index.ts`.
- Connect toggle and refresh status from `src/components/MapView.tsx`.

Placeholders prepared:
- `src/layers/airTraffic.ts`
- `src/layers/ships.ts`

## Known limitations
- Terminator geometry is an MVP approximation and can show minor artifacts near date-line/poles.
- In-memory cache resets when the server restarts.
- Placeholder Air Traffic and Ships toggles are intentionally disabled (future providers TBD).
