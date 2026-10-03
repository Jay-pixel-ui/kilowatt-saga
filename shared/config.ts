/**
 * Single source of truth for ALL tuning values.
 * The swing's "feel" lives in this file — iterate here first, code second.
 */
export const CONFIG = {
  GRAVITY: -22, // slightly stronger than earth = weightier, snappier arcs

  HERO: {
    /** Capsule half-height (between hemisphere centers) and radius, meters. */
    CAPSULE_HALF: 0.6,
    RADIUS: 0.4,
    SPAWN: { X: 0, Y: 40, Z: 0 },

    WALK_ACCEL: 60,
    WALK_MAX: 8,
    RUN_MAX: 13,
    GROUND_FRICTION: 8, // exponential damping when no input
    JUMP_SPEED: 9.5,
    /** Steering force while airborne, not swinging (m/s²). */
    AIR_ACCEL: 12,
    AIR_MAX: 10
  },

  GRAPPLE: {
    /** Max distance a grapple shot can reach, meters. */
    MAX_RANGE: 70,
    /**
     * On attach, the tether is set to this fraction of the actual distance.
     * <1 means the rope always YANKS you into motion immediately — fixes
     * "attached but nothing happens" when firing from the ground.
     */
    ATTACH_TAUTEN: 0.85,
    /** Launch impulse toward the anchor on attach (m/s). */
    ZIP_BOOST: 7,
    /** Extra upward component of the attach launch when grounded (m/s). */
    ZIP_UP_BOOST: 5,
    /** Swing steering force while attached (m/s²). Pumps the arc. */
    SWING_ACCEL: 20,
    /** Reel speed (meters/second) while holding reel keys. */
    REEL_SPEED: 14,
    /** Minimum tether length you can reel down to. */
    MIN_LENGTH: 3,
    /** Velocity boost multiplier on release (momentum reward). */
    RELEASE_BOOST: 1.12,
    /** Extra upward kick on release, m/s (makes release arcs feel heroic). */
    RELEASE_UP_KICK: 3.5
  },

  CAMERA: {
    FOV_BASE: 72,
    /** FOV widens with speed up to this at max — cheap, powerful speed feel. */
    FOV_MAX: 88,
    /** Speed (m/s) at which FOV reaches max. */
    FOV_SPEED_REF: 30,
    DISTANCE: 7,
    HEIGHT: 2.2,
    /** Follow smoothing (higher = tighter). */
    LERP: 12,
    MOUSE_SENS: 0.0024,
    PITCH_MIN: -1.2,
    PITCH_MAX: 1.35
  },

  CITY: {
    /** Buildings per side of the grid. 11×11 = a real district to explore. */
    GRID: 11,
    /** Street corridor between plots: 12m road + two 4m sidewalks. */
    STREET: 20,
    ROAD: 12,
    SIDEWALK: 4,
    /** Building plot, meters — closer to a real small city block. */
    PLOT: 34,
    /** Roughly one plot in this many becomes a park (deterministic). */
    PARK_CHANCE: 0.12,
    /**
     * Districts by ring distance from center: a skyline that reads from
     * anywhere — towering core, mid-rise ring, low outskirts.
     */
    CORE: { MIN: 60, MAX: 110 },
    MID: { MIN: 32, MAX: 72 },
    OUTER: { MIN: 15, MAX: 42 },
    /** Deterministic layout seed (same city every run — level, not noise). */
    SEED: 1337
  },

  TRAFFIC: {
    CARS: 120,
    SPEED_MIN: 9,
    SPEED_MAX: 17
  },

  SHARDS: {
    COUNT: 36,
    PICKUP_RADIUS: 3.2
  },

  DRONES: {
    COUNT: 7,
    ALTITUDE: 24,
    SPEED: 7,
    /** Getting this close triggers the alarm + shove. */
    ALERT_RADIUS: 9,
    SHOVE: 18,
    /** Seconds of immunity after a shove. */
    COOLDOWN: 2.5,
    /** Hit a drone BODY faster than this (m/s) to destroy it (Act 2). */
    TAKEDOWN_SPEED: 20,
    TAKEDOWN_RADIUS: 3.5
  },

  MISSION: {
    /**
     * BLACKOUT PROTOCOL — the city's grid is dead; relight the signal
     * beacons. Positions are authored: floating in street canyons so
     * reaching them REQUIRES swinging. Ordered as a difficulty ramp that
     * now walks you outward through every district of the bigger city.
     */
    BEACONS: [
      { x: 0, y: 22, z: 0 }, // above the plaza — the tutorial beacon
      { x: 27, y: 36, z: 27 }, // first canyon, one block out
      { x: -81, y: 44, z: 27 }, // west canyon, mid-height
      { x: 81, y: 52, z: -135 }, // north-east, higher
      { x: -27, y: 58, z: -189 }, // deep north canyon
      { x: 189, y: 62, z: 81 }, // far east, mid-ring rooftop level
      { x: -189, y: 66, z: -27 }, // far west
      { x: 27, y: 72, z: 243 } // the outskirts finale, highest
    ],
    /** How close (meters) a hero must pass to light a beacon. */
    LIGHT_RADIUS: 7,
    /** Server-side validation slack on top of LIGHT_RADIUS (net latency). */
    VALIDATE_SLACK: 6
  },

  COLORS: {
    /** Daytime palette. */
    SKY: 0x8fc3f2,
    FOG: 0xc9dcef,
    GROUND: 0x9aa17c,
    ROAD: 0x3d4045,
    SIDEWALK: 0xb9b4a8,
    LANE_PAINT: 0xe8e4d8,
    GRASS: 0x6fa055,
    /** Facade color variety — real cities aren't one color. */
    FACADES: [0xc9b8a0, 0xb5877a, 0xa8b3bd, 0xd7cfc2, 0x8f9aa6, 0xc2a06b],
    ROOF: 0x8c8578,
    HERO: 0x2456c4,
    ROPE: 0x4a4438,
    RETICLE_OK: "#2e9e4f",
    RETICLE_NO: "#00000055"
  },

  /** Story flavor: district names by ring distance from the core. */
  DISTRICTS: ["KILOWATT PLAZA", "THE EXCHANGE", "MIDTOWN ROWS", "GREENLINE", "THE FRINGE", "THE FRINGE"]
} as const;
