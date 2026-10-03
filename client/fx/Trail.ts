import * as THREE from "three";

const POINTS = 36;

/**
 * Speed ribbon behind the hero while swinging fast.
 * Preallocated line, opacity scales with speed — free sense of velocity.
 */
export class Trail {
  private line: THREE.Line;
  private positions: Float32Array;
  private material: THREE.LineBasicMaterial;
  private filled = 0;

  constructor(scene: THREE.Scene, color = 0xffc93c) {
    this.positions = new Float32Array(POINTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
    this.line = new THREE.Line(geo, this.material);
    this.line.frustumCulled = false;
    scene.add(this.line);
  }

  update(pos: THREE.Vector3, speed: number): void {
    // Shift history back one slot (in place).
    for (let i = POINTS - 1; i > 0; i--) {
      this.positions[i * 3] = this.positions[(i - 1) * 3];
      this.positions[i * 3 + 1] = this.positions[(i - 1) * 3 + 1];
      this.positions[i * 3 + 2] = this.positions[(i - 1) * 3 + 2];
    }
    this.positions[0] = pos.x;
    this.positions[1] = pos.y;
    this.positions[2] = pos.z;
    if (this.filled < POINTS) {
      // Until history fills, collapse unused points onto the head.
      for (let i = this.filled + 1; i < POINTS; i++) {
        this.positions[i * 3] = pos.x;
        this.positions[i * 3 + 1] = pos.y;
        this.positions[i * 3 + 2] = pos.z;
      }
      this.filled++;
    }
    (this.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

    // Fade in above 14 m/s, full at 30.
    const t = THREE.MathUtils.clamp((speed - 14) / 16, 0, 1);
    this.material.opacity = t * 0.55;
  }
}
