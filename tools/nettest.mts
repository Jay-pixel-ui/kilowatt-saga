/** E2E: two bot clients exchange poses through the real MissionRoom. */
import { Client } from "colyseus.js";
import "../server/index.js";
await new Promise(r => setTimeout(r, 800));

const a = await new Client("ws://localhost:2567").joinOrCreate("mission", { name: "BotA" });
const b = await new Client("ws://localhost:2567").joinOrCreate("mission", { name: "BotB" });
await new Promise(r => setTimeout(r, 400));

console.log("both joined:", (a.state as any).players.size === 2 ? "PASS" : "FAIL");

// A swings; B should see it.
a.send("pose", { x: 42, y: 33, z: -7, vx: 12, vy: -3, vz: 0, yaw: 1.2, g: true, gx: 50, gy: 60, gz: 0 });
await new Promise(r => setTimeout(r, 400));
const seenA = (b.state as any).players.get(a.sessionId);
console.log("pose relayed:", seenA?.x === 42 && Math.abs(seenA?.yaw - 1.2) < 1e-4 ? "PASS" : `FAIL (${seenA?.x},${seenA?.yaw})`);
console.log("grapple state relayed:", seenA?.grappling === true && seenA?.gy === 60 ? "PASS" : "FAIL");

// Garbage pose rejected (NaN teleport hack).
a.send("pose", { x: NaN, y: 1e9, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, g: false, gx: 0, gy: 0, gz: 0 });
await new Promise(r => setTimeout(r, 300));
console.log("insane pose rejected:", (b.state as any).players.get(a.sessionId)?.x === 42 ? "PASS" : "FAIL");

// Leave cleans up.
await a.leave();
await new Promise(r => setTimeout(r, 300));
console.log("leave removes player:", (b.state as any).players.size === 1 ? "PASS" : "FAIL");


// ---- mission: beacons ----
const c = await new Client("ws://localhost:2567").joinOrCreate("mission", { name: "BotC" });
await new Promise(r => setTimeout(r, 300));
const cs = () => c.state as any;

// Too far away → rejected.
c.send("pose", { x: 500, y: 5, z: 500, vx: 0, vy: 0, vz: 0, yaw: 0, g: false, gx: 0, gy: 0, gz: 0 });
await new Promise(r => setTimeout(r, 250));
c.send("beacon", { i: 0 });
await new Promise(r => setTimeout(r, 250));
console.log("far beacon claim rejected:", cs().litMask === 0 ? "PASS" : `FAIL (${cs().litMask})`);

// Fly to each beacon and light it (positions from the real shared config).
const { CONFIG } = await import("../shared/config.js");
const BEACONS = CONFIG.MISSION.BEACONS;
for (let i = 0; i < BEACONS.length; i++) {
  const b = BEACONS[i];
  c.send("pose", { x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, yaw: 0, g: false, gx: 0, gy: 0, gz: 0 });
  await new Promise(r => setTimeout(r, 150));
  c.send("beacon", { i });
  await new Promise(r => setTimeout(r, 150));
}
const ALL = (1 << BEACONS.length) - 1;
console.log("all beacons lit:", cs().litMask === ALL ? "PASS" : `FAIL (${cs().litMask})`);
console.log("mission complete flag:", cs().complete === true ? "PASS" : "FAIL");

// Invalid index ignored without crash.
c.send("beacon", { i: 99 });
await new Promise(r => setTimeout(r, 200));
console.log("invalid index survives:", cs().litMask === ALL ? "PASS" : "FAIL");

process.exit(0);
