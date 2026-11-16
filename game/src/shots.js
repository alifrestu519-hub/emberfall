// The deterministic screenshot scenes behind ?shot=title|play|draft|victory.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot (plant on the best plots,
// spend every Sap, take the best draft card), so the frame is what a real
// game looks like and the same seed always gives the same frame.
import { STEP, TOTAL_WAVES } from './config.js';
import {
  PHASE_BUILD, PHASE_COMBAT, PHASE_DRAFT, PHASE_LOST, PHASE_WON,
  applyDraft, costNow, plantTower, startWave, stepWorld, upgradeTowerById,
} from './world.js';
import { upgradeCost } from './towers.js';
import { SCREEN_DEFEAT, SCREEN_DRAFT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const TITLE_SECONDS = 6;
const MAX_PLAY_SECONDS = 900;
const MAX_VICTORY_SECONDS = 1800;

/** The autopilot's draft taste, best first. */
const DRAFT_TASTE = [
  'unlock-spore', 'unlock-wall', 'unlock-mine',
  'thornstorm', 'swift-sap', 'long-thorns', 'spore-bloom',
  'golden-sap', 'hardened-bark', 'deep-roots', 'rich-soil', "menders-touch",
];

/** Free plots nearest a path first — the ground a tower covers best. */
function bestPlots(state) {
  return [...state.plots].filter((p) => !p.tower).sort((a, b) => a.pathDistance - b.pathDistance);
}

/**
 * The path with the fewest towers on it: the autopilot spreads its grove
 * across all three roads instead of crowding one.
 */
function leastGuardedPath(state) {
  const counts = [0, 0, 0];
  for (const tower of state.towers) {
    if (!tower.alive || tower.kind === 'sunbloom') continue;
    const plot = state.plots.find((p) => p.id === tower.plotId);
    if (plot) counts[plot.path] += 1;
  }
  let best = 0;
  for (let i = 1; i < 3; i += 1) if (counts[i] < counts[best]) best = i;
  return best;
}

/** Free plots on one path, nearest the road first. */
function plotsOnPath(state, pathIndex) {
  return [...state.plots]
    .filter((p) => !p.tower && p.path === pathIndex)
    .sort((a, b) => a.pathDistance - b.pathDistance);
}

/** The next plot to guard: the best free mound on the least guarded road. */
function nextGuardPlot(state) {
  const path = leastGuardedPath(state);
  const onPath = plotsOnPath(state, path);
  if (onPath.length > 0) return onPath;
  return bestPlots(state);
}

/** Free plots farthest from any path — where Sunblooms belong. */
function farPlots(state) {
  return [...state.plots].filter((p) => !p.tower).sort((a, b) => b.pathDistance - a.pathDistance);
}

function countKind(state, kind) {
  return state.towers.filter((t) => t.alive && t.kind === kind).length;
}

function tryPlant(world, kind, plots) {
  const state = world.state;
  if (!state.unlocked.has(kind)) return false;
  if (state.sap < costNow(state, kind)) return false;
  const plot = plots[0];
  if (!plot) return false;
  return plantTower(world, plot.id, kind).ok;
}

/** Spend the build phase's Sap, then sound the horn. */
function autopilotBuild(world, sapBoost) {
  const state = world.state;
  if (sapBoost > 0) state.sap += sapBoost;
  for (let guard = 0; guard < 60; guard += 1) {
    const near = nextGuardPlot(state);
    const far = farPlots(state);
    // Defence first: a thorn on the ground before any economy.
    if (countKind(state, 'thorn') < 1 && tryPlant(world, 'thorn', near)) continue;
    if (state.wave <= 5 && countKind(state, 'sunbloom') < 2 && tryPlant(world, 'sunbloom', far)) continue;
    if (countKind(state, 'sprayer') < 1 && tryPlant(world, 'sprayer', near)) continue;
    if (countKind(state, 'spore') < 2 && tryPlant(world, 'spore', near)) continue;
    if (state.wave >= 4 && countKind(state, 'wall') < 2 && tryPlant(world, 'wall', near)) continue;
    if (state.wave >= 5 && countKind(state, 'mine') < 2 && tryPlant(world, 'mine', near)) continue;
    if (tryPlant(world, 'thorn', near)) continue;
    // Nothing left to plant: raise the weakest tower a tier.
    let upgraded = false;
    const upgradeable = state.towers
      .filter((t) => t.alive && t.tier < 3 && t.kind !== 'mine')
      .sort((a, b) => a.tier - b.tier || a.spent - b.spent);
    for (const tower of upgradeable) {
      if (state.sap >= upgradeCost(tower, state.season)) {
        if (upgradeTowerById(world, tower.id).ok) {
          upgraded = true;
          break;
        }
      }
    }
    if (upgraded) continue;
    break;
  }
  startWave(world);
}

/** Take the draft card the autopilot likes best. */
function autopilotDraft(world) {
  const state = world.state;
  if (!state.draftCards) return;
  let pick = state.draftCards[0];
  for (const id of DRAFT_TASTE) {
    const found = state.draftCards.find((c) => c.id === id);
    if (found) {
      pick = found;
      break;
    }
  }
  applyDraft(world, pick);
}

/**
 * Drive the autopilot until `stop(state)` is true or the run ends.
 * Returns 'won', 'lost', 'stopped' or 'timeout'.
 */
function driveAutopilot(world, stop, maxSeconds, sapBoost = 0) {
  const events = {};
  let prevPhase = null;
  let boostedWave = 0;
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    const state = world.state;
    if (state.phase === PHASE_WON) return 'won';
    if (state.phase === PHASE_LOST) return 'lost';
    // The phase as observed at the top of this step is what counts: the
    // draft hands the run to a build phase, and that build phase must
    // still get its turn to plant.
    const phaseBefore = state.phase;
    if (phaseBefore === PHASE_BUILD && prevPhase !== PHASE_BUILD) {
      const boost = state.wave !== boostedWave ? sapBoost : 0;
      boostedWave = state.wave;
      autopilotBuild(world, boost);
    } else if (phaseBefore === PHASE_DRAFT && prevPhase !== PHASE_DRAFT) {
      autopilotDraft(world);
    }
    prevPhase = phaseBefore;
    stepWorld(world, STEP, events);
    if (stop && stop(world.state)) return 'stopped';
  }
  return 'timeout';
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Unknown names stage the title. Shot runs play on Seedling so the
 * autopilot's war is winnable; the scenes are real games either way.
 */
export function stageShot(name, world) {
  // The play scene is staged on Warden: foes survive longer there, so
  // the busiest frame holds more of them. The other scenes use Seedling.
  world.setDifficulty(name === 'play' ? 'warden' : 'seedling');
  world.reset();
  const events = {};
  if (name !== 'play' && name !== 'draft' && name !== 'victory') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) stepWorld(world, STEP, events);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'draft') {
    driveAutopilot(world, (state) => state.phase === PHASE_DRAFT && state.wave >= 2, MAX_PLAY_SECONDS);
    const state = world.state;
    return {
      screen: state.phase === PHASE_DRAFT ? SCREEN_DRAFT : SCREEN_PLAY,
      best: state.score,
    };
  }
  if (name === 'play') {
    // A dense mid-war frame: two passes over the same deterministic run.
    // The first pass finds the busiest step (the most foes on the paths
    // at once, from wave 6 on); the second replays to that exact step,
    // so the frame is the war at its fullest.
    let steps = 0;
    let bestStep = -1;
    let bestAlive = -1;
    driveAutopilot(world, (state) => {
      steps += 1;
      if (state.phase === PHASE_COMBAT && state.wave >= 6) {
        const alive = state.enemies.filter((e) => e.alive).length;
        if (alive > bestAlive) {
          bestAlive = alive;
          bestStep = steps;
        }
      }
      return false;
    }, MAX_PLAY_SECONDS);
    world.reset();
    let replayed = 0;
    driveAutopilot(world, () => {
      replayed += 1;
      return replayed >= bestStep;
    }, MAX_PLAY_SECONDS);
    // Stop exactly at the peak: thorns are already in the air, and every
    // extra step lets the grove thin the crowd.
    const state = world.state;
    return {
      screen: state.phase === PHASE_WON ? SCREEN_VICTORY
        : state.phase === PHASE_LOST ? SCREEN_DEFEAT : SCREEN_PLAY,
      best: state.score,
    };
  }
  // Victory: the whole war, won. If the plain autopilot falls, a blessed
  // run (extra Sap each wave) stages the same real victory screen.
  let result = driveAutopilot(world, null, MAX_VICTORY_SECONDS);
  if (result !== 'won') {
    world.reset();
    result = driveAutopilot(world, null, MAX_VICTORY_SECONDS, 70);
  }
  const state = world.state;
  return {
    screen: state.phase === PHASE_WON ? SCREEN_VICTORY
      : state.phase === PHASE_LOST ? SCREEN_DEFEAT : SCREEN_PLAY,
    best: state.score,
  };
}

export { TOTAL_WAVES, autopilotBuild, autopilotDraft, driveAutopilot };
