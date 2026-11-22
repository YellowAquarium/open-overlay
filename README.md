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

How it knows the game closed: the Steam launcher tells the proxy the game's program
(`game.exe` in the Subway Builder folder), and the proxy stops shortly after that program exits.
When started by double-click, the proxy finds the program by its install folder. As a backup,
the mod sends a "still here" signal every 15 seconds; if the program can't be seen, the proxy
only stops after 10 minutes without that signal (the game can freeze for minutes while loading a
big city). It also waits a little if the game is restarting itself (e.g. after enabling mods).

### Start the proxy by hand

Double-click the launcher for your OS and **leave the window open while you play**:

- Windows: `start-proxy-windows.cmd`
- macOS: `start-proxy-macos.command`
- Linux: `start-proxy-linux.sh`

On macOS/Linux you may first need `chmod +x` on the launcher. You can also run `node proxy.js` from a terminal.

The proxy listens on `http://127.0.0.1:8788` (Orbital Surveyor uses 8787, so both mods can run side by side).
It also answers the mod's status checks on the next port, 8789, so slow tile downloads can't make a
busy proxy look like it has stopped.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| **Ctrl+T** | Railway overlay on/off |
| **Ctrl+M** | Satellite imagery on/off |

They work while a game is open and are ignored while you're typing in a text box.

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
| `ORM_CONTACT` | – | Contact (email or web page) added to the User-Agent, as OpenStreetMap's tile policy asks |
| `ORM_USER_AGENT` | mod name + version + contact | Full User-Agent override |
| `ORM_REFERER` | this mod's GitHub page | Referer sent to openrailwaymap.app (required by its server — see below) |
| `SATELLITE_CACHE_MB` | `256` | In-memory imagery cache size |
| `ORM_DISK_CACHE_GB` | `25` | Disk space for saved railway data (0 turns the disk cache off) |
| `ORM_DISK_REFRESH_DAYS` | `7` | Saved railway tiles are re-checked online after this many days |
| `GOOGLE_KEYLESS_DISK_CACHE_GB` | `50` | Disk space for saved keyless Google tiles (0 turns it off) |
| `GOOGLE_KEYLESS_REFRESH_DAYS` | `0` | Re-download saved Google tiles after this many days (0 = never) |
| `OPEN_OVERLAY_CACHE_DIR` | see below | Where the disk cache lives |
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

## Tile format

Since November 2026 openrailwaymap.app serves its data mainly in the newer MapLibre Tile (MLT)
format, which the game's map engine can't read. The proxy takes the tiles the server already has
cached (so they load as fast as on the website) and converts MLT tiles to the classic vector-tile
format itself (`mlt-convert.js`). Only if a tile can't be converted does it ask the server to build
a fresh classic copy, which is slower.

## Filling gaps while tiles stream

If a railway tile takes longer than 0.8 s (`STANDIN_AFTER_MS`), the proxy answers straight away
with a stand-in built from tiles it already has for nearby zoom levels: the four (or sixteen)
more detailed tiles beneath it after zooming out, or the nearest saved coarser tile after zooming
in. The mod then swaps in the real tile as soon as it has arrived (it checks every 2 s). Tiles
that fail are no longer left as permanent holes - they're tried again after 30 s. Requests for
the view on screen now go to the front of the download queue, ahead of views you've already left.

## Disk cache

Tiles you've looked at are saved to disk, so they load instantly next time and still show
when openrailwaymap.app or Google can't be reached:

- **Railway data** (OpenRailwayMap tiles, style, symbols): up to **25 GB**. Saved tiles are used
  straight away; after 7 days they are re-checked online the next time you look at them (the
  railway data upstream changes daily). If the server can't be reached, the saved copy is shown.
- **Google imagery (keyless options):** up to **50 GB**, kept until space is needed.
- The official Google API option and OpenStreetMap tiles are **not** saved to disk.

When a cache is full, the tiles you haven't looked at for the longest are deleted first. The
proxy also stops saving if the drive has less than 2 GB free. The *Proxy* section of the panel
shows how much is saved, has a *Clear* button for each cache, and an *Open cache folder* link.

The cache is kept outside the game's mods folder, so updating the mod doesn't delete it:

- Windows: `%LOCALAPPDATA%\OpenOverlay\cache`
- macOS: `~/Library/Caches/OpenOverlay`
- Linux: `~/.cache/open-overlay`

To keep it somewhere else, set `OPEN_OVERLAY_CACHE_DIR` in `.env`.

Storing Google's tiles goes against Google's terms, like the keyless options themselves; this
mod is for personal use.

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
- **Overlay disappears and comes back** – usually openrailwaymap.app being slow (`status=408` in the log), not the proxy stopping. Already-loaded tiles now stay on screen, and the panel only reports the proxy as down after it has missed three checks in a row.
- **After updating the mod** – a newer auto-started proxy asks an older one still running to stop and takes over. Proxies older than 1.2.2 can't be asked, so end any leftover `node.exe` in Task Manager once (or restart the PC).
- **Proxy stopped unexpectedly** – check `logs/proxy.log` in the mod folder: it records why it stopped, including any unexpected error.
- **Proxy stops too early or doesn't stop** – `logs/proxy.log` says which program it is watching ("Watching the game process ..."). If the game is installed in a folder not named "Subway Builder", set `GAME_FOLDER_MATCH` in `.env` to that folder's name.
- **Port already in use** – another copy of the proxy is running, or set `PROXY_PORT` in `.env` and update the address in the panel.
- **Overlay on but nothing shows** – zoom in; check the proxy window for upstream errors; openrailwaymap.app may be busy (failed tiles are retried after 30 s and stale cached tiles are reused).
- **Proxy window shows `status=403`** – openrailwaymap.app refused the requests. Make sure you are running the proxy from this version (it prints the Referer it sends when it starts), restart it, then press *Reload overlay*.
- **"N layers unsupported by this game version"** – the game's MapLibre is older than openrailwaymap.app's style needs; the rest of the overlay still works.

MIT licensed — see `LICENSE`.
