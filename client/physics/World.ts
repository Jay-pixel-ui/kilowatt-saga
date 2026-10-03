import RAPIER from "@dimforge/rapier3d-compat";
import { CONFIG } from "../../shared/config.js";

/**
 * Rapier world wrapper: init, fixed-timestep stepping, static geometry helper.
 * Fixed timestep keeps physics deterministic regardless of display refresh
 * rate (a 144Hz monitor must not swing differently than a 60Hz one).
 */
export class PhysicsWorld {
  world!: RAPIER.World;
  private accumulator = 0;
  static readonly FIXED_DT = 1 / 60;

  /** Must be awaited once before anything else touches physics. */
  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: CONFIG.GRAVITY, z: 0 });
    this.world.timestep = PhysicsWorld.FIXED_DT;
  }

  /**
   * Advance simulation by frame time, stepping in fixed increments.
   * `onStep` runs after every fixed step (constraint logic hooks in here).
   * Returns the interpolation alpha for rendering between steps.
   */
  update(frameDt: number, onStep: (dt: number) => void): number {
    this.accumulator += Math.min(frameDt, 0.1); // clamp: no spiral of death after tab-out
    while (this.accumulator >= PhysicsWorld.FIXED_DT) {
      this.world.step();
      onStep(PhysicsWorld.FIXED_DT);
      this.accumulator -= PhysicsWorld.FIXED_DT;
    }
    return this.accumulator / PhysicsWorld.FIXED_DT;
  }

  /** Static axis-aligned box collider (buildings, ground). */
  addStaticBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz)
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
  }

  /**
   * Raycast for grapple aiming. Returns hit point + distance, or null.
   * `excludeCollider` keeps the hero from grappling themselves.
   */
  raycast(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxDist: number,
    excludeCollider?: RAPIER.Collider
  ): { point: { x: number; y: number; z: number }; dist: number } | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRay(
      ray,
      maxDist,
      true,
      undefined,
      undefined,
      excludeCollider
    );
    if (!hit) return null;
    const point = ray.pointAt(hit.timeOfImpact);
    return { point: { x: point.x, y: point.y, z: point.z }, dist: hit.timeOfImpact };
  }
}
