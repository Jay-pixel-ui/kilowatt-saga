import * as THREE from "three";
import { CONFIG } from "../../shared/config.js";

/**
 * The five signal beacons: floating orbs in the street canyons.
 * Unlit — dim ember pulse. Lit — bright cyan (bloom halo) + rising ring.
 * The finale beam erupts from the plaza when all five are lit.
 */
export class Beacons {
  private orbs: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private unlitMat = new THREE.MeshBasicMaterial({ color: 0x5a2438 });
  private litMat = new THREE.MeshBasicMaterial({ color: 0x38e5ff });
  private beam: THREE.Mesh;
  private t = 0;

  constructor(scene: THREE.Scene) {
    for (const b of CONFIG.MISSION.BEACONS) {
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), this.unlitMat);
      orb.position.set(b.x, b.y, b.z);
      scene.add(orb);
      this.orbs.push(orb);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.09, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x38e5ff, transparent: true, opacity: 0 })
      );
      ring.position.copy(orb.position);
      scene.add(ring);
      this.rings.push(ring);
    }

    // Finale beam: hidden until mission complete.
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3.2, 320, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x7df0ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      })
    );
    this.beam.position.set(0, 160, 0);
    scene.add(this.beam);
  }

  /** Distance from a point to beacon i. */
  distanceTo(i: number, p: THREE.Vector3): number {
    return this.orbs[i].position.distanceTo(p);
  }

  get count(): number {
    return this.orbs.length;
  }

  update(dt: number, litMask: number, complete: boolean): void {
    this.t += dt;
    for (let i = 0; i < this.orbs.length; i++) {
      const lit = (litMask & (1 << i)) !== 0;
      const orb = this.orbs[i];
      orb.material = lit ? this.litMat : this.unlitMat;

      // Idle motion: bob + slow spin; lit ones spin faster and rings bloom.
      orb.rotation.y += dt * (lit ? 2.2 : 0.5);
      orb.position.y = CONFIG.MISSION.BEACONS[i].y + Math.sin(this.t * 1.4 + i * 1.7) * 0.6;

      const ring = this.rings[i];
      ring.position.copy(orb.position);
      ring.rotation.x = Math.PI / 2;
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (lit) {
        const pulse = (this.t * 0.9 + i * 0.3) % 1;
        ring.scale.setScalar(1 + pulse * 1.8);
        mat.opacity = 0.55 * (1 - pulse);
      } else {
        // Unlit beacons whisper: faint slow pulse so players can find them.
        const pulse = (Math.sin(this.t * 2 + i) + 1) / 2;
        ring.scale.setScalar(1);
        mat.opacity = 0.05 + pulse * 0.1;
      }
    }

    // Finale beam fades in.
    const beamMat = this.beam.material as THREE.MeshBasicMaterial;
    beamMat.opacity += ((complete ? 0.35 : 0) - beamMat.opacity) * Math.min(1, dt * 1.5);
    if (beamMat.opacity > 0.01) this.beam.rotation.y += dt * 0.4;
  }
}
