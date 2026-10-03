import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { CONFIG } from "../../shared/config.js";
import { streetCenters, citySpan, mulberry32 } from "./City.js";

const D = CONFIG.DRONES;

/**
 * KILOWATT's patrol drones: searchlight cones drifting through the canyons.
 * Get caught in one and it SHOVES you off your line (no health bars yet —
 * the punishment is losing your beautiful swing). First taste of opposition,
 * and a mechanical reason the city feels owned by someone else.
 */
interface Drone {
  group: THREE.Group;
  eye: THREE.Mesh;
  axis: "x" | "z";
  lane: number;
  dir: 1 | -1;
  pos: number;
  alertT: number;
  dead: boolean;
  dyingT: number;
}

export class Drones {
  private drones: Drone[] = [];
  private span: number;
  private calm = new THREE.MeshBasicMaterial({ color: 0xff9d2e });
  private alert = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  private shoveCooldown = 0;

  /** Fires when a drone catches a hero (for sfx + screen feedback). */
  onAlert: (() => void) | null = null;
  /** Fires when a drone is destroyed by a high-speed hit (Act 2). */
  onTakedown: ((downed: number, total: number) => void) | null = null;
  downed = 0;

  constructor(scene: THREE.Scene) {
    const rand = mulberry32(CONFIG.CITY.SEED + 999);
    const lanes = streetCenters();
    this.span = citySpan();

    for (let i = 0; i < D.COUNT; i++) {
      const group = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0x2a2244 })
      );
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), this.calm);
      eye.position.y = -0.4;

      // Searchlight cone hanging beneath.
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(4.5, D.ALTITUDE, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffc46b,
          transparent: true,
          opacity: 0.07,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      cone.position.y = -D.ALTITUDE / 2;

      group.add(body, eye, cone);
      scene.add(group);

      this.drones.push({
        group,
        eye,
        axis: rand() < 0.5 ? "x" : "z",
        lane: lanes[Math.floor(rand() * lanes.length)],
        dir: rand() < 0.5 ? 1 : -1,
        pos: rand() * this.span,
        alertT: 0,
        dead: false,
        dyingT: 0
      });
    }
  }

  update(dt: number, heroPos: THREE.Vector3, heroBody: RAPIER.RigidBody, heroSpeed: number): void {
    this.shoveCooldown = Math.max(0, this.shoveCooldown - dt);
    const half = this.span / 2;

    for (const d of this.drones) {
      // Death animation: crumple, spin, drop, then vanish.
      if (d.dead) {
        if (d.dyingT > 0) {
          d.dyingT -= dt;
          d.group.position.y -= 30 * dt;
          d.group.rotation.x += 7 * dt;
          d.group.rotation.z += 5 * dt;
          d.group.scale.multiplyScalar(Math.max(0.01, 1 - 2.5 * dt));
          if (d.dyingT <= 0) d.group.visible = false;
        }
        continue;
      }

      d.pos = (d.pos + D.SPEED * dt * d.dir + this.span) % this.span;
      const travel = d.pos - half;
      if (d.axis === "x") d.group.position.set(travel, D.ALTITUDE, d.lane);
      else d.group.position.set(d.lane, D.ALTITUDE, travel);

      d.alertT = Math.max(0, d.alertT - dt);
      d.eye.material = d.alertT > 0 ? this.alert : this.calm;

      // Act 2: slam into the drone body at speed → takedown.
      if (
        heroSpeed > D.TAKEDOWN_SPEED &&
        heroPos.distanceTo(d.group.position) < D.TAKEDOWN_RADIUS
      ) {
        d.dead = true;
        d.dyingT = 0.9;
        this.downed++;
        this.onTakedown?.(this.downed, this.drones.length);
        continue;
      }

      // Caught? (distance to the drone's vertical light column)
      const dx = heroPos.x - d.group.position.x;
      const dz = heroPos.z - d.group.position.z;
      const inColumn = heroPos.y < D.ALTITUDE + 2 && Math.hypot(dx, dz) < D.ALERT_RADIUS;
      if (inColumn && this.shoveCooldown === 0) {
        this.shoveCooldown = D.COOLDOWN;
        d.alertT = 1.2;
        // Shove: away from the column + upward kick. Rude, not lethal.
        const len = Math.hypot(dx, dz) || 1;
        const v = heroBody.linvel();
        heroBody.setLinvel(
          {
            x: v.x + (dx / len) * D.SHOVE,
            y: v.y + D.SHOVE * 0.45,
            z: v.z + (dz / len) * D.SHOVE
          },
          true
        );
        this.onAlert?.();
      }
    }
  }

  get total(): number {
    return this.drones.length;
  }
}
