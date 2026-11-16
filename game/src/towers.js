// The growths: what each kind does, what each tier multiplies, and how a
// tower is planted, upgraded and sold. Combat numbers live here; the world
// step calls into these helpers and owns the entities themselves.
import { GROWTHS, GROWTH_ORDER, SELL_REFUND, TIERS } from './config.js';

let nextTowerId = 1;

/** Restart tower numbering (a fresh run replays exactly). */
export function resetTowerIds() {
  nextTowerId = 1;
}

/** The live stats of a growth kind at a tier, before global buffs. */
export function towerStats(kind, tier) {
  const base = GROWTHS[kind];
  const mult = TIERS[tier];
  return {
    range: base.range * mult.range,
    damage: (base.damage || 0) * mult.damage,
    interval: base.interval * mult.interval,
    hp: base.hp * mult.hp,
    dps: (base.dps || 0) * mult.damage,
    income: (base.income || 0) * mult.income,
    trickle: (base.trickle || 0) * mult.income,
    blastRadius: base.blastRadius || 0,
    thornDamage: (base.thornDamage || 0) * mult.damage,
  };
}

/** The Sap cost of planting a growth kind this season. */
export function plantCost(kind, season) {
  return Math.round(GROWTHS[kind].cost * season.costMult);
}

/** The Sap cost of raising a tower one tier, or 0 at the top tier. */
export function upgradeCost(tower, season) {
  if (tower.tier >= TIERS.length - 1) return 0;
  const mult = TIERS[tower.tier + 1];
  return Math.round(GROWTHS[tower.kind].cost * mult.costMult * season.costMult);
}

/** The Sap a tower returns when uprooted: most of what it cost. */
export function sellValue(tower) {
  return Math.max(1, Math.round(tower.spent * SELL_REFUND));
}

/** A new tower on a plot, at tier 1, with its block point resolved. */
export function createTower(kind, plot, season, buffs) {
  const stats = towerStats(kind, 1);
  const cost = plantCost(kind, season);
  const tower = {
    id: nextTowerId,
    kind,
    plotId: plot.id,
    x: plot.x,
    y: plot.y,
    tier: 1,
    hp: stats.hp,
    maxHp: stats.hp,
    cooldown: 0,
    angle: -Math.PI / 2,
    spent: cost,
    alive: true,
    // A Root Wall anchors to the nearest path point and blocks foes there.
    blockX: kind === 'wall' ? plot.pathX : plot.x,
    blockY: kind === 'wall' ? plot.pathY : plot.y,
    flash: 0,
    sway: 0,
    incomeTimer: 0,
    // Mines arm themselves a heartbeat after planting.
    armTimer: kind === 'mine' ? 0.6 : 0,
  };
  nextTowerId += 1;
  applyBuffs(tower, buffs);
  return tower;
}

/** Global draft buffs that reshape a tower's live stats. */
export function applyBuffs(tower, buffs) {
  const stats = towerStats(tower.kind, tower.tier);
  tower.range = stats.range * (1 + (buffs.rangeBonus || 0));
  tower.damage = stats.damage;
  tower.interval = stats.interval * (1 - (buffs.fireRateBonus || 0));
  if (tower.kind === 'thorn') tower.interval *= 1 - (buffs.thornRateBonus || 0);
  tower.dps = stats.dps * (1 + (buffs.sporeBonus || 0));
  tower.income = stats.income;
  tower.trickle = stats.trickle;
  tower.blastRadius = stats.blastRadius;
  tower.thornDamage = stats.thornDamage;
}

/** Raise a tower one tier: bigger numbers, a fuller crown. Returns false at the top. */
export function upgradeTower(tower, buffs) {
  if (tower.tier >= TIERS.length - 1) return false;
  const oldMax = tower.maxHp;
  tower.tier += 1;
  const stats = towerStats(tower.kind, tower.tier);
  tower.maxHp = stats.hp;
  tower.hp = Math.min(stats.hp, tower.hp + (stats.hp - oldMax));
  applyBuffs(tower, buffs);
  return true;
}

/** The growths in build-bar order, with their unlock state attached. */
export function growthList(unlocked) {
  return GROWTH_ORDER.map((kind) => ({ kind, ...GROWTHS[kind], unlocked: unlocked.has(kind) }));
}
