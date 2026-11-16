// The grove itself: the Heartwood, the growths, the Blight, the Sap and
// the seasons. The world advances in fixed 1/60 s steps and reports what
// happened in an events object, so the loop, the screenshots and the
// autopilot all share one simulation. Nothing here touches the screen or
// the speakers; it only changes numbers and flags.
import {
  BUILD_TIME, DIFFICULTY, ENEMIES, GROWTHS, POOL, SCORE, START_UNLOCKED, TOTAL_WAVES,
  TREE, WAVE_CLEAR_SAP, WAVE_CLEAR_SAP_PER_WAVE,
} from './config.js';
import { createRandom } from './random.js';
import { buildPaths, buildPlots } from './paths.js';
import { applyBuffs, createTower, plantCost, resetTowerIds, sellValue, upgradeCost, upgradeTower } from './towers.js';
import { createEnemy, enemySpeed, resetEnemyIds, updateBoss, walkEnemy } from './enemies.js';
import { buildWaveSchedule, spawnDue, waveHasBoss, waveTotal } from './waves.js';
import { seasonForWave, seasonIndexForWave, SEASON_FALL } from './seasons.js';
import { dealDraft } from './draft.js';

export const PHASE_BUILD = 'build';
export const PHASE_COMBAT = 'combat';
export const PHASE_DRAFT = 'draft';
export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost';

/** A fresh grove on a seed and a difficulty. */
export function createWorld(seed, difficultyKey = 'warden') {
  const world = { seed: seed >>> 0, difficultyKey };
  world.reset = () => resetWorld(world);
  world.setDifficulty = (key) => {
    world.difficultyKey = key;
    resetWorld(world);
  };
  resetWorld(world);
  return world;
}

function resetWorld(world) {
  const rng = createRandom(world.seed);
  resetTowerIds();
  resetEnemyIds();
  const difficulty = DIFFICULTY[world.difficultyKey] ?? DIFFICULTY.warden;
  const plots = buildPlots();
  const paths = buildPaths();
  world.rng = rng;
  world.state = {
    rng,
    seed: world.seed,
    difficulty,
    difficultyKey: world.difficultyKey,
    phase: PHASE_BUILD,
    wave: 1,
    time: 0,
    waveTime: 0,
    buildTimer: BUILD_TIME,
    sap: difficulty.startSap,
    treeHp: difficulty.treeHp,
    treeMaxHp: difficulty.treeHp,
    score: 0,
    kills: 0,
    sapEarned: difficulty.startSap,
    leaks: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    texts: [],
    plots,
    paths,
    unlocked: new Set(START_UNLOCKED),
    buffs: {},
    draftCards: null,
    rerollsLeft: 1,
    schedule: [],
    waveSpawned: 0,
    waveTotalCount: waveTotal(1),
    season: seasonForWave(1),
    seasonIndex: 0,
    treeFlash: 0,
    shake: 0,
    ambientTimer: 0,
    selectedGrowth: null,
    stats: { planted: 0, upgraded: 0, sold: 0, wavesCleared: 0, damageDealt: 0, shotsFired: 0 },
  };
  // A few drifting leaves so the title screen is already alive.
  for (let i = 0; i < 26; i += 1) {
    spawnAmbient(world.state, true);
  }
  return world.state;
}

/** Foes still to come this wave plus foes still on the paths. */
export function enemiesRemaining(state) {
  let alive = 0;
  for (const enemy of state.enemies) if (enemy.alive) alive += 1;
  return state.schedule.length + alive;
}

/** The Sap cost of a growth kind right now, season included. */
export function costNow(state, kind) {
  return plantCost(kind, state.season);
}

/** Plant a growth on an empty plot. Returns false with a reason when refused. */
export function plantTower(world, plotId, kind) {
  const state = world.state;
  if (state.phase !== PHASE_BUILD && state.phase !== PHASE_COMBAT) return { ok: false, reason: 'not now' };
  if (!state.unlocked.has(kind)) return { ok: false, reason: 'locked' };
  const plot = state.plots.find((p) => p.id === plotId);
  if (!plot || plot.tower) return { ok: false, reason: 'occupied' };
  const cost = costNow(state, kind);
  if (state.sap < cost) return { ok: false, reason: 'sap' };
  state.sap -= cost;
  const tower = createTower(kind, plot, state.season, state.buffs);
  plot.tower = tower;
  state.towers.push(tower);
  state.stats.planted += 1;
  burst(state, plot.x, plot.y - 10, 10, GROWTHS[kind].colour, 'leaf');
  addText(state, plot.x, plot.y - 34, `-${cost} Sap`, '#ffd166');
  return { ok: true, tower };
}

/** Raise a tower one tier. Returns false with a reason when refused. */
export function upgradeTowerById(world, towerId) {
  const state = world.state;
  const tower = state.towers.find((t) => t.id === towerId && t.alive);
  if (!tower) return { ok: false, reason: 'gone' };
  const cost = upgradeCost(tower, state.season);
  if (cost === 0) return { ok: false, reason: 'maxed' };
  if (state.sap < cost) return { ok: false, reason: 'sap' };
  state.sap -= cost;
  tower.spent += cost;
  upgradeTower(tower, state.buffs);
  state.stats.upgraded += 1;
  burst(state, tower.x, tower.y - 14, 14, '#ffd166', 'spark');
  addText(state, tower.x, tower.y - 40, 'TIER ' + tower.tier, '#ffd166');
  return { ok: true, tower };
}

/** Uproot a tower for most of its cost. */
export function sellTowerById(world, towerId) {
  const state = world.state;
  const tower = state.towers.find((t) => t.id === towerId && t.alive);
  if (!tower) return { ok: false, reason: 'gone' };
  const value = sellValue(tower);
  tower.alive = false;
  const plot = state.plots.find((p) => p.id === tower.plotId);
  if (plot) plot.tower = null;
  state.sap += value;
  state.stats.sold += 1;
  burst(state, tower.x, tower.y - 10, 8, '#b8c49a', 'leaf');
  addText(state, tower.x, tower.y - 34, `+${value} Sap`, '#ffd166');
  return { ok: true, value };
}

/** Begin the wave: the Blight steps out of the forest. */
export function startWave(world) {
  const state = world.state;
  if (state.phase !== PHASE_BUILD) return false;
  const bonus = Math.ceil(state.buildTimer);
  if (bonus > 0) {
    state.sap += bonus;
    state.sapEarned += bonus;
    addText(state, TREE.x, TREE.y - 110, `Early start +${bonus} Sap`, '#ffd166');
  }
  state.schedule = buildWaveSchedule(state.wave, state.rng);
  state.waveTotalCount = state.schedule.length;
  state.waveSpawned = 0;
  state.waveTime = 0;
  state.phase = PHASE_COMBAT;
  state.eventsPending = state.eventsPending ?? {};
  state.eventsPending.wave = true;
  if (waveHasBoss(state.wave)) state.eventsPending.boss = true;
  return true;
}

/** Take a draft card and return to building for the next wave. */
export function applyDraft(world, card) {
  const state = world.state;
  if (state.phase !== PHASE_DRAFT || !card) return false;
  card.apply(state);
  for (const tower of state.towers) {
    if (tower.alive) applyBuffs(tower, state.buffs);
  }
  state.draftCards = null;
  state.wave += 1;
  state.season = seasonForWave(state.wave);
  state.seasonIndex = seasonIndexForWave(state.wave);
  state.buildTimer = BUILD_TIME;
  state.rerollsLeft = 1;
  state.phase = PHASE_BUILD;
  return true;
}

/** Re-deal the draft once, free. Returns false when the reroll is spent. */
export function rerollDraft(world) {
  const state = world.state;
  if (state.phase !== PHASE_DRAFT || state.rerollsLeft <= 0) return false;
  state.rerollsLeft -= 1;
  state.draftCards = dealDraft(state, state.rng);
  return true;
}

// --- Small makers: particles and floating text ---------------------------

function pushParticle(state, particle) {
  if (state.particles.length >= POOL.particles) state.particles.shift();
  state.particles.push(particle);
}

export function burst(state, x, y, count, colour, kind) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.next() * Math.PI * 2;
    const speed = 30 + state.rng.next() * 90;
    pushParticle(state, {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.5 + state.rng.next() * 0.5,
      maxLife: 1,
      size: 2 + state.rng.next() * 3,
      colour,
      kind,
      rot: state.rng.next() * Math.PI * 2,
      vr: (state.rng.next() - 0.5) * 8,
    });
  }
}

export function addText(state, x, y, text, colour) {
  if (state.texts.length >= POOL.texts) state.texts.shift();
  state.texts.push({ x, y, text, colour, life: 1.1, maxLife: 1.1 });
}

function spawnAmbient(state, anywhere = false) {
  const fall = SEASON_FALL[state.seasonIndex];
  const x = anywhere ? state.rng.range(0, 1280) : state.rng.range(0, 1280);
  const y = anywhere ? state.rng.range(64, 628) : 64;
  pushParticle(state, {
    x, y,
    vx: state.rng.range(-14, 6),
    vy: state.rng.range(12, 30),
    life: state.rng.range(4, 9),
    maxLife: 9,
    size: state.rng.range(2.5, 5),
    colour: fall.colour,
    kind: 'leaf',
    rot: state.rng.next() * Math.PI * 2,
    vr: (state.rng.next() - 0.5) * 2,
    ambient: true,
  });
}

// --- Combat ---------------------------------------------------------------

function damageEnemy(state, enemy, amount, events) {
  if (!enemy.alive) return;
  enemy.hp -= amount;
  enemy.flash = 0.08;
  state.stats.damageDealt += amount;
  if (enemy.hp <= 0) killEnemy(state, enemy, events);
}

function killEnemy(state, enemy, events) {
  if (!enemy.alive) return;
  enemy.alive = false;
  state.kills += 1;
  const bounty = enemy.sap + (state.buffs.killSapBonus || 0);
  state.sap += bounty;
  state.sapEarned += bounty;
  state.score += enemy.score;
  events.kill = true;
  burst(state, enemy.x, enemy.y, enemy.boss ? 40 : 12, '#b8d86a', 'puff');
  addText(state, enemy.x, enemy.y - 18, `+${bounty} Sap`, '#ffd166');
  if (enemy.boss) {
    events.bossDown = true;
    state.shake = Math.max(state.shake, 10);
  }
}

function fireThorn(state, tower, target, events) {
  const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.angle = angle;
  tower.cooldown = tower.interval;
  state.stats.shotsFired += 1;
  events.shoot = true;
  if (state.projectiles.length < POOL.projectiles) {
    state.projectiles.push({
      x: tower.x, y: tower.y - 18,
      vx: Math.cos(angle) * 520,
      vy: Math.sin(angle) * 520,
      speed: 520,
      damage: tower.damage,
      target,
      kind: 'thorn',
      radius: 4,
      life: 1.2,
      alive: true,
    });
  }
  pushParticle(state, {
    x: tower.x, y: tower.y - 18, vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40 - 10,
    life: 0.25, maxLife: 0.25, size: 3, colour: '#8fd45e', kind: 'spark', rot: 0, vr: 0,
  });
}

function sprayCone(state, tower, events) {
  let aim = null;
  let aimD = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
    if (d <= tower.range && d < aimD) {
      aimD = d;
      aim = enemy;
    }
  }
  if (!aim) return;
  const aimAngle = Math.atan2(aim.y - tower.y, aim.x - tower.x);
  tower.angle = aimAngle;
  tower.cooldown = tower.interval;
  events.spray = true;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;
    const d = Math.hypot(dx, dy);
    if (d > tower.range + enemy.radius) continue;
    const angle = Math.atan2(dy, dx);
    let diff = angle - aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 0.6) continue;
    damageEnemy(state, enemy, tower.damage, events);
    enemy.slowUntil = state.time + (GROWTHS.sprayer.slowTime ?? 1.3);
    enemy.slowFactor = Math.max(enemy.slowFactor, GROWTHS.sprayer.slow ?? 0.45);
  }
  for (let i = 0; i < 6; i += 1) {
    const spread = (state.rng.next() - 0.5) * 0.9;
    const speed = 120 + state.rng.next() * 120;
    pushParticle(state, {
      x: tower.x, y: tower.y - 16,
      vx: Math.cos(aimAngle + spread) * speed,
      vy: Math.sin(aimAngle + spread) * speed,
      life: 0.4, maxLife: 0.4, size: 3 + state.rng.next() * 2,
      colour: '#e8b23a', kind: 'drop', rot: 0, vr: 0,
    });
  }
}

function sporeAura(state, tower, dt, events) {
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
    if (d > tower.range + enemy.radius) continue;
    enemy.poisonUntil = state.time + 1.5;
    enemy.poisonDps = Math.max(enemy.poisonDps, tower.dps);
    damageEnemy(state, enemy, tower.dps * dt, events);
  }
  if (state.rng.next() < dt * 6) {
    const angle = state.rng.next() * Math.PI * 2;
    const r = state.rng.next() * tower.range * 0.8;
    pushParticle(state, {
      x: tower.x + Math.cos(angle) * r, y: tower.y + Math.sin(angle) * r - 8,
      vx: 0, vy: -14, life: 0.9, maxLife: 0.9, size: 2.5 + state.rng.next() * 2,
      colour: '#c9a8f0', kind: 'spore', rot: 0, vr: 0,
    });
  }
}

function detonateMine(state, tower, events) {
  tower.alive = false;
  const plot = state.plots.find((p) => p.id === tower.plotId);
  if (plot) plot.tower = null;
  events.explosion = true;
  state.shake = Math.max(state.shake, 6);
  burst(state, tower.x, tower.y - 8, 30, '#e08a4a', 'puff');
  burst(state, tower.x, tower.y - 8, 16, '#ffd166', 'spark');
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.flying) continue;
    const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
    if (d > tower.blastRadius + enemy.radius) continue;
    const falloff = 1 - (d / (tower.blastRadius + enemy.radius)) * 0.5;
    damageEnemy(state, enemy, tower.damage * falloff, events);
  }
}

function firstTargetInRange(state, tower) {
  let best = null;
  let bestDistance = -1;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
    if (d > tower.range + enemy.radius) continue;
    if (enemy.distance > bestDistance) {
      bestDistance = enemy.distance;
      best = enemy;
    }
  }
  return best;
}

function updateTower(state, tower, dt, events) {
  if (!tower.alive) return;
  tower.sway += dt;
  if (tower.flash > 0) tower.flash -= dt;
  if (tower.armTimer > 0) tower.armTimer -= dt;
  if (tower.cooldown > 0) tower.cooldown -= dt;
  // Sunblooms trickle Sap even while the Warden builds.
  if (tower.kind === 'sunbloom') {
    tower.incomeTimer += dt * tower.trickle * state.season.sunbloomMult;
    if (tower.incomeTimer >= 1) {
      const whole = Math.floor(tower.incomeTimer);
      tower.incomeTimer -= whole;
      state.sap += whole;
      state.sapEarned += whole;
    }
    return;
  }
  if (state.phase !== PHASE_COMBAT) return;
  if (tower.kind === 'thorn') {
    if (tower.cooldown <= 0) {
      const target = firstTargetInRange(state, tower);
      if (target) fireThorn(state, tower, target, events);
    }
    return;
  }
  if (tower.kind === 'sprayer') {
    if (tower.cooldown <= 0) sprayCone(state, tower, events);
    return;
  }
  if (tower.kind === 'spore') {
    sporeAura(state, tower, dt, events);
    return;
  }
  if (tower.kind === 'mine') {
    if (tower.armTimer > 0) return;
    for (const enemy of state.enemies) {
      if (!enemy.alive || enemy.flying) continue;
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d <= (GROWTHS.mine.triggerRadius ?? 48)) {
        detonateMine(state, tower, events);
        return;
      }
    }
  }
  // Root Walls do their work when a foe chews them; see updateEnemy.
}

function updateProjectiles(state, dt, events) {
  for (const p of state.projectiles) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      continue;
    }
    // Where the shot is flying toward: a foe, a growth, or the Heartwood.
    let tx = null;
    let ty = null;
    let tRadius = 10;
    if (p.target === 'tree') {
      tx = TREE.x;
      ty = TREE.y - 30;
      tRadius = 42;
    } else if (p.target && p.target.alive) {
      tx = p.target.x;
      ty = p.target.y + (p.target.flying ? -14 : 0);
      tRadius = p.target.radius ?? 10;
    }
    if (tx !== null) {
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + tRadius) {
        p.alive = false;
        if (p.kind === 'glob') {
          damageTowerOrTree(state, p.target, p.damage, events);
        } else {
          damageEnemy(state, p.target, p.damage, events);
          burst(state, tx, ty, 3, '#8fd45e', 'spark');
        }
        continue;
      }
      p.vx = (dx / d) * p.speed;
      p.vy = (dy / d) * p.speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  state.projectiles = state.projectiles.filter((p) => p.alive);
}

function damageTowerOrTree(state, target, amount, events) {
  if (target === 'tree') {
    state.treeHp -= amount;
    state.treeFlash = 0.25;
    state.shake = Math.max(state.shake, 4);
    events.treeHurt = true;
    addText(state, TREE.x, TREE.y - 96, `-${Math.round(amount)}`, '#e86a4a');
    if (state.treeHp <= 0) loseGame(state, events);
    return;
  }
  if (!target.alive) return;
  target.hp -= amount;
  target.flash = 0.15;
  if (target.hp <= 0) {
    target.alive = false;
    const plot = state.plots.find((p) => p.id === target.plotId);
    if (plot) plot.tower = null;
    events.towerLost = true;
    burst(state, target.x, target.y - 10, 14, '#8a6a4a', 'puff');
    addText(state, target.x, target.y - 34, 'Uprooted!', '#e86a4a');
  }
}

function spitterShoot(state, enemy, dt, events) {
  enemy.shotCooldown -= dt;
  if (enemy.shotCooldown > 0) return;
  // The nearest growth in range. Spitters shell towers, never the tree:
  // the Heartwood is only bitten by foes that reach it.
  let target = null;
  let targetD = Infinity;
  for (const tower of state.towers) {
    if (!tower.alive) continue;
    const d = Math.hypot(tower.x - enemy.x, tower.y - enemy.y);
    if (d < targetD) {
      targetD = d;
      target = tower;
    }
  }
  const shotRange = ENEMIES.spitter.shotRange;
  if (!target || targetD > shotRange) return;
  enemy.shotCooldown = ENEMIES.spitter.shotInterval;
  events.spitter = true;
  const tx = target.x;
  const ty = target.y - 12;
  const angle = Math.atan2(ty - enemy.y, tx - enemy.x);
  if (state.projectiles.length < POOL.projectiles) {
    state.projectiles.push({
      x: enemy.x, y: enemy.y - 6,
      vx: Math.cos(angle) * 260,
      vy: Math.sin(angle) * 260,
      speed: 260,
      damage: ENEMIES.spitter.shotDamage,
      target,
      kind: 'glob',
      radius: 5,
      life: 2,
      alive: true,
    });
  }
}

function updateEnemy(state, enemy, dt, events) {
  if (!enemy.alive) return;
  if (enemy.flash > 0) enemy.flash -= dt;
  if (enemy.spawnScale < 1) enemy.spawnScale = Math.min(1, enemy.spawnScale + dt * 3);
  if (state.time < enemy.poisonUntil) {
    damageEnemy(state, enemy, enemy.poisonDps * dt, events);
    if (!enemy.alive) return;
  }
  updateBoss(enemy, dt, events);
  if (events.bossMinion === enemy) {
    events.bossMinion = null;
    const kind = state.rng.pick(['sproutling', 'burrower']);
    const minion = createEnemy(kind, enemy.pathIndex, state.wave, state.difficulty, state.season);
    minion.distance = Math.max(0, enemy.distance - 30);
    minion.x = enemy.x;
    minion.y = enemy.y;
    state.enemies.push(minion);
  }
  // Spitters halt to shoot when a growth is in range.
  if (enemy.ranged) {
    let inRange = false;
    for (const tower of state.towers) {
      if (!tower.alive) continue;
      if (Math.hypot(tower.x - enemy.x, tower.y - enemy.y) <= ENEMIES.spitter.shotRange) {
        inRange = true;
        break;
      }
    }
    if (inRange) {
      spitterShoot(state, enemy, dt, events);
      return;
    }
  }
  const walls = state.towers.filter((t) => t.alive && t.kind === 'wall');
  const result = walkEnemy(enemy, state.paths, dt, state.time, walls);
  if (result === 'blocked' && enemy.blockedBy) {
    const wall = enemy.blockedBy;
    wall.hp -= enemy.bite * dt;
    wall.flash = 0.1;
    damageEnemy(state, enemy, wall.thornDamage * dt, events);
    if (wall.hp <= 0) {
      wall.alive = false;
      const plot = state.plots.find((p) => p.id === wall.plotId);
      if (plot) plot.tower = null;
      events.towerLost = true;
      burst(state, wall.x, wall.y - 10, 16, '#8a6a4a', 'puff');
      addText(state, wall.x, wall.y - 34, 'Wall broken!', '#e86a4a');
    }
    return;
  }
  if (result === 'tree') {
    enemy.alive = false;
    state.leaks += 1;
    damageTowerOrTree(state, 'tree', enemy.bite, events);
    burst(state, enemy.x, enemy.y, 10, '#e86a4a', 'puff');
  }
}

function clearWave(state, events) {
  const wave = state.wave;
  state.stats.wavesCleared += 1;
  const clearSap = WAVE_CLEAR_SAP + WAVE_CLEAR_SAP_PER_WAVE * wave;
  state.sap += clearSap;
  state.sapEarned += clearSap;
  state.score += SCORE.waveClear * wave;
  let bloomSap = 0;
  for (const tower of state.towers) {
    if (tower.alive && tower.kind === 'sunbloom') {
      bloomSap += Math.round(tower.income * state.season.sunbloomMult);
    }
  }
  if (bloomSap > 0) {
    state.sap += bloomSap;
    state.sapEarned += bloomSap;
  }
  events.waveClear = true;
  addText(state, TREE.x, TREE.y - 120, `Wave ${wave} cleared! +${clearSap + bloomSap} Sap`, '#8fd45e');
  if (wave >= TOTAL_WAVES) {
    winGame(state, events);
    return;
  }
  state.draftCards = dealDraft(state, state.rng);
  state.phase = PHASE_DRAFT;
  events.draft = true;
}

function winGame(state, events) {
  state.score += state.treeHp * SCORE.victoryTreeHp + state.sap * SCORE.victorySap;
  state.phase = PHASE_WON;
  events.victory = true;
}

function loseGame(state, events) {
  state.treeHp = 0;
  state.phase = PHASE_LOST;
  events.defeat = true;
}

/** One fixed step of the grove. `events` collects what happened, for sound. */
export function stepWorld(world, dt, events) {
  const state = world.state;
  state.time += dt;
  if (state.treeFlash > 0) state.treeFlash -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
  if (state.eventsPending) {
    Object.assign(events, state.eventsPending);
    state.eventsPending = null;
  }
  // The seasons shed their leaves, petals and snow over the clearing.
  state.ambientTimer -= dt;
  if (state.ambientTimer <= 0) {
    state.ambientTimer = 0.35;
    spawnAmbient(state);
  }
  updateParticles(state, dt);
  updateTexts(state, dt);

  if (state.phase === PHASE_BUILD) {
    state.buildTimer -= dt;
    for (const tower of state.towers) updateTower(state, tower, dt, events);
    if (state.buildTimer <= 0) startWave(world);
    return;
  }
  if (state.phase !== PHASE_COMBAT) return;

  state.waveTime += dt;
  const spawned = spawnDue(state.schedule, state.waveTime, state.wave, state.difficulty, state.season, state.paths);
  for (const enemy of spawned) {
    state.enemies.push(enemy);
    state.waveSpawned += 1;
    if (enemy.boss) events.boss = true;
  }
  for (const tower of state.towers) updateTower(state, tower, dt, events);
  for (const enemy of state.enemies) updateEnemy(state, enemy, dt, events);
  updateProjectiles(state, dt, events);
  state.enemies = state.enemies.filter((e) => e.alive);
  state.towers = state.towers.filter((t) => t.alive);

  if (state.phase === PHASE_COMBAT && state.schedule.length === 0 && state.enemies.length === 0) {
    clearWave(state, events);
  }
}

function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.ambient) {
      p.x += Math.sin(state.time * 1.4 + p.rot) * 12 * dt;
      p.vy = Math.min(p.vy + 4 * dt, 34);
    } else {
      p.vy += 60 * dt;
    }
  }
  state.particles = state.particles.filter((p) => p.life > 0 && p.y < 640);
}

function updateTexts(state, dt) {
  for (const t of state.texts) {
    t.life -= dt;
    t.y -= 26 * dt;
  }
  state.texts = state.texts.filter((t) => t.life > 0);
}

/** The victory stars: how much of the Heartwood is left standing. */
export function victoryStars(state) {
  const share = state.treeHp / state.treeMaxHp;
  if (share >= 0.7) return 3;
  if (share >= 0.4) return 2;
  return 1;
}

export { enemySpeed };
