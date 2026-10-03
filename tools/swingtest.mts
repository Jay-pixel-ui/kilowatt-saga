/** Headless test of the REAL shipped bricks: PhysicsWorld + Grapple. */
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld } from "../client/physics/World.js";
import { Grapple } from "../client/physics/Grapple.js";
import { CONFIG } from "../shared/config.js";

const physics = new PhysicsWorld();
await physics.init();
physics.addStaticBox(0, -1, 0, 200, 1, 200); // ground

const body = physics.world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic().setTranslation(20, 35, 0).lockRotations().setCcdEnabled(true)
);
const col = physics.world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.4), body);

const grapple = new Grapple();
grapple.fire({ x: 0, y: 55, z: 0 }, body.translation(), body, false);
console.log("tether length:", grapple.length.toFixed(1));

let minX = Infinity, maxSpeed = 0, maxStretch = 0;
for (let i = 0; i < 300; i++) {
  physics.update(1 / 60, (dt) => {
    grapple.step(body, { x: 0, z: 0 }, 0, dt);
    const p = body.translation();
    const d = Math.hypot(p.x, p.y - 55, p.z);
    maxStretch = Math.max(maxStretch, d - grapple.length);
    minX = Math.min(minX, p.x);
    const v = body.linvel();
    maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z));
  });
}
console.log("pendulum swing past bottom:", minX < -8 ? "PASS" : `FAIL (${minX.toFixed(1)})`);
console.log("speed gained:", maxSpeed > 15 ? "PASS" : `FAIL (${maxSpeed.toFixed(1)})`);
console.log("rope stayed taut-bounded:", maxStretch < 0.5 ? "PASS" : `FAIL (${maxStretch.toFixed(2)})`);

// Release: momentum boost applied
const vBefore = Math.hypot(body.linvel().x, body.linvel().y, body.linvel().z);
grapple.release(body);
const vAfter = Math.hypot(body.linvel().x, body.linvel().y, body.linvel().z);
console.log("release boost:", vAfter > vBefore ? "PASS" : `FAIL (${vBefore.toFixed(1)} -> ${vAfter.toFixed(1)})`);

// Raycast (aiming path used by Hero.tryFire)
const hit = physics.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, 50, col);
console.log("aim raycast hits ground:", hit && Math.abs(hit.dist - 10) < 0.5 ? "PASS" : `FAIL (${JSON.stringify(hit)})`);

// Reel-in shortens rope
grapple.fire({ x: 0, y: 55, z: 0 }, body.translation(), body, false);
const len0 = grapple.length;
for (let i = 0; i < 60; i++) physics.update(1 / 60, (dt) => grapple.step(body, { x: 0, z: 0 }, -1, dt));
console.log("reel-in shortens:", grapple.length < len0 - 5 ? "PASS" : `FAIL (${len0.toFixed(1)} -> ${grapple.length.toFixed(1)})`);
