# GRAPNEL (working title)

> **2–4 players are grappling-hook vigilantes. One dense city block. The city tells the story.**

**Status: Days 2–10 — playable co-op mission in a full district.** The swing,
2–4 player co-op, the noir art pass, procedural sound, and mission
**BLACKOUT PROTOCOL v2** — now **8 beacons** across an **11×11 city** with
real districts: a 60–110m downtown core, mid-rise ring, and low outskirts
(merged geometry keeps it fast — ~121 towers in a handful of draw calls).

The world has substance now: **street traffic** flowing through the canyons,
**36 collectible data shards** (deterministic locations, HUD counter),
**KILOWATT's patrol drones** — drift into a searchlight and it shoves you off
your line — and **9 glowing updraft columns** that carry you to the rooftops.
Story is 8 beats and names the villain. Movement is client-authoritative with
server relay — the documented scope trade in `../game-strategy-3d-pivot.md`.

Recent fixes: grapple now yanks you into motion even when fired from the
ground (tauten + zip boost); reticle and fire share ONE aim path (no more
"glitchy shots"); rope rendering no longer allocates per frame (the frame
stutter fix).

**Newest — the daylight update:** full day mode (sun, blue sky, clouds, warm
shadows), six realistic facade colors, real street anatomy (asphalt roads with
painted lane dashes, raised sidewalks you stand on), parks with trees and
benches, pedestrians walking the footpaths, human-scale blocks, true
antialiasing (the MSAA fix for the "pixelated" look), **mobile support**
(virtual joystick + grapple/jump buttons + look drag; the splash-freeze bug on
phones is fixed), named districts, and shard-lore story milestones.

**Squad rooms + deploy-ready.** The splash now offers QUICK PLAY (public
pool) or SQUAD ROOM (enter/generate a code — the URL becomes a shareable
invite link; same code = same mission). Deployment configs for Render,
Railway, and Colyseus Cloud are prepped — see `DEPLOY.md` for the ~10-minute
path to a public URL anyone can play.

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev
```

This starts the game server (:2567) and client (:5173) together.
Open **http://localhost:5173**, click to lock the pointer, and you're in.
Open a second window (or a friend on your Wi-Fi opens the "Network" URL vite
prints) — you'll see each other swinging. Solo play works fine too; the game
just runs without a room if the server is unreachable.

| Input | Action |
|---|---|
| Mouse | Look / aim |
| **Hold LMB** | Fire grapple at the reticle (green = valid target) — release to let go |
| WASD | Move on ground · steer/pump the swing in the air |
| SPACE | Jump |
| Q / E | Reel in / out while swinging |

The whole loop: climb speed by chaining swings — fire high, release at the
bottom of the arc for the momentum boost, re-fire. The km/h counter is your
score for now.

## What to playtest for (day-5 checkpoint questions)

1. Does chaining swings feel better than walking? (It must.)
2. Is the release boost satisfying — do you *want* to let go at the arc bottom?
3. Does the camera keep up at speed without nausea?
4. Is aiming forgiving enough? (If you miss constantly, we add aim assist.)

## Architecture

```
shared/config.ts          every tuning value — the swing's "feel" lives here
client/physics/World.ts   Rapier init, fixed 60Hz timestep, raycasts
client/physics/Grapple.ts THE core brick: taut-only tether constraint
                          (pendulum swing — no springs, no instability)
client/entities/Hero.ts   capsule body, ground/air/swing movement states
client/entities/City.ts   deterministic gray-box city (seed = level design)
client/entities/Rope.ts   sag-when-slack rope rendering
client/CameraRig.ts       smoothed follow + speed-scaled FOV
client/input/Input.ts     pointer lock, WASD, hold-LMB grapple
client/main.ts            boots and wires everything
client/net/Connection.ts  Colyseus client (dev/prod endpoint logic)
client/entities/RemoteHero.ts  teammates: dead-reckoned interpolation + ropes
shared/protocol.ts        pose message contract + netcode model rationale
server/index.ts           Colyseus bootstrap; serves client/dist in prod
server/rooms/MissionRoom.ts    4-player relay room, pose sanity validation
server/state/MissionState.ts   synced schema
tools/swingtest.mts       headless physics test of the real shipped bricks
tools/nettest.mts         headless 2-bot co-op relay test
```

Stack: **Three.js 0.185** (render) + **Rapier 0.19** (physics, WASM). The
multiplayer layer (Colyseus, same pattern as the TILT build) arrives days 6–9
per the roadmap — the Grapple/Hero split is already shaped for it.

## Verified (headless, on the shipped code)

Pendulum swings past bottom · speed builds through the arc · rope never
stretches · release applies momentum boost · aim raycast works · reel-in
shortens the tether. Run it yourself: `npx tsx tools/swingtest.mts`
