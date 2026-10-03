import { Schema, type, MapSchema } from "@colyseus/schema";

/** One player's relayed pose (written by their client, read by everyone). */
export class PlayerState extends Schema {
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 40;
  @type("number") z = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("number") vz = 0;
  @type("number") yaw = 0;
  @type("boolean") grappling = false;
  @type("number") gx = 0;
  @type("number") gy = 0;
  @type("number") gz = 0;
}

export class MissionState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  /** Bitmask of lit beacons (bit i = beacon i). Compact + atomic. */
  @type("number") litMask = 0;
  @type("boolean") complete = false;
}
