import * as THREE from "three";
import { CONFIG } from "../../shared/config.js";
import { streetCenters, mulberry32 } from "./City.js";

/**
 * Data shards: 36 collectibles seeded through the canyons at varied heights.
 * They reward exploration and give every swing a nearby micro-goal.
 * Placement is deterministic — shard #17 is always in the same spot, so
 * players can share locations ("the one over the north canyon").
 */
export class Shards {
  collected = 0;
  readonly total = CONFIG.SHARDS.COUNT;

  private meshes: THREE.Mesh[] = [];
  private taken: boolean[] = [];
  private mat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
  private geo = new THREE.OctahedronGeometry(0.9);
  private t = 0;

  /** Fires on pickup (for sfx + HUD). */
  onPickup: ((collected: number, total: number) => void) | null = null;

  constructor(scene: THREE.Scene) {
    const rand = mulberry32(CONFIG.CITY.SEED + 777);
    const lanes = streetCenters();

    for (let i = 0; i < this.total; i++) {
      // Every shard floats over a street canyon: pick one street axis line,
      // slide along it, pick a height band (low cruise / mid swing / high).
      const alongLane = lanes[Math.floor(rand() * lanes.length)];
      const across = (rand() - 0.5) * (lanes[lanes.length - 1] - lanes[0]);
      const band = rand();
      const y = band < 0.35 ? 8 + rand() * 12 : band < 0.8 ? 22 + rand() * 25 : 50 + rand() * 25;

      const m = new THREE.Mesh(this.geo, this.mat);
      if (rand() < 0.5) m.position.set(across, y, alongLane);
      else m.position.set(alongLane, y, across);
      m.userData.phase = rand() * Math.PI * 2;
      scene.add(m);
      this.meshes.push(m);
      this.taken.push(false);
    }
  }

  update(dt: number, heroPos: THREE.Vector3): void {
    this.t += dt;
    for (let i = 0; i < this.meshes.length; i++) {
      if (this.taken[i]) continue;
      const m = this.meshes[i];
      m.rotation.y += dt * 1.6;
      m.position.y += Math.sin(this.t * 2 + (m.userData.phase as number)) * dt * 0.4;

      if (m.position.distanceTo(heroPos) <= CONFIG.SHARDS.PICKUP_RADIUS) {
        this.taken[i] = true;
        m.visible = false;
        this.collected++;
        this.onPickup?.(this.collected, this.total);
      }
    }
  }
}
