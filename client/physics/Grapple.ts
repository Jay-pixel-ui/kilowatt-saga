import type RAPIER from "@dimforge/rapier3d-compat";
import { CONFIG } from "../../shared/config.js";

const G = CONFIG.GRAPPLE;

export interface GrappleAnchor {
  x: number;
  y: number;
  z: number;
}

/**
 * The tether-constraint swing (the documented Spider-Man 2 / "Energy Hook"
 * technique, verified headless in our sandbox before this file was written):
 *
 *  - The rope is an invisible sphere of radius `length` around the anchor.
 *  - It only acts in TENSION: if the hero is inside the sphere, nothing
 *    happens (slack rope). If outside, clamp position to the sphere surface
 *    and delete the outward radial component of velocity.
 *  - All remaining velocity is tangential → a natural pendulum arc, energy
 *    fed by gravity. No spring constants to destabilize.
 *
 * This file is deliberately renderer-free (no three.js import) so the
 * headless physics test can exercise the exact code the game ships.
 */
export class Grapple {
  anchor: GrappleAnchor | null = null;
  length = 0;

  get active(): boolean {
    return this.anchor !== null;
  }

  /**
   * Attach at a world point. The tether is set slightly SHORTER than the
   * current distance (ATTACH_TAUTEN) and a launch impulse is applied toward
   * the anchor — so attaching always yanks you into motion, even from a
   * standstill on the ground. Without this, firing while grounded did
   * nothing (rope taut, floor holding you: perfect static equilibrium).
   */
  fire(
    anchor: GrappleAnchor,
    heroPos: { x: number; y: number; z: number },
    body?: RAPIER.RigidBody,
    grounded = false
  ): void {
    this.anchor = anchor;
    this.length = Math.max(G.MIN_LENGTH, dist(anchor, heroPos) * G.ATTACH_TAUTEN);

    if (body) {
      const dx = anchor.x - heroPos.x;
      const dy = anchor.y - heroPos.y;
      const dz = anchor.z - heroPos.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const v = body.linvel();
      body.setLinvel(
        {
          x: v.x + (dx / d) * G.ZIP_BOOST,
          y: v.y + (dy / d) * G.ZIP_BOOST + (grounded ? G.ZIP_UP_BOOST : 0),
          z: v.z + (dz / d) * G.ZIP_BOOST
        },
        true
      );
    }
  }

  /** Let go — returns the momentum boost applied (for FX later). */
  release(body: RAPIER.RigidBody): void {
    if (!this.active) return;
    const v = body.linvel();
    body.setLinvel(
      {
        x: v.x * G.RELEASE_BOOST,
        y: v.y * G.RELEASE_BOOST + G.RELEASE_UP_KICK,
        z: v.z * G.RELEASE_BOOST
      },
      true
    );
    this.anchor = null;
  }

  /**
   * Run once per fixed physics step while attached.
   * `swingInput` is the camera-relative steering direction (unit-ish, y=0).
   * `reel` is -1 (shorten), 0, or 1 (lengthen).
   */
  step(body: RAPIER.RigidBody, swingInput: { x: number; z: number }, reel: number, dt: number): void {
    if (!this.anchor) return;
    const a = this.anchor;

    // Reeling changes the rope length itself.
    if (reel !== 0) {
      this.length = Math.max(G.MIN_LENGTH, this.length + reel * G.REEL_SPEED * dt);
    }

    // Swing steering: accelerate along the player's intent, capped indirectly
    // by the tether itself (you can pump the arc but not fly).
    if (swingInput.x !== 0 || swingInput.z !== 0) {
      const v = body.linvel();
      body.setLinvel(
        {
          x: v.x + swingInput.x * G.SWING_ACCEL * dt,
          y: v.y,
          z: v.z + swingInput.z * G.SWING_ACCEL * dt
        },
        true
      );
    }

    // --- the constraint itself ---
    const p = body.translation();
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const dz = p.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    if (d <= this.length || d < 1e-6) return; // slack — rope does nothing

    const nx = dx / d;
    const ny = dy / d;
    const nz = dz / d;

    // Clamp position back onto the rope sphere.
    body.setTranslation(
      {
        x: a.x + nx * this.length,
        y: a.y + ny * this.length,
        z: a.z + nz * this.length
      },
      true
    );

    // Remove outward radial velocity; keep the tangential component.
    const v = body.linvel();
    const vr = v.x * nx + v.y * ny + v.z * nz;
    if (vr > 0) {
      body.setLinvel({ x: v.x - vr * nx, y: v.y - vr * ny, z: v.z - vr * nz }, true);
    }
  }
}

function dist(a: GrappleAnchor, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
