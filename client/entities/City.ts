import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CONFIG } from "../../shared/config.js";
import type { PhysicsWorld } from "../physics/World.js";

const C = CONFIG.CITY;
const COL = CONFIG.COLORS;

/**
 * The city, world pass v3: DAYTIME, human-scale, alive.
 *  - Real street anatomy: 12m asphalt roads with painted lane dashes,
 *    flanked by raised 4m sidewalks (with colliders — you stand ON them).
 *  - Facade variety: six realistic building colors, each with its own
 *    daytime glass window texture. Merged per color → ~8 draw calls.
 *  - Parks: deterministic plots become grass squares with trees + benches.
 *  - Districts by ring: towering core → mid-rise → low outskirts.
 * Same SEED → same city, always.
 */
export function buildCity(scene: THREE.Scene, physics: PhysicsWorld): void {
  const rand = mulberry32(C.SEED);
  const span = citySpan();
  const half = span / 2;
  const center = Math.floor(C.GRID / 2);

  addGround(scene, physics, span + 260);
  addStreets(scene, physics, span);
  addDaySky(scene, rand);

  // Merge buckets.
  const facadeBuckets: THREE.BufferGeometry[][] = CONFIG.COLORS.FACADES.map(() => []);
  const roofBucket: THREE.BufferGeometry[] = [];
  const miscBucket: THREE.BufferGeometry[] = []; // antennas, tanks, benches
  const trunkBucket: THREE.BufferGeometry[] = [];
  const leafBucket: THREE.BufferGeometry[] = [];
  const grassBucket: THREE.BufferGeometry[] = [];

  const pushTower = (
    variant: number,
    x: number,
    z: number,
    w: number,
    d: number,
    baseY: number,
    topY: number
  ): void => {
    const h = topY - baseY;
    const cy = baseY + h / 2;
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, cy, z);
    facadeBuckets[variant].push(geo);

    const roof = new THREE.BoxGeometry(w + 1.2, 1, d + 1.2);
    roof.translate(x, topY + 0.5, z);
    roofBucket.push(roof);

    physics.addStaticBox(x, cy, z, w / 2, h / 2, d / 2);
    physics.addStaticBox(x, topY + 0.5, z, (w + 1.2) / 2, 0.5, (d + 1.2) / 2);
  };

  const addPark = (x: number, z: number): void => {
    const grass = new THREE.BoxGeometry(C.PLOT, 0.16, C.PLOT);
    grass.translate(x, 0.08, z);
    grassBucket.push(grass);

    const trees = 6 + Math.floor(rand() * 6);
    for (let t = 0; t < trees; t++) {
      const tx = x + (rand() - 0.5) * (C.PLOT - 6);
      const tz = z + (rand() - 0.5) * (C.PLOT - 6);
      const th = 3.5 + rand() * 3.5; // trunk height — real trees, 5–10m total
      const trunk = new THREE.CylinderGeometry(0.18, 0.28, th, 6);
      trunk.translate(tx, th / 2 + 0.15, tz);
      trunkBucket.push(trunk);
      const crown = new THREE.IcosahedronGeometry(1.6 + rand() * 1.4, 1);
      crown.translate(tx, th + 1.2, tz);
      crown.scale(1, 0.85, 1);
      leafBucket.push(crown);
    }

    // Benches around the edge.
    for (let b = 0; b < 4; b++) {
      const bench = new THREE.BoxGeometry(1.8, 0.45, 0.5);
      const angle = (b / 4) * Math.PI * 2;
      bench.translate(
        x + Math.cos(angle) * (C.PLOT / 2 - 3),
        0.38,
        z + Math.sin(angle) * (C.PLOT / 2 - 3)
      );
      miscBucket.push(bench);
    }
  };

  for (let gx = 0; gx < C.GRID; gx++) {
    for (let gz = 0; gz < C.GRID; gz++) {
      if (gx === center && gz === center) continue; // plaza

      const ring = Math.max(Math.abs(gx - center), Math.abs(gz - center));
      const x = -half + C.PLOT / 2 + gx * (C.PLOT + C.STREET);
      const z = -half + C.PLOT / 2 + gz * (C.PLOT + C.STREET);

      // Parks: none in the core (that's the skyline), more toward the edge.
      if (ring >= 2 && rand() < C.PARK_CHANCE) {
        addPark(x, z);
        continue;
      }

      const band = ring <= 1 ? C.CORE : ring <= 3 ? C.MID : C.OUTER;
      const h = band.MIN + rand() * (band.MAX - band.MIN);
      const w = C.PLOT * (0.6 + rand() * 0.32);
      const d = C.PLOT * (0.6 + rand() * 0.32);
      const variant = Math.floor(rand() * facadeBuckets.length);

      pushTower(variant, x, z, w, d, 0, h);

      if (rand() < (ring <= 1 ? 0.75 : 0.4)) {
        const th = h * (0.25 + rand() * 0.3);
        pushTower(variant, x, z, w * 0.55, d * 0.55, h, h + th);
        if (ring <= 1 && rand() < 0.5) {
          pushTower(variant, x, z, w * 0.3, d * 0.3, h + th, h + th * 1.6);
        }
      }

      if (rand() < 0.5) {
        const ah = 4 + rand() * 8;
        const ax = x + (rand() - 0.5) * w * 0.5;
        const az = z + (rand() - 0.5) * d * 0.5;
        const pole = new THREE.CylinderGeometry(0.12, 0.2, ah, 5);
        pole.translate(ax, h + ah / 2, az);
        miscBucket.push(pole);
        addBlinker(scene, ax, h + ah + 0.2, az);
      }
      if (rand() < 0.35) {
        const tx = x + (rand() - 0.5) * w * 0.4;
        const tz = z + (rand() - 0.5) * d * 0.4;
        const tank = new THREE.CylinderGeometry(1.4, 1.4, 2.6, 10);
        tank.translate(tx, h + 1.8, tz);
        miscBucket.push(tank);
      }
    }
  }

  // --- merge + add ---
  const facadeMats = CONFIG.COLORS.FACADES.map((color, i) =>
    makeDayFacadeMaterial(color, mulberry32(C.SEED + i * 97))
  );
  facadeBuckets.forEach((bucket, i) => {
    if (bucket.length === 0) return;
    const mesh = new THREE.Mesh(mergeGeometries(bucket), facadeMats[i]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    bucket.forEach((g) => g.dispose());
  });

  const addMerged = (bucket: THREE.BufferGeometry[], mat: THREE.Material, shadows = true): void => {
    if (bucket.length === 0) return;
    const mesh = new THREE.Mesh(mergeGeometries(bucket), mat);
    if (shadows) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    scene.add(mesh);
  };
  addMerged(roofBucket, new THREE.MeshLambertMaterial({ color: COL.ROOF }));
  addMerged(miscBucket, new THREE.MeshLambertMaterial({ color: 0x6e675c }));
  addMerged(grassBucket, new THREE.MeshLambertMaterial({ color: COL.GRASS }));
  addMerged(trunkBucket, new THREE.MeshLambertMaterial({ color: 0x5d4632 }));
  addMerged(leafBucket, new THREE.MeshLambertMaterial({ color: 0x4d7f3a }));

  addPlazaBeaconPedestal(scene, physics);
}

// --------------------------------------------------------------- pieces

/** Roads + painted center dashes + raised sidewalks (with colliders). */
function addStreets(scene: THREE.Scene, physics: PhysicsWorld, span: number): void {
  const half = span / 2;
  const roadGeo: THREE.BufferGeometry[] = [];
  const walkGeo: THREE.BufferGeometry[] = [];
  const paintGeo: THREE.BufferGeometry[] = [];

  for (const lane of streetCenters()) {
    for (const axis of ["x", "z"] as const) {
      // Asphalt.
      const road = new THREE.BoxGeometry(
        axis === "x" ? span : C.ROAD,
        0.06,
        axis === "x" ? C.ROAD : span
      );
      road.translate(axis === "x" ? 0 : lane, 0.03, axis === "x" ? lane : 0);
      roadGeo.push(road);

      // Sidewalks flanking the road.
      for (const side of [-1, 1]) {
        const off = (C.ROAD / 2 + C.SIDEWALK / 2) * side;
        const walk = new THREE.BoxGeometry(
          axis === "x" ? span : C.SIDEWALK,
          0.24,
          axis === "x" ? C.SIDEWALK : span
        );
        walk.translate(axis === "x" ? 0 : lane + off, 0.12, axis === "x" ? lane + off : 0);
        walkGeo.push(walk);
        physics.addStaticBox(
          axis === "x" ? 0 : lane + off,
          0.12,
          axis === "x" ? lane + off : 0,
          axis === "x" ? span / 2 : C.SIDEWALK / 2,
          0.12,
          axis === "x" ? C.SIDEWALK / 2 : span / 2
        );
      }

      // Dashed center line.
      for (let p = -half + 4; p < half - 4; p += 9) {
        const dash = new THREE.BoxGeometry(axis === "x" ? 3 : 0.25, 0.02, axis === "x" ? 0.25 : 3);
        dash.translate(axis === "x" ? p : lane, 0.07, axis === "x" ? lane : p);
        paintGeo.push(dash);
      }
    }
  }

  const roads = new THREE.Mesh(
    mergeGeometries(roadGeo),
    new THREE.MeshLambertMaterial({ color: COL.ROAD })
  );
  roads.receiveShadow = true;
  scene.add(roads);

  const walks = new THREE.Mesh(
    mergeGeometries(walkGeo),
    new THREE.MeshLambertMaterial({ color: COL.SIDEWALK })
  );
  walks.receiveShadow = true;
  scene.add(walks);

  scene.add(
    new THREE.Mesh(mergeGeometries(paintGeo), new THREE.MeshLambertMaterial({ color: COL.LANE_PAINT }))
  );
}

function addBlinker(scene: THREE.Scene, x: number, y: number, z: number): void {
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3344 })
  );
  tip.position.set(x, y, z);
  tip.userData.blink = Math.random() * Math.PI * 2;
  tip.name = "blinker";
  scene.add(tip);
}

/** Daytime facade: colored wall + glass window grid (few interior lights). */
function makeDayFacadeMaterial(wall: number, rand: () => number): THREE.MeshLambertMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const base = new THREE.Color(wall);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 128, 256);

  // Windows: sky-tinted glass, occasional lit interior, subtle variation.
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = rand() < 0.06;
      if (lit) {
        ctx.fillStyle = "#ffe9b0";
      } else {
        const shade = 0.75 + rand() * 0.25;
        ctx.fillStyle = `rgb(${Math.floor(122 * shade)}, ${Math.floor(158 * shade)}, ${Math.floor(
          186 * shade
        )})`;
      }
      ctx.fillRect(6 + col * 20, 8 + row * 15, 12, 9);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshLambertMaterial({ map: tex });
}

function addGround(scene: THREE.Scene, physics: PhysicsWorld, size: number): void {
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(size, 2, size),
    new THREE.MeshLambertMaterial({ color: COL.GROUND })
  );
  ground.position.y = -1;
  ground.receiveShadow = true;
  scene.add(ground);
  physics.addStaticBox(0, -1, 0, size / 2, 1, size / 2);
}

/** Blue sky is scene.background; here: the sun disc + drifting clouds. */
function addDaySky(scene: THREE.Scene, rand: () => number): void {
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false })
  );
  sun.position.set(350, 420, 180);
  sun.lookAt(0, 60, 0);
  scene.add(sun);

  // Clouds: clusters of flattened white blobs, merged to one mesh.
  const blobs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const cx = (rand() - 0.5) * 1300;
    const cy = 160 + rand() * 140;
    const cz = (rand() - 0.5) * 1300;
    const parts = 3 + Math.floor(rand() * 4);
    for (let p = 0; p < parts; p++) {
      const blob = new THREE.SphereGeometry(14 + rand() * 22, 8, 6);
      blob.scale(1, 0.35, 1);
      blob.translate(cx + (rand() - 0.5) * 40, cy + (rand() - 0.5) * 8, cz + (rand() - 0.5) * 40);
      blobs.push(blob);
    }
  }
  const clouds = new THREE.Mesh(
    mergeGeometries(blobs),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
  );
  scene.add(clouds);
}

/** Landmark at the plaza center — spawn point & mission anchor. */
function addPlazaBeaconPedestal(scene: THREE.Scene, physics: PhysicsWorld): void {
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5, 3, 8),
    new THREE.MeshLambertMaterial({ color: 0x8c8578 })
  );
  ped.position.y = 1.5;
  ped.castShadow = true;
  ped.receiveShadow = true;
  scene.add(ped);
  physics.addStaticBox(0, 1.5, 0, 4, 1.5, 4);
}

/** Deterministic PRNG — the level is authored, not random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Street-center coordinates (shared by traffic, peds, shards, drones). */
export function streetCenters(): number[] {
  const span = citySpan();
  const half = span / 2;
  const out: number[] = [];
  for (let i = 0; i < C.GRID - 1; i++) {
    out.push(-half + C.PLOT + C.STREET / 2 + i * (C.PLOT + C.STREET));
  }
  return out;
}

export function citySpan(): number {
  return C.GRID * C.PLOT + (C.GRID - 1) * C.STREET;
}
