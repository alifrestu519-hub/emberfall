// Rootwarden — every tuning number, colour and definition in one place.
// The clearing is a fixed 1280x720 logical field; the renderer scales it
// to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The top HUD bar and the bottom build bar, in logical pixels. */
export const HUD_HEIGHT = 64;
export const BUILD_BAR_Y = 628;

/** The Heartwood stands here; the Blight marches toward it. */
export const TREE = { x: 640, y: 332, radius: 52, biteRadius: 58 };

/** Twelve waves, then the Hollow Stag. Survive them all to win. */
export const TOTAL_WAVES = 12;

/** Seconds of calm to build between waves; starting early pays Sap. */
export const BUILD_TIME = 20;

/** Sap per kill is the enemy's own bounty, plus this global bonus. */
export const KILL_SAP_BONUS = 0;

/** The six growths the Warden can plant. Costs are Sap. */
export const GROWTHS = {
  thorn: {
    key: '1', name: 'Thorn Turret', short: 'Thorn',
    cost: 50, range: 178, damage: 13, interval: 0.42, hp: 120,
    colour: '#8fd45e', dark: '#4a7d2e',
    desc: 'Fast thorns, one foe.',
    tip: 'Cheap and quick — the backbone of any grove.',
  },
  sprayer: {
    key: '2', name: 'Sap Sprayer', short: 'Sprayer',
    cost: 70, range: 152, damage: 4, interval: 0.5, hp: 120,
    slow: 0.45, slowTime: 1.3, colour: '#e8b23a', dark: '#9a7418',
    desc: 'Slows foes in a cone.',
    tip: 'Slow them where your thorns can reach.',
  },
  spore: {
    key: '3', name: 'Spore Cloud', short: 'Spore',
    cost: 90, range: 138, dps: 10, hp: 120,
    colour: '#b07fe8', dark: '#6d4a9e',
    desc: 'Poison cloud, hurts all.',
    tip: 'Melts crowds and flying Wisps alike.',
  },
  wall: {
    key: '4', name: 'Root Wall', short: 'Wall',
    cost: 40, range: 0, damage: 0, interval: 1, hp: 240,
    thornDamage: 7, blockRadius: 34, colour: '#a07a4a', dark: '#6b4e28',
    desc: 'Blocks the path.',
    tip: 'Chewers hurt themselves on its thorns.',
  },
  sunbloom: {
    key: '5', name: 'Sunbloom', short: 'Sunbloom',
    cost: 60, range: 0, damage: 0, interval: 1, hp: 70,
    income: 16, trickle: 0.5, colour: '#ffd166', dark: '#c08a1e',
    desc: 'Grows Sap each wave.',
    tip: 'Plant early — it pays for itself.',
  },
  mine: {
    key: '6', name: 'Bramble Mine', short: 'Mine',
    cost: 30, range: 0, damage: 110, interval: 1, hp: 40,
    blastRadius: 88, triggerRadius: 48, colour: '#d96a4a', dark: '#93381f',
    desc: 'Big boom, one shot.',
    tip: 'One shot, big boom. Great on brutes.',
  },
};
export const GROWTH_ORDER = ['thorn', 'sprayer', 'spore', 'wall', 'sunbloom', 'mine'];
/** The growths a new Warden already knows; the rest come from the draft. */
export const START_UNLOCKED = ['thorn', 'sprayer', 'sunbloom'];

/** Upgrade tiers: what each tier multiplies, and what it costs. */
export const TIERS = [
  null,
  { damage: 1, range: 1, interval: 1, hp: 1, income: 1 },
  { damage: 1.6, range: 1.12, interval: 0.85, hp: 1.8, income: 1.6, costMult: 0.8 },
  { damage: 2.5, range: 1.25, interval: 0.72, hp: 3, income: 2.4, costMult: 1.3 },
];
export const MAX_TIER = 3;
/** Selling a growth returns this share of everything spent on it. */
export const SELL_REFUND = 0.7;

/** The Blight's kinds. hp and speed scale with the wave; sap is the bounty. */
export const ENEMIES = {
  sproutling: { name: 'Sproutling', hp: 30, speed: 58, radius: 12, bite: 6, sap: 4, score: 10, colour: '#7fae4a', dark: '#4d7a2a' },
  husk: { name: 'Husk', hp: 100, speed: 38, radius: 16, bite: 10, sap: 6, score: 20, colour: '#9a8a6a', dark: '#6b5d42' },
  spitter: { name: 'Spitter', hp: 58, speed: 48, radius: 13, bite: 8, sap: 7, score: 25, colour: '#c98a4a', dark: '#8a5a22', ranged: true, shotRange: 148, shotInterval: 2.3, shotDamage: 12, shotSpeed: 260 },
  burrower: { name: 'Burrower', hp: 48, speed: 94, radius: 11, bite: 8, sap: 6, score: 25, colour: '#b06a8a', dark: '#7a4260', erratic: true },
  brute: { name: 'Brute', hp: 280, speed: 30, radius: 22, bite: 18, sap: 12, score: 50, colour: '#8a5a4a', dark: '#5d382c' },
  wisp: { name: 'Wisp', hp: 42, speed: 80, radius: 12, bite: 8, sap: 8, score: 30, colour: '#9ad8e8', dark: '#5a93a8', flying: true },
  stag: { name: 'THE HOLLOW STAG', hp: 5200, speed: 34, radius: 40, bite: 40, sap: 220, score: 1000, colour: '#d8d8e8', dark: '#8a8aa8', boss: true },
};
/** Wave scaling: the Blight grows tougher the longer the night lasts. */
export const WAVE_HP_GROWTH = 0.21;
export const WAVE_SPEED_GROWTH = 0.025;

/**
 * Each wave is a list of spawn groups: a kind, how many, the gap between
 * them, and the delay (seconds into the wave) before the group starts.
 * Spawn order walks the three paths in turn so every path sees action.
 */
export const WAVES = [
  [{ kind: 'sproutling', count: 8, gap: 1.1, at: 0 }],
  [{ kind: 'sproutling', count: 12, gap: 0.9, at: 0 }, { kind: 'husk', count: 3, gap: 1.6, at: 4 }],
  [{ kind: 'sproutling', count: 10, gap: 0.8, at: 0 }, { kind: 'husk', count: 5, gap: 1.4, at: 2 }, { kind: 'spitter', count: 2, gap: 2.2, at: 6 }],
  [{ kind: 'burrower', count: 8, gap: 0.7, at: 0 }, { kind: 'husk', count: 6, gap: 1.2, at: 3 }, { kind: 'spitter', count: 3, gap: 2.0, at: 5 }],
  [{ kind: 'sproutling', count: 14, gap: 0.6, at: 0 }, { kind: 'burrower', count: 4, gap: 0.6, at: 3 }, { kind: 'husk', count: 4, gap: 1.1, at: 5 }, { kind: 'spitter', count: 3, gap: 1.8, at: 7 }],
  [{ kind: 'husk', count: 6, gap: 1.1, at: 0 }, { kind: 'burrower', count: 6, gap: 0.6, at: 2 }, { kind: 'spitter', count: 4, gap: 1.8, at: 4 }, { kind: 'brute', count: 2, gap: 3.0, at: 8 }],
  [{ kind: 'burrower', count: 10, gap: 0.55, at: 0 }, { kind: 'wisp', count: 5, gap: 0.9, at: 4 }, { kind: 'husk', count: 4, gap: 1.1, at: 5 }, { kind: 'spitter', count: 3, gap: 1.8, at: 7 }],
  [{ kind: 'wisp', count: 8, gap: 0.8, at: 0 }, { kind: 'husk', count: 6, gap: 1.0, at: 2 }, { kind: 'brute', count: 4, gap: 2.6, at: 6 }, { kind: 'spitter', count: 4, gap: 1.7, at: 6 }],
  [{ kind: 'sproutling', count: 16, gap: 0.45, at: 0 }, { kind: 'burrower', count: 8, gap: 0.5, at: 3 }, { kind: 'wisp', count: 6, gap: 0.8, at: 5 }, { kind: 'brute', count: 3, gap: 2.6, at: 8 }],
  [{ kind: 'husk', count: 10, gap: 0.9, at: 0 }, { kind: 'wisp', count: 8, gap: 0.7, at: 2 }, { kind: 'spitter', count: 6, gap: 1.6, at: 4 }, { kind: 'brute', count: 4, gap: 2.4, at: 7 }],
  [{ kind: 'burrower', count: 12, gap: 0.5, at: 0 }, { kind: 'wisp', count: 8, gap: 0.7, at: 3 }, { kind: 'brute', count: 6, gap: 2.2, at: 5 }, { kind: 'spitter', count: 6, gap: 1.5, at: 6 }, { kind: 'sproutling', count: 10, gap: 0.4, at: 8 }],
  [
    { kind: 'sproutling', count: 6, gap: 0.7, at: 0 },
    { kind: 'husk', count: 4, gap: 1.2, at: 3 },
    { kind: 'spitter', count: 2, gap: 2.0, at: 5 },
    { kind: 'stag', count: 1, gap: 1, at: 8 },
  ],
];

/** The Hollow Stag's second phase: below half health it enrages. */
export const BOSS = {
  phase2At: 0.5,
  phase2SpeedMult: 1.55,
  minionEvery: 4.5,
  minionKinds: ['sproutling', 'burrower'],
  chargeEvery: 7,
  chargeTime: 1.1,
  chargeSpeedMult: 3.2,
};

/** The seasons turn every three waves and change the rules. */
export const SEASONS = [
  { name: 'Spring', waves: [1, 2, 3], costMult: 0.8, enemySlow: 0, enemyHpMult: 1, sunbloomMult: 1, blurb: 'Growths cost 20% less', colour: '#9ad86a' },
  { name: 'Summer', waves: [4, 5, 6], costMult: 1, enemySlow: 0, enemyHpMult: 1, sunbloomMult: 2, blurb: 'Sunblooms pay double', colour: '#ffd166' },
  { name: 'Autumn', waves: [7, 8, 9], costMult: 1, enemySlow: 0.15, enemyHpMult: 1, sunbloomMult: 1, blurb: 'Leaves slow foes 15%', colour: '#e08a4a' },
  { name: 'Winter', waves: [10, 11, 12], costMult: 1, enemySlow: 0.2, enemyHpMult: 1.3, sunbloomMult: 1, blurb: 'Foes 20% slower, +30% HP', colour: '#a8c8e8' },
];

/** Three wardenships: the same grove, a different bite. */
export const DIFFICULTY = {
  seedling: { label: 'Seedling', hint: 'Learn the grove', enemyHp: 0.8, enemySpeed: 0.9, startSap: 170, treeHp: 120 },
  warden: { label: 'Warden', hint: 'The grove as it is', enemyHp: 1, enemySpeed: 1, startSap: 130, treeHp: 100 },
  blightstorm: { label: 'Blightstorm', hint: 'No mercy from the Blight', enemyHp: 1.2, enemySpeed: 1.08, startSap: 125, treeHp: 90 },
};
export const DIFFICULTY_ORDER = ['seedling', 'warden', 'blightstorm'];

/** Sap for clearing a wave: a flat gift plus a per-wave rise. */
export const WAVE_CLEAR_SAP = 18;
export const WAVE_CLEAR_SAP_PER_WAVE = 4;
/** Score: kills pay their bounty, clearing a wave pays, the tree pays. */
export const SCORE = { waveClear: 50, victoryTreeHp: 10, victorySap: 2 };

/** Victory stars by the Heartwood's remaining health. */
export const STAR_LINES = [0.7, 0.4];

/** Warm earth: deep greens, bark browns, amber sap. */
export const PALETTE = {
  backdrop: '#101a0c',
  ground: '#2c4a22',
  groundDark: '#22391a',
  soil: '#4a3520',
  soilDark: '#382716',
  path: '#6b4e2e',
  pathEdge: '#543d22',
  panel: 'rgba(24, 34, 16, 0.92)',
  panelEdge: '#7a9a55',
  text: '#f2ecd8',
  muted: '#b8c49a',
  sap: '#ffd166',
  hp: '#8fd45e',
  hpLow: '#e86a4a',
  danger: '#e86a4a',
  card: '#2c3f1e',
  cardEdge: '#8fd45e',
  locked: '#5a5a4a',
  treeTrunk: '#6b4a26',
  treeBark: '#54371c',
  leaf: '#4a8a2e',
  leafLight: '#7ec850',
  leafDark: '#2c5a1a',
  heart: '#ffcf5c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score per difficulty is kept between visits. */
export const BEST_KEY = 'rootwarden.best';
export const BEST_WAVE_KEY = 'rootwarden.bestwave';

/** How many entities can exist at once; pools are allocated once, at boot. */
export const POOL = { enemies: 120, projectiles: 300, particles: 600, texts: 64 };
