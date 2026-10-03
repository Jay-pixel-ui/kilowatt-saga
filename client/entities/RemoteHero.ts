import * as THREE from "three";
import { Rope } from "./Rope.js";
import { HeroRig } from "./HeroRig.js";

/**
 * A teammate: no local physics — renders the pose relayed by the server.
 * Interpolates toward the latest snapshot and extrapolates with velocity,
 * so 20Hz updates look like continuous motion.
 */
export class RemoteHero {
  mesh: THREE.Group;
  private rig: HeroRig;
  private rope: Rope;
  private label: THREE.Sprite;

  // Latest snapshot from the network.
  target = new THREE.Vector3();
  velocity = new THREE.Vector3();
  yaw = 0;
  grappling = false;
  anchor = new THREE.Vector3();

  constructor(scene: THREE.Scene, name: string, colorIndex: number) {
    const colors = [0x6cf08c, 0xff6b9d, 0x6cb8ff];
    const color = colors[colorIndex % colors.length];

    this.rig = new HeroRig(color);
    this.mesh = this.rig.root;
    this.label = makeNameSprite(name);
    this.label.position.y = 1.6;
    this.mesh.add(this.label);
    scene.add(this.mesh);

    this.rope = new Rope(scene);
  }

  /** Push the latest network snapshot. */
  snapshot(
    p: { x: number; y: number; z: number },
    v: { x: number; y: number; z: number },
    yaw: number,
    grappling: boolean,
    anchor: { x: number; y: number; z: number }
  ): void {
    this.target.set(p.x, p.y, p.z);
    this.velocity.set(v.x, v.y, v.z);
    this.yaw = yaw;
    this.grappling = grappling;
    this.anchor.set(anchor.x, anchor.y, anchor.z);
  }

  /** Called every render frame. */
  update(dt: number): void {
    // Advance the target by velocity (dead reckoning between snapshots)…
    this.target.addScaledVector(this.velocity, dt);
    // …and ease the mesh toward it.
    const k = 1 - Math.exp(-12 * dt);
    this.mesh.position.lerp(this.target, k);
    this.mesh.rotation.y += shortestAngle(this.mesh.rotation.y, this.yaw) * k;

    // Animate the rig from the relayed motion (grounded is inferred).
    const speed = this.velocity.length();
    const grounded = Math.abs(this.velocity.y) < 1.5 && this.target.y < 3;
    this.rig.update(dt, speed, this.velocity.y, grounded, this.grappling);

    this.rope.update(
      this.grappling ? this.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)) : null,
      this.grappling ? { x: this.anchor.x, y: this.anchor.y, z: this.anchor.z } : null,
      this.grappling ? this.mesh.position.distanceTo(this.anchor) : 0
    );
  }

  dispose(scene: THREE.Scene): void {
    this.rope.dispose(scene);
    scene.remove(this.mesh);
  }
}

function makeNameSprite(name: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 6;
  ctx.fillText(name, 128, 40);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false })
  );
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
