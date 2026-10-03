import type * as THREE from "three";
import type { Room } from "colyseus.js";
import { CONFIG } from "../../shared/config.js";
import { MSG } from "../../shared/protocol.js";
import type { Beacons } from "../entities/Beacons.js";
import {
  MISSION_TITLE,
  MISSION_BRIEF,
  BEACON_LINES,
  MISSION_COMPLETE_TITLE,
  MISSION_COMPLETE_SUB
} from "./beats.js";

/**
 * Client-side mission glue: proximity checks, objective HUD, story toasts,
 * finale. Works online (litMask lives in room state, shared by the squad)
 * AND offline (local mask) — same code path either way.
 */
export class MissionDirector {
  private localMask = 0;
  private shownLines = 0b0;
  private finaleShown = false;

  private objectiveEl = document.getElementById("objective")!;
  private toastEl = document.getElementById("toast")!;
  private finaleEl = document.getElementById("finale")!;
  private toastTimer: number | undefined;

  /** Fires when a beacon lights (for sfx). */
  onBeaconLit: ((i: number) => void) | null = null;
  /** Fires once when the mission completes (for sfx). */
  onComplete: (() => void) | null = null;

  constructor(
    private beacons: Beacons,
    private net: Room | null
  ) {
    this.toast(`${MISSION_TITLE} — ${MISSION_BRIEF}`, 7000);
    this.renderObjective(0);
  }

  get litMask(): number {
    if (this.net) return ((this.net.state as any)?.litMask as number) ?? 0;
    return this.localMask;
  }

  get complete(): boolean {
    if (this.net) return !!((this.net.state as any)?.complete as boolean);
    return this.localMask === (1 << this.beacons.count) - 1;
  }

  update(heroPos: THREE.Vector3): void {
    const mask = this.litMask;

    // Proximity: try to light any unlit beacon we're passing through.
    for (let i = 0; i < this.beacons.count; i++) {
      if (mask & (1 << i)) continue;
      if (this.beacons.distanceTo(i, heroPos) <= CONFIG.MISSION.LIGHT_RADIUS) {
        if (this.net) this.net.send(MSG.BEACON, { i });
        else this.localMask |= 1 << i;
      }
    }

    // Story lines: react to the (possibly remote) mask, one line per beacon.
    // A teammate lighting a beacon shows the line on YOUR screen too.
    const current = this.litMask;
    for (let i = 0; i < this.beacons.count; i++) {
      const bit = 1 << i;
      if (current & bit && !(this.shownLines & bit)) {
        this.shownLines |= bit;
        const litCount = countBits(current);
        this.toast(BEACON_LINES[litCount - 1] ?? BEACON_LINES[i], 5000);
        this.renderObjective(litCount);
        this.onBeaconLit?.(i);
      }
    }

    if (this.complete && !this.finaleShown) {
      this.finaleShown = true;
      this.finaleEl.innerHTML = `<h1>${MISSION_COMPLETE_TITLE}</h1><p>${MISSION_COMPLETE_SUB}</p>`;
      this.finaleEl.style.opacity = "1";
      this.onComplete?.();
      window.setTimeout(() => {
        this.finaleEl.style.opacity = "0";
      }, 9000);
    }
  }

  /** Public toast for world systems (districts, shard lore, etc). */
  say(text: string, ms: number): void {
    this.toast(text, ms);
  }

  /** Act 2: called when a drone goes down. */
  droneDown(downed: number, total: number): void {
    if (downed === 1) {
      this.toast("It shattered like glass. KILOWATT's eyes can be CLOSED. Close all of them.", 5500);
    } else if (downed === total) {
      this.toast("Last drone down. The sky belongs to us. KILOWATT is blind — for now.", 7000);
    } else {
      this.toast(`Drone destroyed. ${total - downed} still watching.`, 3000);
    }
    this.objectiveEl.textContent =
      downed >= total ? "✦ the sky is yours" : `✦ grid restored — hunt drones: ${downed} / ${total}`;
  }

  private renderObjective(lit: number): void {
    this.objectiveEl.textContent = this.complete
      ? "✦ grid restored — hunt the drones (hit them at speed)"
      : `signal beacons: ${lit} / ${this.beacons.count}`;
  }

  private toast(text: string, ms: number): void {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = "1";
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.style.opacity = "0";
    }, ms);
  }
}

function countBits(n: number): number {
  let c = 0;
  while (n) {
    c += n & 1;
    n >>>= 1;
  }
  return c;
}
