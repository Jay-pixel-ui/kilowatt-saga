import { Room, Client } from "@colyseus/core";
import { MSG, type PosePayload, type BeaconPayload } from "../../shared/protocol.js";
import { CONFIG } from "../../shared/config.js";
import { MissionState, PlayerState } from "../state/MissionState.js";

/**
 * Relay room for the co-op mission. Movement is client-authoritative
 * (see protocol.ts) — the room's job is fast, validated pose fan-out.
 * Mission logic (objectives, story beats) lands here in days 15–16.
 */
export class MissionRoom extends Room<MissionState> {
  maxClients = 4;

  onCreate(): void {
    this.setState(new MissionState());

    this.onMessage(MSG.POSE, (client, msg: PosePayload) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !isSanePose(msg)) return;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      p.vx = msg.vx;
      p.vy = msg.vy;
      p.vz = msg.vz;
      p.yaw = msg.yaw;
      p.grappling = !!msg.g;
      p.gx = msg.gx;
      p.gy = msg.gy;
      p.gz = msg.gz;
    });

    this.onMessage(MSG.BEACON, (client, msg: BeaconPayload) => {
      const i = msg?.i;
      const beacons = CONFIG.MISSION.BEACONS;
      if (typeof i !== "number" || i < 0 || i >= beacons.length) return;
      if (this.state.litMask & (1 << i)) return; // already lit

      // Validate: the claiming player's last relayed pose must actually be
      // near the beacon (LIGHT_RADIUS + latency slack).
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const b = beacons[i];
      const d = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
      if (d > CONFIG.MISSION.LIGHT_RADIUS + CONFIG.MISSION.VALIDATE_SLACK) return;

      this.state.litMask |= 1 << i;
      console.log(`[mission ${this.roomId}] beacon ${i} lit by ${p.name}`);

      const all = (1 << beacons.length) - 1;
      if (this.state.litMask === all && !this.state.complete) {
        this.state.complete = true;
        console.log(`[mission ${this.roomId}] BLACKOUT PROTOCOL complete`);
      }
    });
  }

  onJoin(client: Client, options?: { name?: string }): void {
    const p = new PlayerState();
    p.name = sanitizeName(options?.name) ?? `Vigil-${client.sessionId.slice(0, 4)}`;
    // Spread spawns so players don't stack inside each other.
    const idx = this.state.players.size;
    p.x = (idx % 2) * 6 - 3;
    p.z = Math.floor(idx / 2) * 6 - 3;
    this.state.players.set(client.sessionId, p);
    console.log(`[mission ${this.roomId}] ${p.name} joined (${this.state.players.size}/4)`);
  }

  onLeave(client: Client): void {
    const p = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`[mission ${this.roomId}] ${p?.name ?? client.sessionId} left`);
  }
}

/** Cheap sanity bounds — rejects NaN/Infinity and absurd teleports. */
function isSanePose(m: PosePayload): boolean {
  const nums = [m.x, m.y, m.z, m.vx, m.vy, m.vz, m.yaw, m.gx, m.gy, m.gz];
  return nums.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 5000);
}

function sanitizeName(raw?: string): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, 16).replace(/[^\w \-]/g, "");
  return t.length >= 2 ? t : undefined;
}
