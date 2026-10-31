# Open Overlay

A Subway Builder mod that streams the **entire OpenRailwayMap vector dataset** from
[openrailwaymap.app](https://openrailwaymap.app) onto the in-game map — the same
data and styling as the website, drawn live as vector layers rather than as
pictures.

It follows the streaming approach of
[Orbital Surveyor](https://github.com/BarKuperman/orbital-surveyor): a small local
proxy fetches only the tiles for the area you are looking at, and the game loads
everything from that proxy.

## What you can see

Everything openrailwaymap.app publishes:

- **Tracks** – main lines, branches, metro, tram, light rail, monorail, funicular, sidings, yards, spurs, crossovers, tunnels and bridges, with names, refs and kilometre markers
- **Track colouring modes** – usage, maximum speed, train protection, electrification (voltage/frequency, maximum current, power), track gauge, loading gauge, track class, axle load, metre load, operator, routes, passenger lines, train radio
- **Stations** – station dots and labels (all zoom levels), grouped station areas, stop positions, entrances, interlockings; optionally coloured by operator
- **Platforms** – platform outlines and platform edges with refs
- **Switches** with refs
- **Signals** – main, distant, speed, train protection, electricity, station, radio, shunting and other signals with country-specific symbols
- **Points of interest** – facilities, equipment, level crossings, train protection, vacancy detection, electrical equipment, radio, operators
- **Electrification** – catenary masts/portals and substations
- **Signal boxes**
- **Lifecycle** – under construction, proposed, abandoned and razed infrastructure
- **Routes** – click a line, open *Details*, pick a route and its full path and stops are drawn on the map

Plus **satellite imagery** under the railway data (Google Satellite and Hybrid,
OpenStreetMap, and the official Google API with your own key), a **station search** (fly to any station in the OpenRailwayMap database) and a
**feature inspector** (click anything to see its OSM tags and details).

## Install

1. Install [Node.js](https://nodejs.org/) 18 or newer.
2. Put the mod folder in your Subway Builder mods folder (or install it through Railyard).
3. Set up the proxy to start and stop with the game (see below), or start it by hand.
4. Enable **Open Overlay** under *Settings → Mods*.
5. Open the **Open Overlay** panel in game and switch the overlay on.

### Start the proxy automatically with the game (recommended)

The game doesn't let mods start programs themselves, so the proxy is started next to the
game instead and **stops by itself when the game closes**. Nothing to open or close by hand,
and no console window on Windows.

**Steam** — right-click Subway Builder → *Properties* → *Launch Options*, and paste (with the
real path to the mod folder):

- Windows: `wscript "C:\full\path\to\mods\open-overlay\start-with-game.vbs" %command%`
- macOS / Linux: `"/full/path/to/mods/open-overlay/start-with-game.sh" %command%`

Then just press *Play* in Steam as usual. (Use *Open mods folder* in the mod panel to find the path.)

**Without the launch option** — double-click `start-with-game.vbs` (Windows),
`start-with-game.command` (macOS) or `start-with-game.sh` (Linux). It starts the proxy in the
background and then launches the game through Steam. If you don't have the Steam version, set
`SUBWAY_BUILDER_EXE` in `.env` to the game's path. You can put a shortcut to it on your desktop.

How it knows the game closed: it watches for a running Subway Builder process (on macOS/Linux
with the Steam launch option it watches the exact game process). It waits briefly in case the
game restarts itself (e.g. after enabling mods), and never stops while the game is still using it.
Without a visible window, the proxy's messages go to `logs/proxy.log` in the mod folder.

### Start the proxy by hand

Double-click the launcher for your OS and **leave the window open while you play**:

- Windows: `start-proxy-windows.cmd`
- macOS: `start-proxy-macos.command`
- Linux: `start-proxy-linux.sh`

On macOS/Linux you may first need `chmod +x` on the launcher. You can also run `node proxy.js` from a terminal.

The proxy listens on `http://127.0.0.1:8788` (Orbital Surveyor uses 8787, so both mods can run side by side).

## Using the panel

| Section | What it does |
| --- | --- |
| Satellite | Imagery on/off, provider, opacity, hide the game's own base map (buildings, water, parks, roads, airports, area labels) |
| OpenRailwayMap | Master switch, presets (Infrastructure, Speed, Train protection, Electrification, Track, Operator, Routes, Everything), track colouring mode, opacity |
| Infrastructure | Stations, platforms, switches, substations, catenaries, signal boxes, construction / proposed / abandoned / razed |
| Signals & POIs | Pick which signal and point-of-interest categories are drawn |
| Inspect & routes | Click-to-inspect features, load full details, draw a route |
| Find a station | Search by name or code and fly there |
| Display | Draw above or below your own tracks, light/dark/auto colours, station label style, station name language (automatic from your system like openrailwaymap.app, native only, or a custom code such as `en` or `ja-Latn,en`) |
| Proxy (always shown) | Proxy address, status, cache size, upstream errors, *Reload overlay* |

Settings are saved between sessions. Most data only appears once you are zoomed in
(e.g. platforms from zoom 15, signals from zoom 13, platform edges from zoom 17) —
exactly like openrailwaymap.app.

## Proxy settings

Copy `.env.example` to `.env` next to `proxy.js` and restart the proxy:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PROXY_PORT` | `8788` | Local port (change the address in the panel to match) |
| `ORM_CACHE_MB` | `256` | In-memory cache size |
| `ORM_MAX_CONCURRENT` | `8` | Maximum parallel requests to openrailwaymap.app |
| `ORM_UPSTREAM` | `https://openrailwaymap.app` | Use your own OpenRailwayMap-vector server instead |
| `ORM_CONTACT` | `mahyeung84@gmail.com` | Contact address in the User-Agent (asked for by OpenStreetMap's tile policy) |
| `ORM_USER_AGENT` | mod name + version + contact | Full User-Agent override |
| `ORM_REFERER` | this mod's GitHub page | Referer sent to openrailwaymap.app (required by its server — see below) |
| `SATELLITE_CACHE_MB` | `256` | In-memory imagery cache size |
| `GOOGLE_MAPS_API_KEY` | – | Enables Google satellite through the official Map Tiles API |

Proxy endpoints: `GET /health`, `/sat/:provider/:z/:x/:y`, `/orm/style.json`, `/orm/tilejson/:source`,
`/orm/tiles/:source/:z/:x/:y`, `/orm/sprite/...`, and a read-only subset of the
OpenRailwayMap API under `/orm/api/` (feature details, routes, route stops,
facility search, milestones).

## Satellite imagery

| Provider | Key needed | Notes |
| --- | --- | --- |
| Google Satellite / Google Hybrid (unofficial) | no | Default. Same keyless Google tiles as Orbital Surveyor — see the note below |
| OpenStreetMap | no | The standard OSM street map rather than imagery |
| Google Satellite | `GOOGLE_MAPS_API_KEY` in `.env` | Official Google Map Tiles API (Google Cloud project with billing). Follows Google's caching headers and shows the "Google Maps" credit with the copyright for the area on screen, as Google requires |

**About the keyless Google options:** they load tiles straight from Google's web-map
servers instead of the official Map Tiles API. Google's Maps terms don't allow that,
so Google may slow down or block these tiles at any time, and you use them at your
own risk. Unlike Orbital Surveyor, the proxy doesn't disguise itself as a web browser
for these requests; it sends the same honest User-Agent as everything else. If Google
starts refusing them, use the official Google option with your own key.

### Getting a Google Maps API key (for the official option)

1. **Google Cloud project with billing.** Sign in at [console.cloud.google.com](https://console.cloud.google.com/),
   create a project (e.g. "Subway Builder imagery"), then open *Billing* and link a billing
   account (a card is required even though normal play stays inside the free allowance).
2. **Enable the Map Tiles API.** In *APIs & Services → Library*, search for **Map Tiles API**
   and press *Enable*. Wait a few minutes before using it.
3. **Create the key.** Go to *Google Maps Platform → Keys & Credentials* (or *APIs & Services →
   Credentials*) → *Create credentials → API key*.
4. **Restrict it.** Edit the key: under *API restrictions* choose *Restrict key* and tick only
   **Map Tiles API**. Under *Application restrictions* you can choose *IP addresses* and enter
   your home IP, but leave it at *None* if your IP changes. Never share the key or put it in a
   published copy of the mod.
5. **Put a safety limit on it.** In *APIs & Services → Map Tiles API → Quotas*, lower the daily
   request limit (e.g. 3,000/day), and in *Billing → Budgets & alerts* add a small budget alert.
6. **Add it to the mod.** Copy `.env.example` to `.env` next to `proxy.js`, add
   `GOOGLE_MAPS_API_KEY=your-key`, restart the proxy, and pick **Google Satellite (Map Tiles API)**
   in the panel.

**Cost:** 2D map tiles are an "Essentials" item with **100,000 free tile requests per month**;
beyond that Google charges about **US$0.60 per 1,000 tiles**. Each project is also limited to
**15,000 tile requests per day**. One screen of imagery is roughly 20–40 tiles, so panning a
lot at high zoom uses them quickly. The proxy reuses tiles for as long as Google allows, which
helps. Check Google's pricing page for current numbers.

## Fair use

openrailwaymap.app is a free, volunteer-run service with a
[usage policy](https://github.com/hiddewie/OpenRailwayMap-vector/blob/master/USAGE.md):
tiles may be used by public applications that credit OpenRailwayMap, but **must not
be downloaded in bulk**, and clients must send an honest User-Agent. openrailwaymap.app's
server refuses tile requests that carry no `Referer` (HTTP 403), so the proxy sends the
URL of the page where this mod is published (`ORM_REFERER`); if you publish the mod
somewhere else, set it to that page. This mod only requests what is on screen, caches what it fetches, limits parallel requests and
identifies itself honestly. Please don't remove those limits, and don't use the
proxy to scrape tiles. If you need heavy use, self-host
[OpenRailwayMap-vector](https://github.com/hiddewie/OpenRailwayMap-vector) and set
`ORM_UPSTREAM`.

Railway data © [OpenRailwayMap](https://openrailwaymap.app) and
© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL).
The credit line is shown on the map whenever the overlay is on.

## How it works

1. The proxy fetches openrailwaymap.app's own MapLibre `style.json` and rewrites
   every tile, TileJSON and sprite URL to point at itself.
2. The mod loads that style, drops the bits that are not railway data (background
   map, hillshade, OpenHistoricalMap), renames every source and layer into its own
   namespace and inserts its hundreds of layers into the game map below (or above)
   your tracks.
3. The website's display options are MapLibre *global state*; the mod sets those
   from the panel. On older game builds without global-state support it bakes the
   options into the layers instead.
4. Icons come from OpenRailwayMap's sprite sheets and are handed to MapLibre on
   demand; labels use the game's own fonts.
5. When the game rebuilds its map style, the overlay is re-added automatically.

## Development

```
npm install
npm run typecheck
npm test
npm run build      # outputs the installable mod to dist/
npm run dev:link   # symlink dist/ into the game's mods folder
npm run proxy      # run the proxy from source
```

## Troubleshooting

- **Panel says "Proxy not running"** – start the launcher and press *Refresh*. With the auto-start launchers, check `logs/proxy.log`; the most common cause is Node.js not being installed.
- **Proxy stops too early or doesn't stop** – it recognises the game by a process name containing "Subway Builder" or "metro-maker". If your copy is named differently, set `GAME_PROCESS_MATCH` in `.env`.
- **Port already in use** – another copy of the proxy is running, or set `PROXY_PORT` in `.env` and update the address in the panel.
- **Overlay on but nothing shows** – zoom in; check the proxy window for upstream errors; openrailwaymap.app may be busy (failed tiles are retried after 30 s and stale cached tiles are reused).
- **Proxy window shows `status=403`** – openrailwaymap.app refused the requests. Make sure you are running the proxy from this version (it prints the Referer it sends when it starts), restart it, then press *Reload overlay*.
- **"N layers unsupported by this game version"** – the game's MapLibre is older than openrailwaymap.app's style needs; the rest of the overlay still works.

MIT licensed — see `LICENSE`.
