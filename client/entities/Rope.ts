import * as THREE from "three";
import { CONFIG } from "../../shared/config.js";

const SEGMENTS = 20;

/**
 * The grapple line: sags when slack, straightens when taut.
 *
 * Performance note (this file caused the frame stutters in v0.1): the old
 * version created + disposed a TubeGeometry EVERY FRAME, which hammered the
 * garbage collector. This version allocates one buffer once and rewrites
 * the same vertices in place — zero allocation per frame.
 */
export class Rope {
  private line: THREE.Line;
  private positions: Float32Array;
  private tmpA = new THREE.Vector3();
  private tmpMid = new THREE.Vector3();
  private tmpPoint = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array((SEGMENTS + 1) * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: CONFIG.COLORS.ROPE, transparent: true, opacity: 0.95 })
    );
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);
  }

  update(
    heroPos: THREE.Vector3 | null,
    anchor: { x: number; y: number; z: number } | null,
    tetherLength: number
  ): void {
    if (!heroPos || !anchor) {
      this.line.visible = false;
      return;
    }
    this.line.visible = true;

    this.tmpA.set(anchor.x, anchor.y, anchor.z);
    const d = heroPos.distanceTo(this.tmpA);
    const slack = Math.max(0, tetherLength - d);

    // Midpoint drops with slack (fake catenary — right look, zero cost).
    this.tmpMid.copy(heroPos).add(this.tmpA).multiplyScalar(0.5);
    this.tmpMid.y -= slack * 0.45;

    // Quadratic bezier written straight into the shared buffer.
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const it = 1 - t;
      this.tmpPoint.set(
        it * it * heroPos.x + 2 * it * t * this.tmpMid.x + t * t * this.tmpA.x,
        it * it * heroPos.y + 2 * it * t * this.tmpMid.y + t * t * this.tmpA.y,
        it * it * heroPos.z + 2 * it * t * this.tmpMid.z + t * t * this.tmpA.z
      );
      this.positions[i * 3] = this.tmpPoint.x;
      this.positions[i * 3 + 1] = this.tmpPoint.y;
      this.positions[i * 3 + 2] = this.tmpPoint.z;
    }
    const attr = this.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    this.line.geometry.dispose();
    scene.remove(this.line);
  }
}
