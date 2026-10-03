import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CONFIG } from "../../shared/config.js";
import type { PhysicsWorld } from "../physics/World.js";
import { Grapple } from "../physics/Grapple.js";
import { HeroRig } from "./HeroRig.js";

const H = CONFIG.HERO;

/**
 * The hero: a locked-rotation dynamic capsule + placeholder mesh.
 * Ground movement, jump, and the Grapple all act on this body.
 */
export class Hero {
  body!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;
  mesh!: THREE.Group;
  rig!: HeroRig;
  grapple = new Grapple();

  private physics!: PhysicsWorld;

  init(physics: PhysicsWorld, scene: THREE.Scene): void {
    this.physics = physics;

    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(H.SPAWN.X, H.SPAWN.Y, H.SPAWN.Z)
        .lockRotations()
        .setCcdEnabled(true) // no tunneling through walls at swing speeds
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(H.CAPSULE_HALF, H.RADIUS).setFriction(0.2),
      this.body
    );

    this.rig = new HeroRig(CONFIG.COLORS.HERO);
    this.mesh = this.rig.root;
    scene.add(this.mesh);
  }

  /** Runs inside every fixed physics step. */
  fixedStep(moveWorld: { x: number; z: number }, wantJump: boolean, reel: number, dt: number): void {
    const v = this.body.linvel();
    const grounded = this.isGrounded();

    if (this.grapple.active) {
      this.grapple.step(this.body, moveWorld, reel, dt);
      return;
    }

    if (grounded) {
      // Ground: accelerate toward intent, damp when idle.
      const speed = Math.hypot(v.x, v.z);
      const hasInput = moveWorld.x !== 0 || moveWorld.z !== 0;
      let nvx = v.x;
      let nvz = v.z;
      if (hasInput) {
        nvx += moveWorld.x * H.WALK_ACCEL * dt;
        nvz += moveWorld.z * H.WALK_ACCEL * dt;
        const nspeed = Math.hypot(nvx, nvz);
        if (nspeed > H.RUN_MAX && nspeed > speed) {
          const s = Math.max(speed, H.RUN_MAX) / nspeed;
          nvx *= s;
          nvz *= s;
        }
      } else {
        const damp = Math.exp(-H.GROUND_FRICTION * dt);
        nvx *= damp;
        nvz *= damp;
      }
      let nvy = v.y;
      if (wantJump) nvy = H.JUMP_SPEED;
      this.body.setLinvel({ x: nvx, y: nvy, z: nvz }, true);
    } else {
      // Air (not swinging): limited steering, momentum preserved.
      if (moveWorld.x !== 0 || moveWorld.z !== 0) {
        const nvx = v.x + moveWorld.x * H.AIR_ACCEL * dt;
        const nvz = v.z + moveWorld.z * H.AIR_ACCEL * dt;
        this.body.setLinvel({ x: nvx, y: v.y, z: nvz }, true);
      }
    }
  }

  /**
   * ONE aim function used by BOTH the reticle indicator and the actual shot,
   * so what the reticle promises is exactly what firing does (the earlier
   * mismatch — reticle on one code path, firing on another — was the
   * "glitchy shooting").
   *
   * Two-stage cast (fixes "shoots backwards"):
   *  1. Camera ray finds what the reticle is on — but the camera sits ~7m
   *     behind the hero, so this ray alone can hit walls BEHIND the player.
   *  2. A second ray from the hero's chest toward that point confirms real
   *     line-of-sight and gives the true attach point + distance.
   */
  computeAim(
    origin: THREE.Vector3,
    dir: THREE.Vector3
  ): { x: number; y: number; z: number } | null {
    const camHit = this.physics.raycast(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
      CONFIG.GRAPPLE.MAX_RANGE + CONFIG.CAMERA.DISTANCE,
      this.collider
    );
    if (!camHit) return null;

    const p = this.body.translation();
    const chest = { x: p.x, y: p.y + 0.5, z: p.z };
    const to = {
      x: camHit.point.x - chest.x,
      y: camHit.point.y - chest.y,
      z: camHit.point.z - chest.z
    };
    const distToTarget = Math.hypot(to.x, to.y, to.z);
    if (distToTarget < 1 || distToTarget > CONFIG.GRAPPLE.MAX_RANGE) return null;

    // Reject targets behind the hero (relative to where the camera looks).
    const dot = (to.x * dir.x + to.y * dir.y + to.z * dir.z) / distToTarget;
    if (dot < 0.05) return null;

    const losDir = { x: to.x / distToTarget, y: to.y / distToTarget, z: to.z / distToTarget };
    const losHit = this.physics.raycast(chest, losDir, distToTarget + 0.5, this.collider);
    return losHit?.point ?? null;
  }

  /** Fire the grapple at whatever computeAim resolves. */
  tryFire(origin: THREE.Vector3, dir: THREE.Vector3): boolean {
    const point = this.computeAim(origin, dir);
    if (!point) return false;
    this.grapple.fire(point, this.body.translation(), this.body, this.isGrounded());
    return true;
  }

  releaseGrapple(): void {
    this.grapple.release(this.body);
  }

  /** Short downward ray just past the capsule's feet. */
  isGrounded(): boolean {
    const p = this.body.translation();
    const feet = H.CAPSULE_HALF + H.RADIUS;
    const hit = this.physics.raycast(
      { x: p.x, y: p.y - feet + 0.05, z: p.z },
      { x: 0, y: -1, z: 0 },
      0.25,
      this.collider
    );
    return hit !== null;
  }

  /** Sync + animate the rig from physics state; face along velocity. */
  syncMesh(dt: number): void {
    const p = this.body.translation();
    this.mesh.position.set(p.x, p.y, p.z);
    const v = this.body.linvel();
    const speedXZ = Math.hypot(v.x, v.z);
    if (speedXZ > 1.5) {
      const target = Math.atan2(v.x, v.z);
      this.mesh.rotation.y += shortestAngle(this.mesh.rotation.y, target) * 0.18;
    }
    this.rig.update(dt, this.speed, v.y, this.isGrounded(), this.grapple.active);
  }

  get position(): THREE.Vector3 {
    const p = this.body.translation();
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  get speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }
}

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
