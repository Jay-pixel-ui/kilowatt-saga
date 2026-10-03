/**
 * BLACKOUT PROTOCOL — environmental story beats.
 * Design pillar #2: story is delivered in motion, never via cutscene.
 * Each beacon lit = one line of the story, shown as a toast while you swing.
 */

export const MISSION_TITLE = "BLACKOUT PROTOCOL";

export const MISSION_BRIEF =
  "The grid is dead. Eight signal beacons still hold a charge — fly through them and wake the city.";

/** Shown as beacons light, in lighting order (order-independent lines). */
export const BEACON_LINES: readonly string[] = [
  "Beacon online. Someone cut the grid from INSIDE the utility spine.",
  "Second signal up. The cut lines are clean. This wasn't decay — it was surgery.",
  "Third beacon. The patrol drones aren't city hardware. Someone deployed them.",
  "Interference on this one… something is broadcasting UNDER the streets.",
  "Halfway. The broadcast repeats one word in its header: KILOWATT.",
  "Six up. The drones just changed patrol patterns. They know we're out here.",
  "Seventh signal. KILOWATT isn't stealing the power. They're STORING it. For what?",
  "Last one. Light it, and whoever they are — they'll know exactly where we stand."
];

export const MISSION_COMPLETE_TITLE = "THE GRID BREATHES AGAIN";
export const MISSION_COMPLETE_SUB =
  "The city hums back to life. Somewhere below, KILOWATT is watching. — end of act one —";
