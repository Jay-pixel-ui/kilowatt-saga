import * as THREE from "three";

/**
 * The articulated hero: a real jointed body with procedural animation.
 * No skeleton files, no mocap — limbs are posed every frame from movement
 * state, which means animation always matches physics exactly:
 *
 *  - grounded + moving  → run cycle (legs scissor, arms counter-swing,
 *                          cadence scales with speed)
 *  - grounded + still   → idle breathing
 *  - swinging           → superhero pose: arm up the rope, legs trailing
 *  - airborne           → skydive spread, legs tucked by fall speed
 */
export class HeroRig {
  root: THREE.Group;

  private hips: THREE.Group;
  private torso: THREE.Group;
  private head: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private forearmL: THREE.Group;
  private forearmR: THREE.Group;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private shinL: THREE.Group;
  private shinR: THREE.Group;
  private cape: THREE.Mesh;

  private phase = 0;
  private t = 0;

  constructor(accent: number) {
    this.root = new THREE.Group();

    const suit = new THREE.MeshStandardMaterial({ color: 0x231c3d, roughness: 0.7, metalness: 0.2 });
    const suitDark = new THREE.MeshStandardMaterial({ color: 0x161129, roughness: 0.8, metalness: 0.1 });
    const glow = new THREE.MeshBasicMaterial({ color: accent });

    // Proportions (meters, human-ish at ~1.8m tall inside a 0.4-radius capsule).
    const box = (
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0
    ): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

    // Hips are the animation root; physics capsule center maps here.
    this.hips = new THREE.Group();
    this.hips.position.y = 0.05;
    this.root.add(this.hips);
    this.hips.add(box(0.34, 0.22, 0.22, suit));

    // Torso + chest emblem.
    this.torso = new THREE.Group();
    this.torso.position.y = 0.32;
    this.hips.add(this.torso);
    const chest = box(0.4, 0.44, 0.26, suit, 0, 0.1, 0);
    const emblem = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 3), glow);
    emblem.rotation.x = Math.PI;
    emblem.position.set(0, 0.14, 0.14);
    this.torso.add(chest, emblem);

    // Head + visor.
    this.head = new THREE.Group();
    this.head.position.y = 0.44;
    this.torso.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), suit);
    skull.castShadow = true;
    const visor = box(0.2, 0.05, 0.04, glow, 0, 0.02, 0.12);
    this.head.add(skull, visor);

    // Arms: shoulder pivot → upper arm → elbow pivot → forearm.
    const makeArm = (side: 1 | -1): [THREE.Group, THREE.Group] => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.26, 0.26, 0);
      this.torso.add(shoulder);
      shoulder.add(box(0.11, 0.34, 0.11, suit, 0, -0.17, 0));
      const elbow = new THREE.Group();
      elbow.position.y = -0.34;
      shoulder.add(elbow);
      elbow.add(box(0.09, 0.3, 0.09, suitDark, 0, -0.15, 0));
      return [shoulder, elbow];
    };
    [this.armL, this.forearmL] = makeArm(-1);
    [this.armR, this.forearmR] = makeArm(1);

    // Legs: hip pivot → thigh → knee pivot → shin+boot.
    const makeLeg = (side: 1 | -1): [THREE.Group, THREE.Group] => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.1, -0.12, 0);
      this.hips.add(hip);
      hip.add(box(0.13, 0.38, 0.14, suit, 0, -0.19, 0));
      const knee = new THREE.Group();
      knee.position.y = -0.38;
      hip.add(knee);
      knee.add(box(0.11, 0.36, 0.12, suitDark, 0, -0.18, 0));
      knee.add(box(0.12, 0.08, 0.2, suitDark, 0, -0.36, 0.03)); // boot
      return [hip, knee];
    };
    [this.legL, this.shinL] = makeLeg(-1);
    [this.legR, this.shinR] = makeLeg(1);

    // Cape (animated by pose).
    this.cape = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.9, 1, 4),
      new THREE.MeshStandardMaterial({ color: 0x120d24, roughness: 1, side: THREE.DoubleSide })
    );
    this.cape.position.set(0, 0.28, -0.16);
    this.cape.rotation.x = 0.15;
    this.torso.add(this.cape);
  }

  /**
   * Pose the body from movement state. Call every render frame.
   * `speed` m/s, `vy` vertical velocity, flags for grounded/swinging.
   */
  update(dt: number, speed: number, vy: number, grounded: boolean, swinging: boolean): void {
    this.t += dt;

    if (swinging) {
      this.poseSwing(dt, speed);
    } else if (!grounded) {
      this.poseAir(dt, vy);
    } else if (speed > 1.2) {
      this.poseRun(dt, speed);
    } else {
      this.poseIdle(dt);
    }
  }

  private poseRun(dt: number, speed: number): void {
    // Cadence rises with speed: ~2.2 Hz walk → ~3.4 Hz sprint.
    const cadence = 2.2 + Math.min(1, speed / 13) * 1.2;
    this.phase += dt * cadence * Math.PI * 2;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const amp = 0.55 + Math.min(1, speed / 13) * 0.35;

    // Legs scissor; knees bend on the back-swing (never backwards).
    this.legL.rotation.x = s * amp;
    this.legR.rotation.x = -s * amp;
    this.shinL.rotation.x = Math.max(0, -s) * amp * 1.3;
    this.shinR.rotation.x = Math.max(0, s) * amp * 1.3;

    // Arms counter-swing, elbows slightly bent.
    this.armL.rotation.x = -s * amp * 0.8;
    this.armR.rotation.x = s * amp * 0.8;
    this.forearmL.rotation.x = -0.5;
    this.forearmR.rotation.x = -0.5;

    // Body lean + bounce + cape flare.
    this.torso.rotation.x = lerpTo(this.torso.rotation.x, 0.18 + Math.min(0.2, speed * 0.01), dt, 8);
    this.hips.position.y = 0.05 + Math.abs(c) * 0.05;
    this.cape.rotation.x = lerpTo(this.cape.rotation.x, 0.3 + Math.min(0.5, speed * 0.03), dt, 6);
    this.head.rotation.x = -0.1;
  }

  private poseIdle(dt: number): void {
    const breathe = Math.sin(this.t * 1.8) * 0.02;
    this.relaxAll(dt);
    this.torso.rotation.x = lerpTo(this.torso.rotation.x, breathe, dt, 4);
    this.hips.position.y = lerpTo(this.hips.position.y, 0.05, dt, 6);
    this.cape.rotation.x = lerpTo(this.cape.rotation.x, 0.15 + breathe, dt, 3);
  }

  private poseSwing(dt: number, speed: number): void {
    // Right arm reaches up the rope; body arcs; legs trail together.
    this.armR.rotation.x = lerpTo(this.armR.rotation.x, Math.PI * 0.92, dt, 10);
    this.forearmR.rotation.x = lerpTo(this.forearmR.rotation.x, 0.15, dt, 10);
    this.armL.rotation.x = lerpTo(this.armL.rotation.x, -0.6, dt, 8);
    this.forearmL.rotation.x = lerpTo(this.forearmL.rotation.x, -0.7, dt, 8);

    const trail = Math.min(0.9, 0.3 + speed * 0.02);
    this.legL.rotation.x = lerpTo(this.legL.rotation.x, -trail, dt, 6);
    this.legR.rotation.x = lerpTo(this.legR.rotation.x, -trail * 0.75, dt, 6);
    this.shinL.rotation.x = lerpTo(this.shinL.rotation.x, trail * 0.8, dt, 6);
    this.shinR.rotation.x = lerpTo(this.shinR.rotation.x, trail * 1.1, dt, 6);

    this.torso.rotation.x = lerpTo(this.torso.rotation.x, -0.25, dt, 6);
    this.cape.rotation.x = lerpTo(this.cape.rotation.x, 0.9, dt, 5);
    this.head.rotation.x = lerpTo(this.head.rotation.x, 0.25, dt, 6);
    this.hips.position.y = lerpTo(this.hips.position.y, 0.05, dt, 6);
  }

  private poseAir(dt: number, vy: number): void {
    // Rising: tucked and heroic. Falling: spread-eagle, cape roaring.
    const falling = THREE.MathUtils.clamp(-vy / 25, 0, 1);
    this.armL.rotation.x = lerpTo(this.armL.rotation.x, -1.1 - falling * 0.6, dt, 6);
    this.armR.rotation.x = lerpTo(this.armR.rotation.x, -1.1 - falling * 0.6, dt, 6);
    this.armL.rotation.z = lerpTo(this.armL.rotation.z, -0.5, dt, 6);
    this.armR.rotation.z = lerpTo(this.armR.rotation.z, 0.5, dt, 6);
    this.forearmL.rotation.x = lerpTo(this.forearmL.rotation.x, -0.3, dt, 6);
    this.forearmR.rotation.x = lerpTo(this.forearmR.rotation.x, -0.3, dt, 6);

    this.legL.rotation.x = lerpTo(this.legL.rotation.x, 0.35 - falling * 0.65, dt, 6);
    this.legR.rotation.x = lerpTo(this.legR.rotation.x, 0.15 - falling * 0.35, dt, 6);
    this.shinL.rotation.x = lerpTo(this.shinL.rotation.x, 0.5 + falling * 0.4, dt, 6);
    this.shinR.rotation.x = lerpTo(this.shinR.rotation.x, 0.7 + falling * 0.4, dt, 6);

    this.torso.rotation.x = lerpTo(this.torso.rotation.x, -0.1 + falling * 0.35, dt, 5);
    this.cape.rotation.x = lerpTo(this.cape.rotation.x, 0.5 + falling * 0.9, dt, 4);
  }

  private relaxAll(dt: number): void {
    for (const g of [
      this.armL,
      this.armR,
      this.legL,
      this.legR,
      this.shinL,
      this.shinR,
      this.forearmL,
      this.forearmR,
      this.head
    ]) {
      g.rotation.x = lerpTo(g.rotation.x, 0, dt, 5);
      g.rotation.z = lerpTo(g.rotation.z, 0, dt, 5);
    }
    this.armL.rotation.z = lerpTo(this.armL.rotation.z, 0, dt, 5);
    this.armR.rotation.z = lerpTo(this.armR.rotation.z, 0, dt, 5);
  }
}

function lerpTo(current: number, target: number, dt: number, rate: number): number {
  return current + (target - current) * Math.min(1, rate * dt);
}
