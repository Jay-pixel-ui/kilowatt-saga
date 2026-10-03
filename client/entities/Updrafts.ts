import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { CONFIG } from "../../shared/config.js";
import { streetCenters, mulberry32 } from "./City.js";

const COUNT = 9;
const RADIUS = 4.5;
const TOP = 85;
const LIFT = 42; // m/s² while inside — beats gravity decisively

/**
 * Thermal updrafts: glowing vent columns rising from the streets.
 * Fly into one and it carries you toward the rooftops — the "elevator"
 * that keeps the 11×11 city traversable without tedious wall-climbing.
 * Visible from far away (bloom column), doubles as a navigation landmark.
 */
export class Updrafts {
  private columns: THREE.Mesh[] = [];
  private mat: THREE.MeshBasicMaterial;
  private t = 0;

  constructor(scene: THREE.Scene) {
    const rand = mulberry32(CONFIG.CITY.SEED + 4242);
    const lanes = streetCenters();
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x7cf0d0,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Authored-by-seed placement at street intersections (never inside towers).
    for (let i = 0; i < COUNT; i++) {
      const x = lanes[Math.floor(rand() * lanes.length)];
      const z = lanes[Math.floor(rand() * lanes.length)];
      const col = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS * 0.7, TOP, 14, 1, true), this.mat);
      col.position.set(x, TOP / 2, z);
      scene.add(col);
      this.columns.push(col);
    }
  }

  update(dt: number, heroPos: THREE.Vector3, heroBody: RAPIER.RigidBody): void {
    this.t += dt;
    this.mat.opacity = 0.08 + Math.sin(this.t * 2.2) * 0.03;

    for (const col of this.columns) {
      const dx = heroPos.x - col.position.x;
      const dz = heroPos.z - col.position.z;
      if (heroPos.y < TOP && Math.hypot(dx, dz) < RADIUS) {
        const v = heroBody.linvel();
        // Lift fades near the top so you crest gently instead of rocketing.
        const fade = Math.min(1, (TOP - heroPos.y) / 15);
        heroBody.setLinvel({ x: v.x, y: v.y + LIFT * fade * dt, z: v.z }, true);
      }
    }
  }
}
