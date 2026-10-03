import * as THREE from "three";
import { CONFIG } from "../shared/config.js";

const C = CONFIG.CAMERA;

/**
 * Third-person orbit camera with two "feel" tricks that cost nothing:
 *  - smoothed follow (the camera is on a spring, not a stick)
 *  - speed-scaled FOV (the world widens as you accelerate — free adrenaline)
 */
export class CameraRig {
  camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = -0.15;

  private currentPos = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(C.FOV_BASE, aspect, 0.1, 1400);
  }

  addLook(dx: number, dy: number): void {
    this.yaw -= dx * C.MOUSE_SENS;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * C.MOUSE_SENS, C.PITCH_MIN, C.PITCH_MAX);
  }

  /** Camera-relative movement basis (y-flattened) for input mapping. */
  moveBasis(): { forward: THREE.Vector3; right: THREE.Vector3 } {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    return { forward, right };
  }

  /** Ray through screen center for grapple aiming. */
  aimRay(): { origin: THREE.Vector3; dir: THREE.Vector3 } {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin: this.camera.position.clone(), dir };
  }

  update(target: THREE.Vector3, speed: number, dt: number): void {
    // Desired position: orbit offset behind + above the hero.
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).multiplyScalar(C.DISTANCE);
    const desired = target.clone().add(offset).add(new THREE.Vector3(0, C.HEIGHT, 0));

    if (!this.initialized) {
      this.currentPos.copy(desired);
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-C.LERP * dt);
      this.currentPos.lerp(desired, k);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(target.clone().add(new THREE.Vector3(0, 1.2, 0)));

    // Speed-scaled FOV.
    const t = Math.min(1, speed / C.FOV_SPEED_REF);
    const targetFov = C.FOV_BASE + (C.FOV_MAX - C.FOV_BASE) * t * t;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 8 * dt);
    this.camera.updateProjectionMatrix();
  }
}
