import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CONFIG } from "../../shared/config.js";
import { streetCenters, citySpan, mulberry32 } from "./City.js";

/**
 * Pedestrians: the city's heartbeat. Instanced people strolling the
 * sidewalks with a subtle walk bob + sway. Four outfit palettes,
 * ~4 draw calls for the whole crowd.
 */
interface Ped {
  axis: "x" | "z";
  lane: number; // sidewalk line coordinate
  dir: 1 | -1;
  speed: number;
  offset: number;
  variant: number;
  slot: number;
  phase: number;
}

const OUTFITS: Array<{ top: number; bottom: number; skin: number }> = [
  { top: 0x5a7d9a, bottom: 0x2e3440, skin: 0xd9a878 },
  { top: 0xa85d5d, bottom: 0x3b3b3b, skin: 0x8a5a3c },
  { top: 0x6b8f5e, bottom: 0x4a4238, skin: 0xe8c39e },
  { top: 0xc7b45a, bottom: 0x2f3a4a, skin: 0x6e452a }
];

export class Peds {
  private meshes: THREE.InstancedMesh[] = [];
  private peds: Ped[] = [];
  private dummy = new THREE.Object3D();
  private span: number;

  constructor(scene: THREE.Scene, count = 110) {
    const rand = mulberry32(CONFIG.CITY.SEED + 321);
    const lanes = streetCenters();
    this.span = citySpan();
    const walkOffset = CONFIG.CITY.ROAD / 2 + CONFIG.CITY.SIDEWALK / 2;
    const perVariant = Math.ceil(count / OUTFITS.length);

    for (const outfit of OUTFITS) {
      const mesh = new THREE.InstancedMesh(
        buildPersonGeometry(outfit),
        new THREE.MeshLambertMaterial({ vertexColors: true }),
        perVariant
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes.push(mesh);
    }

    const slots = new Array(OUTFITS.length).fill(0);
    for (let i = 0; i < count; i++) {
      const variant = Math.floor(rand() * OUTFITS.length);
      const side = rand() < 0.5 ? -1 : 1;
      this.peds.push({
        axis: rand() < 0.5 ? "x" : "z",
        lane: lanes[Math.floor(rand() * lanes.length)] + side * walkOffset,
        dir: rand() < 0.5 ? 1 : -1,
        speed: 1.1 + rand() * 0.9, // human walking pace
        offset: rand() * this.span,
        variant,
        slot: slots[variant]++,
        phase: rand() * Math.PI * 2
      });
      this.meshes[variant].count = slots[variant];
    }
  }

  update(t: number): void {
    const half = this.span / 2;
    for (const p of this.peds) {
      const travel =
        ((((p.offset + t * p.speed * p.dir) % this.span) + this.span) % this.span) - half;

      // Walk bob + tiny sway make even a simple shape read as "person".
      const bob = Math.abs(Math.sin(t * 4.4 * p.speed + p.phase)) * 0.06;
      const sway = Math.sin(t * 4.4 * p.speed + p.phase) * 0.05;

      let yaw: number;
      if (p.axis === "x") {
        this.dummy.position.set(travel, 0.24 + bob, p.lane);
        yaw = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        this.dummy.position.set(p.lane, 0.24 + bob, travel);
        yaw = p.dir > 0 ? 0 : Math.PI;
      }
      this.dummy.rotation.set(0, yaw, sway);
      this.dummy.updateMatrix();
      this.meshes[p.variant].setMatrixAt(p.slot, this.dummy.matrix);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}

/** ~1.7m person: legs, torso, arms, head — vertex-colored, one geometry. */
function buildPersonGeometry(outfit: { top: number; bottom: number; skin: number }): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const colored = (geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry => {
    const c = new THREE.Color(color);
    const n = geo.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  };

  const legs = colored(new THREE.BoxGeometry(0.34, 0.8, 0.22), outfit.bottom);
  legs.translate(0, 0.4, 0);
  parts.push(legs);

  const torso = colored(new THREE.BoxGeometry(0.42, 0.62, 0.26), outfit.top);
  torso.translate(0, 1.11, 0);
  parts.push(torso);

  const armL = colored(new THREE.BoxGeometry(0.1, 0.55, 0.12), outfit.top);
  armL.translate(-0.28, 1.08, 0);
  parts.push(armL);
  const armR = colored(new THREE.BoxGeometry(0.1, 0.55, 0.12), outfit.top);
  armR.translate(0.28, 1.08, 0);
  parts.push(armR);

  const head = colored(new THREE.SphereGeometry(0.14, 8, 6), outfit.skin);
  head.translate(0, 1.56, 0);
  parts.push(head);

  return mergeGeometries(parts);
}
