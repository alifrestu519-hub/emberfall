// The Blight: what each kind is, how it walks a path, and what the Hollow
// Stag does when it is wounded. Enemies are plain records the world step
// moves; this file owns their definitions and their movement.
import { BOSS, ENEMIES, WAVE_HP_GROWTH, WAVE_SPEED_GROWTH } from './config.js';
import { pointAlongPath } from './paths.js';

let nextEnemyId = 1;

/** Restart enemy numbering (a fresh run replays exactly). */
export function resetEnemyIds() {
  nextEnemyId = 1;
}

/** A new enemy at the start of a path, scaled for its wave and difficulty. */
export function createEnemy(kind, pathIndex, wave, difficulty, season) {
  const base = ENEMIES[kind];
  const hpMult = (1 + WAVE_HP_GROWTH * (wave - 1)) * difficulty.enemyHp * season.enemyHpMult;
  const speedMult = (1 + WAVE_SPEED_GROWTH * (wave - 1)) * difficulty.enemySpeed * (1 - season.enemySlow);
  const enemy = {
    id: nextEnemyId,
    kind,
    name: base.name,
    pathIndex,
    distance: 0,
    x: 0,
    y: 0,
    hp: Math.round(base.hp * hpMult),
    maxHp: Math.round(base.hp * hpMult),
    speed: base.speed * speedMult,
    baseSpeed: base.speed * speedMult,
    radius: base.radius,
    bite: base.bite,
    sap: base.sap,
    score: base.score,
    flying: !!base.flying,
    ranged: !!base.ranged,
    erratic: !!base.erratic,
    boss: !!base.boss,
    alive: true,
    slowUntil: 0,
    slowFactor: 0,
    poisonUntil: 0,
    poisonDps: 0,
    shotCooldown: 1,
    blockedBy: null,
    chewing: 0,
    wobble: 0,
    // Deterministic per-enemy phase (golden-angle spread), never Math.random.
    wobbleSeed: ((nextEnemyId * 2.399963) % (Math.PI * 2)),
    phase2: false,
    minionTimer: 0,
    chargeTimer: BOSS.chargeEvery,
    charging: 0,
    flash: 0,
    spawnScale: 0,
  };
  nextEnemyId += 1;
  return enemy;
}

/** The enemy's current speed: slows, charges and the Stag's rage apply. */
export function enemySpeed(enemy, now) {
  let speed = enemy.speed;
  if (now < enemy.slowUntil) speed *= 1 - enemy.slowFactor;
  if (enemy.charging > 0) speed *= BOSS.chargeSpeedMult;
  else if (enemy.phase2) speed *= BOSS.phase2SpeedMult;
  return speed;
}

/**
 * Walk an enemy along its path for one step. Returns 'tree' when it reaches
 * the Heartwood, 'blocked' while a Root Wall holds it, else 'walking'.
 * A blocked enemy chews the wall instead of walking.
 */
export function walkEnemy(enemy, paths, dt, now, walls) {
  if (!enemy.flying) {
    for (const wall of walls) {
      if (!wall.alive) continue;
      const dx = enemy.x - wall.blockX;
      const dy = enemy.y - wall.blockY;
      const reach = wall.kind === 'wall' ? 34 : 0;
      if (dx * dx + dy * dy < reach * reach) {
        enemy.blockedBy = wall;
        enemy.chewing += dt;
        return 'blocked';
      }
    }
  }
  enemy.blockedBy = null;
  const path = paths[enemy.pathIndex];
  enemy.distance += enemySpeed(enemy, now) * dt;
  if (enemy.charging > 0) enemy.charging -= dt;
  if (enemy.distance >= path.total) return 'tree';
  const pos = pointAlongPath(path, enemy.distance);
  enemy.x = pos.x;
  enemy.y = pos.y;
  if (enemy.erratic) {
    enemy.wobble += dt * 6;
    const sway = Math.sin(enemy.wobble + enemy.wobbleSeed) * 9;
    enemy.x += sway * 0.4;
    enemy.y += sway;
  }
  return 'walking';
}

/** The Stag's rage: below half health it quickens and calls minions. */
export function updateBoss(enemy, dt, events) {
  if (!enemy.boss || !enemy.alive) return;
  if (!enemy.phase2 && enemy.hp <= enemy.maxHp * BOSS.phase2At) {
    enemy.phase2 = true;
    events.bossPhase = true;
  }
  if (enemy.phase2) {
    enemy.minionTimer += dt;
    if (enemy.minionTimer >= BOSS.minionEvery) {
      enemy.minionTimer = 0;
      events.bossMinion = enemy;
    }
    enemy.chargeTimer -= dt;
    if (enemy.chargeTimer <= 0) {
      enemy.chargeTimer = BOSS.chargeEvery;
      enemy.charging = BOSS.chargeTime;
      events.bossCharge = true;
    }
  }
}
