// Echoloop — every tuning number and colour in one place.
// The arena is a fixed 1280x720 logical field; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, margin: 28 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Survive all six waves and stop the Grandfather to win. */
export const WAVES = 6;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.42,
  boltSpeed: 620,
  boltDamage: 12,
  boltRadius: 5,
  pickupRadius: 70,
  hurtInvulnerable: 0.7,
};

/** The rewind: Space jumps the horologist back three seconds, body and all. */
export const REWIND = { seconds: 3, sampleEvery: 0.05, startCharges: 1, maxCharges: 3 };

/** Echoes: a cleared wave leaves a ghost that replays it and shoots. */
export const ECHO = { max: 4, sampleEvery: 0.1, fireInterval: 0.8, damage: 8, range: 400 };

/** Paradox: standing near an echo winds the meter; full means TIME STOP. */
export const PARADOX = { radius: 150, fillPerSecond: 12, stopTime: 2.0 };

export const ENEMY = {
  tick: { hp: 22, speed: 102, radius: 15, damage: 10, xp: 1, score: 10, colour: '#c98f3d' },
  spring: { hp: 12, speed: 178, radius: 11, damage: 7, xp: 1, score: 15, colour: '#e8c877' },
  cogwheel: { hp: 70, speed: 58, radius: 24, damage: 16, xp: 3, score: 30, colour: '#8a6a35' },
  mainspring: { hp: 16, speed: 132, radius: 12, damage: 8, xp: 1, score: 15, colour: '#b08d4f' },
  bell: { hp: 26, speed: 78, radius: 14, damage: 9, xp: 2, score: 25, colour: '#d9a441' },
  pendulum: { hp: 30, speed: 95, radius: 13, damage: 12, xp: 2, score: 25, colour: '#f2d8a0' },
  golem: { hp: 150, speed: 44, radius: 30, damage: 20, xp: 5, score: 60, colour: '#a8875a' },
  grandfather: { hp: 900, speed: 66, radius: 46, damage: 24, xp: 25, score: 500, colour: '#ff8a5c' },
};

/** Kills needed to clear each wave (index 0 = wave 1). */
export const WAVE_QUOTA = [14, 20, 26, 32, 38, 10];
/** Seconds of calm between waves. */
export const WAVE_REST = 3.5;
/** Spawn interval per wave, seconds; it shrinks as the wave goes on. */
export const SPAWN = { base: 0.9, min: 0.24, shrinkPerKill: 0.016 };

/** XP needed to reach each level (index 0 = level 1 -> 2). */
export const LEVEL_XP = [6, 14, 26, 42, 62, 86, 114, 146, 182, 222];

export const BOSS = {
  spawnMinionsEvery: 6,
  chargeEvery: 9,
  chargeSpeed: 340,
  chargeTime: 0.7,
  /** Phase 2 begins below this share of max HP: faster charges, radial bursts. */
  phase2At: 0.5,
  burstEvery: 5,
  burstCount: 10,
  burstSpeed: 210,
};

/** Kill streaks: a kill within the window raises the combo; a hit breaks it. */
export const COMBO = { window: 2.5, perStep: 5, max: 50, maxMultiplier: 6 };

/** Rust: bolts rust the gears; a full stack seizes the foe solid. */
export const RUST = { maxStacks: 5, seizeTime: 2.0, immuneTime: 1.0, decayAfter: 2.5, slowPerStack: 0.07 };

/** The Great Chime: the arena's own clock strikes, and time bends. */
export const CHIME = { firstAt: 20, every: 26, warnTime: 4, duration: 6, enemySlow: 0.25, playerBoost: 0.1 };

/** Time wells: slow ground that rusts whatever stands on it. */
export const WELL = { every: 12, radius: 62, life: 8, rustPerSecond: 2 };

/** Three windings: the same clock, a different bite. */
export const DIFFICULTY = {
  gentle: { label: 'Gentle', hint: 'Slow hands — learn the clock', enemyHp: 0.8, enemySpeed: 0.9, playerHp: 120 },
  normal: { label: 'Clockkeeper', hint: 'The clock as it is', enemyHp: 1, enemySpeed: 1, playerHp: 100 },
  brutal: { label: 'Brutal', hint: 'The clock shows no mercy', enemyHp: 1.3, enemySpeed: 1.1, playerHp: 80 },
};
export const DIFFICULTY_ORDER = ['gentle', 'normal', 'brutal'];

/** The elite: a rogue pendulum that stalks wave 3 alone. */
export const ELITE = { wave: 3, kind: 'pendulum', name: 'ROGUE COG', hpMult: 4, radiusMult: 1.4, score: 150, heal: 15 };

/** Which foes each wave can bring, and the wave each kind first appears in. */
export const WAVE_KINDS = {
  1: ['tick', 'spring'],
  2: ['tick', 'spring', 'cogwheel', 'pendulum'],
  3: ['tick', 'spring', 'cogwheel', 'mainspring', 'bell'],
  4: ['tick', 'spring', 'cogwheel', 'mainspring', 'bell', 'pendulum'],
  5: ['tick', 'spring', 'cogwheel', 'mainspring', 'bell', 'pendulum', 'golem'],
  6: ['tick', 'spring', 'cogwheel', 'mainspring', 'bell', 'pendulum', 'golem', 'grandfather'],
};
export const KIND_FIRST_WAVE = {
  tick: 1, spring: 1, cogwheel: 2, pendulum: 2, mainspring: 3, bell: 3, golem: 5, grandfather: 6,
};
export const KIND_LABEL = {
  tick: 'Tick', spring: 'Spring', cogwheel: 'Cogwheel', mainspring: 'Mainspring',
  bell: 'Bell', pendulum: 'Pendulum', golem: 'Golem', grandfather: 'GRANDFATHER',
};

export const PALETTE = {
  backdrop: '#171008',
  backdropEdge: '#0b0703',
  ground: '#241a10',
  groundDot: '#3a2c1c',
  player: '#ffd98a',
  playerCore: '#fff6e0',
  bolt: '#ffcf5c',
  shard: '#ffd166',
  text: '#fdf3dc',
  muted: '#b39b78',
  panel: 'rgba(30, 20, 10, 0.88)',
  panelEdge: '#8a6a35',
  hp: '#ff6b81',
  hpBack: '#2a1f14',
  xp: '#ffd166',
  danger: '#ff6b81',
  card: '#2a1e10',
  cardEdge: '#d9a441',
  combo: '#ffd166',
  chime: '#ffe9a8',
  bossWarm: '#ff8a5c',
  echo: '#ffe9a8',
  rust: '#c9712e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'echoloop.best';

/** How many entities can exist at once; pools are allocated once, at boot. */
export const POOL = { enemies: 100, bolts: 220, shards: 220, particles: 500, texts: 48, wells: 6, echoes: 4 };
