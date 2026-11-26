[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Built with AI agents](https://make.fun/badge-ai.svg)](https://make.fun)
[![Entry](https://make.fun/badge-entry.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Nusa Sky Courier — Kurir Kepulauan

A complete, original flight game that runs offline in desktop Chrome from static files. You are a courier pilot flying a small prop plane across an Indonesian archipelago: thread glowing rings over Teluk Biru, deliver parcels between island airstrips, and finish a storm courier run at dusk — on limited fuel, with stalls, wind and hard landings all real.

## How to play

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and fly:

- **↑ / ↓** — pitch up / down (climb / descend)
- **← / →** — bank and turn
- **Shift / Ctrl** (or **W / S**) — throttle up / down
- **G** — landing gear, **F** — flaps, **C** — chase / cockpit camera, **P** — pause, **M** — mute
- **Mouse** — click the cockpit buttons (throttle, gear, flaps, camera, sound), or drag the sky to steer like a stick; click menu buttons to start missions

## The three missions

1. **Ring Run** — fly through 8 glowing rings over the bay in order, against the clock.
2. **Island Hop** — take off from runway Merpati, deliver to Pulau Hijau, and land gently on runway Hijau.
3. **Storm Courier** — dusk, rain and gusts: 6 rings, then land on runway Karang before fuel runs out.

Fuel burns with throttle, speed buys lift (drop below stall speed and the nose drops), and a touchdown harder than −4 m/s or with the gear up costs the airframe. Three lives per campaign; landing quality scores up to 500 points.

## What you see

Chase view over a Mode-7 island map (ocean, beaches, jungle, a live volcano, three marked runways), a lit cockpit view with attitude indicator, airspeed and altimeter tapes, compass, fuel and throttle gauges, a minimap, and a HUD with altitude, speed and heading. All art is drawn in code and all sound is synthesised with WebAudio — no network requests, no external files.

## Files

- `game/index.html` — the game page
- `game/src/config.js` — tuning and world constants
- `game/src/random.js` — seeded random helpers
- `game/src/terrain.js` — the archipelago map and height function
- `game/src/flight.js` — the flight model (throttle, lift, stall, landing)
- `game/src/missions.js` — the three missions, scoring and objectives
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised engine, wind and chimes
- `game/src/render.js` — Mode-7 ground, sky, rings, aircraft and cockpit
- `game/src/hud.js` — HUD, minimap, buttons and menu screens
- `game/src/shots.js` — screenshot scene staging
- `game/src/main.js` — the game loop and state machine
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

Built for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).
