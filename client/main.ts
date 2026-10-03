import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { Room } from "colyseus.js";
import { Trail } from "./fx/Trail.js";
import { Peds } from "./entities/Peds.js";
import { TouchControls } from "./input/TouchControls.js";
import { Beacons } from "./entities/Beacons.js";
import { Shards } from "./entities/Shards.js";
import { Drones } from "./entities/Drones.js";
import { Updrafts } from "./entities/Updrafts.js";
import { Traffic } from "./fx/Traffic.js";
import { MissionDirector } from "./story/MissionDirector.js";
import { Sfx } from "./audio/Sfx.js";
import { CONFIG } from "../shared/config.js";
import { MSG, POSE_SEND_RATE } from "../shared/protocol.js";
import { PhysicsWorld } from "./physics/World.js";
import { Hero } from "./entities/Hero.js";
import { RemoteHero } from "./entities/RemoteHero.js";
import { buildCity } from "./entities/City.js";
import { Rope } from "./entities/Rope.js";
import { CameraRig } from "./CameraRig.js";
import { Input } from "./input/Input.js";
import { connect } from "./net/Connection.js";

async function boot(): Promise<void> {
  // Quality tier: phones get lower pixel ratio, smaller shadows, less crowd.
  const isTouch = matchMedia("(pointer: coarse)").matches;

  // --- renderer / scene ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(isTouch ? 1 : Math.min(window.devicePixelRatio, 2));
  // Filmic response curve — the single cheapest "looks like a real game" switch.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.COLORS.SKY);
  scene.fog = new THREE.Fog(CONFIG.COLORS.FOG, 70, 640);

  // Daylight: bright sky bounce + warm sun with real shadows. The shadow
  // camera FOLLOWS the hero (140m box) so resolution goes where you look.
  scene.add(new THREE.HemisphereLight(0xbdd9ff, 0x8a9a77, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 600;
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  // --- physics + world + hero ---
  const physics = new PhysicsWorld();
  await physics.init();
  buildCity(scene, physics);

  const hero = new Hero();
  hero.init(physics, scene);
  const rope = new Rope(scene);
  const rig = new CameraRig(window.innerWidth / window.innerHeight);
  const input = new Input(renderer.domElement);
  const touch = isTouch ? new TouchControls() : null;
  const peds = new Peds(scene, isTouch ? 60 : 110);

  // --- atmosphere fx + audio ---
  const trail = new Trail(scene, CONFIG.COLORS.HERO);
  const beacons = new Beacons(scene);
  const shards = new Shards(scene);
  const drones = new Drones(scene);
  const traffic = new Traffic(scene);
  const updrafts = new Updrafts(scene);
  const sfx = new Sfx();
  renderer.domElement.addEventListener("click", () => sfx.unlock(), { once: true });

  const shardsEl = document.getElementById("shards")!;
  shardsEl.textContent = `⬡ 0 / ${shards.total}`;
  shards.onPickup = (n, total) => {
    shardsEl.textContent = `⬡ ${n} / ${total}`;
    sfx.pickup(n);
  };
  drones.onAlert = () => sfx.alarm();
  drones.onTakedown = (downed, total) => {
    sfx.boom();
    mission.droneDown(downed, total);
  };
  const blinkers: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.name === "blinker") blinkers.push(o);
  });

  // Post-processing. IMPORTANT: EffectComposer normally renders WITHOUT
  // MSAA (that was the "pixelated" look) — a multisampled render target
  // restores true antialiasing through the whole post chain.
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      samples: 4,
      type: THREE.HalfFloatType
    })
  );
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.addPass(new RenderPass(scene, rig.camera));
  // Daytime bloom is a whisper, not a shout: only the sun, beacons, and
  // brake lights should glow.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.22, // strength
    0.3, // radius
    0.9 // threshold
  );
  composer.addPass(bloom);

  // --- HUD elements ---
  const reticle = document.getElementById("reticle")!;
  const speedEl = document.getElementById("speed")!;
  const splash = document.getElementById("splash")!;
  const roomEl = document.getElementById("room")!;
  const roomInput = document.getElementById("roomcode") as HTMLInputElement;
  const btnSquad = document.getElementById("btn-squad")!;
  const btnQuick = document.getElementById("btn-quick")!;
  roomInput.value = normalizeCode(new URLSearchParams(location.search).get("room") ?? "");
  document.addEventListener("pointerlockchange", () => {
    splash.style.display = document.pointerLockElement ? "none" : "flex";
  });

  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    rig.camera.aspect = window.innerWidth / window.innerHeight;
    rig.camera.updateProjectionMatrix();
  });

  // --- splash: pick quick play (public pool) or a squad room code ---
  let started = false;
  const chosenCode = await new Promise<string>((resolve) => {
    const start = (code: string): void => {
      if (started) return;
      started = true;
      sfx.unlock();
      // Pointer lock THROWS on touch devices — this exact call, unguarded,
      // was why the game froze at the splash on phones.
      try {
        if (!isTouch) renderer.domElement.requestPointerLock();
      } catch {
        /* touch devices don't need it */
      }
      if (isTouch) splash.style.display = "none";
      resolve(code);
    };
    const relock = (): void => {
      try {
        if (!isTouch) renderer.domElement.requestPointerLock();
        else splash.style.display = "none";
      } catch {
        /* ignore */
      }
    };
    btnQuick.addEventListener("click", (e) => {
      e.stopPropagation();
      if (started) relock();
      else start("");
    });
    btnSquad.addEventListener("click", (e) => {
      e.stopPropagation();
      if (started) relock();
      else start(normalizeCode(roomInput.value) || randomCode());
    });
    // After the first start, clicking anywhere on the splash just resumes.
    splash.addEventListener("click", () => {
      if (started) relock();
    });
  });

  // Shareable invite: the room code lives in the URL.
  if (chosenCode) history.replaceState(null, "", `?room=${chosenCode}`);
  roomEl.textContent = chosenCode ? `room ${chosenCode} · click to copy invite` : "public match";
  roomEl.addEventListener("click", () => {
    void navigator.clipboard?.writeText(location.href);
    roomEl.textContent = chosenCode ? `room ${chosenCode} · invite copied!` : "public match";
  });

  // --- multiplayer (optional: solo play still works if the server is down) ---
  let net: Room | null = null;
  const remotes = new Map<string, RemoteHero>();
  let remoteColorIdx = 0;
  try {
    const { room, $ } = await connect(undefined, chosenCode);
    net = room;
    const anyState = room.state as any;
    $(anyState).players.onAdd((player: any, id: string) => {
      if (id === room.sessionId) return; // that's us
      const remote = new RemoteHero(scene, player.name, remoteColorIdx++);
      remotes.set(id, remote);
    });
    $(anyState).players.onRemove((_p: any, id: string) => {
      remotes.get(id)?.dispose(scene);
      remotes.delete(id);
    });
    console.log("[net] connected as", room.sessionId);
  } catch (err) {
    console.warn("[net] no server — running solo:", err);
  }
  let poseAccum = 0;

  // --- mission ---
  const mission = new MissionDirector(beacons, net);
  mission.onBeaconLit = () => sfx.chime();
  mission.onComplete = () => sfx.finale();
  let lastRing = 0;
  let lastRingAt = 0;

  // Shard lore milestones (story through collecting).
  const prevPickup = shards.onPickup;
  shards.onPickup = (n, total) => {
    prevPickup?.(n, total);
    if (n === 10) mission.say("Shard cache decrypted: KILOWATT bought the utility spine LEGALLY. Someone signed it over.", 6000);
    if (n === 24) mission.say("Shard cache: the signature on the sale... it's the mayor's. Or a perfect copy.", 6000);
    if (n === total) mission.say("All shards recovered. The whole conspiracy fits in your hand now.", 6500);
  };

  // --- main loop ---
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const frameDt = Math.min((now - last) / 1000, 0.1);
    last = now;

    const frame = input.consumeFrame();
    if (touch) {
      const tf = touch.consumeFrame();
      frame.dx += tf.dx;
      frame.dy += tf.dy;
      frame.jump = frame.jump || tf.jump;
      frame.fired = frame.fired || tf.fired;
      frame.released = frame.released || tf.released;
    }
    rig.addLook(frame.dx, frame.dy);

    // Camera-relative movement intent (keyboard OR joystick).
    const fwdIn = touch && (touch.forward !== 0 || touch.strafe !== 0) ? touch.forward : input.forward;
    const strIn = touch && (touch.forward !== 0 || touch.strafe !== 0) ? touch.strafe : input.strafe;
    const { forward, right } = rig.moveBasis();
    const move = forward
      .clone()
      .multiplyScalar(fwdIn)
      .add(right.clone().multiplyScalar(strIn));
    if (move.lengthSq() > 1) move.normalize();

    // Grapple fire/release (edge-triggered from input).
    if (frame.fired) {
      const { origin, dir } = rig.aimRay();
      sfx.thwip();
      if (hero.tryFire(origin, dir)) sfx.attach();
    }
    if (frame.released && hero.grapple.active) {
      hero.releaseGrapple();
      sfx.release();
    }

    // Fixed-step physics; hero logic runs inside each step.
    physics.update(frameDt, (dt) => {
      hero.fixedStep({ x: move.x, z: move.z }, frame.jump, input.reel, dt);
      frame.jump = false; // only consumed by the first step
    });

    // Render-side sync.
    hero.syncMesh(frameDt);
    rope.update(
      hero.grapple.active ? hero.position.add(new THREE.Vector3(0, 0.5, 0)) : null,
      hero.grapple.anchor,
      hero.grapple.length
    );
    rig.update(hero.position, hero.speed, frameDt);

    // --- network: stream our pose, animate teammates ---
    if (net) {
      poseAccum += frameDt;
      if (poseAccum >= 1 / POSE_SEND_RATE) {
        poseAccum = 0;
        const p = hero.body.translation();
        const v = hero.body.linvel();
        const a = hero.grapple.anchor;
        net.send(MSG.POSE, {
          x: p.x, y: p.y, z: p.z,
          vx: v.x, vy: v.y, vz: v.z,
          yaw: hero.mesh.rotation.y,
          g: hero.grapple.active,
          gx: a?.x ?? 0, gy: a?.y ?? 0, gz: a?.z ?? 0
        });
      }
      // Read teammates' latest state directly (schema is live-decoded).
      const players = (net.state as any)?.players;
      players?.forEach?.((pl: any, id: string) => {
        const r = remotes.get(id);
        if (!r) return;
        r.snapshot(
          { x: pl.x, y: pl.y, z: pl.z },
          { x: pl.vx, y: pl.vy, z: pl.vz },
          pl.yaw,
          pl.grappling,
          { x: pl.gx, y: pl.gy, z: pl.gz }
        );
      });
      remotes.forEach((r) => r.update(frameDt));
    }

    // Reticle feedback: EXACTLY the same logic as firing — no more mismatch.
    const { origin, dir } = rig.aimRay();
    const canHit = hero.computeAim(origin, dir) !== null;
    reticle.style.borderColor = canHit ? CONFIG.COLORS.RETICLE_OK : CONFIG.COLORS.RETICLE_NO;
    reticle.style.transform = canHit ? "scale(1.35)" : "scale(1)";

    speedEl.textContent = `${Math.round(hero.speed * 3.6)} km/h`;

    // Fell off the world → respawn.
    if (hero.position.y < -30) {
      hero.body.setTranslation(
        { x: CONFIG.HERO.SPAWN.X, y: CONFIG.HERO.SPAWN.Y, z: CONFIG.HERO.SPAWN.Z },
        true
      );
      hero.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      hero.releaseGrapple();
    }

    // Sunlight shadow frustum tracks the hero.
    const heroPos = hero.position;
    sun.position.set(heroPos.x + 160, heroPos.y + 260, heroPos.z + 90);
    sun.target.position.copy(heroPos);
    sun.target.updateMatrixWorld();

    // Atmosphere + mission updates.
    trail.update(heroPos, hero.speed);
    traffic.update(frameDt, now / 1000);
    peds.update(now / 1000);

    // District awareness: entering a new ring shows its name (story-lite).
    const pitch = CONFIG.CITY.PLOT + CONFIG.CITY.STREET;
    const ring = Math.min(
      CONFIG.DISTRICTS.length - 1,
      Math.round(Math.max(Math.abs(heroPos.x), Math.abs(heroPos.z)) / pitch)
    );
    if (ring !== lastRing && now - lastRingAt > 5000) {
      lastRing = ring;
      lastRingAt = now;
      mission.say(`— ${CONFIG.DISTRICTS[ring]} —`, 2600);
    }
    shards.update(frameDt, heroPos);
    drones.update(frameDt, heroPos, hero.body, hero.speed);
    updrafts.update(frameDt, heroPos, hero.body);
    beacons.update(frameDt, mission.litMask, mission.complete);
    mission.update(heroPos);
    sfx.wind(hero.speed);
    const blinkT = now / 1000;
    for (const b of blinkers) {
      b.visible = Math.sin(blinkT * 2.4 + (b.userData.blink as number)) > 0;
    }

    composer.render();
  });
}

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function randomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusable 0/O/1/I/L
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

void boot();
