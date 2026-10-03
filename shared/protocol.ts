/**
 * Client↔server message contract.
 *
 * Netcode model (deliberate scope trade, documented in the strategy doc):
 * movement is CLIENT-AUTHORITATIVE. Each client simulates its own physics
 * locally for zero-latency feel and streams its pose; the server relays.
 * Right trade for co-op with friends; would be wrong for ranked competitive.
 */

export const ROOM = "mission";
export const PORT = 2567;

/** How often each client sends its pose (Hz). */
export const POSE_SEND_RATE = 20;

export const MSG = {
  /** Client → server: full local pose. */
  POSE: "pose",
  /** Client → server: "I flew through beacon i". Server validates proximity. */
  BEACON: "beacon"
} as const;

export interface BeaconPayload {
  i: number;
}

export interface PosePayload {
  x: number;
  y: number;
  z: number;
  /** Velocity lets remote clients extrapolate between updates. */
  vx: number;
  vy: number;
  vz: number;
  /** Facing (radians). */
  yaw: number;
  /** Grapple state so remotes can render each other's ropes. */
  g: boolean;
  gx: number;
  gy: number;
  gz: number;
}
