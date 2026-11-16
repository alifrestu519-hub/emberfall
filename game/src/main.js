// Boot and the one loop: input is read every frame, the grove advances
// in fixed 1/60 s steps (twice as many at 2x speed), and the renderer
// paints what is there. The game moves between six screens: title,
// play, draft, paused, victory and defeat — plus the build phase inside
// play, where the Warden plants before sounding the horn.
//
// ?seed=N fixes the run. ?shot=title|play|draft|victory (with &seed=N)
// stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, BEST_WAVE_KEY, DIFFICULTY_ORDER, STEP, TOTAL_WAVES } from './config.js';
import {
  PHASE_BUILD, PHASE_COMBAT, PHASE_DRAFT, PHASE_LOST, PHASE_WON,
  applyDraft, costNow, createWorld, plantTower, rerollDraft, sellTowerById,
  startWave, stepWorld, upgradeTowerById, victoryStars,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DESELECT, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1,
  ACTION_PICK_2, ACTION_PICK_3, ACTION_RESTART, ACTION_REROLL, ACTION_SAME_SEED,
  ACTION_SELL, ACTION_SPEED, ACTION_START_WAVE, ACTION_TITLE, ACTION_UPGRADE,
  PICK_ACTIONS, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, LAYOUT, SCREEN_DEFEAT, SCREEN_DRAFT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
let seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
let difficulty = 'warden';
let world = createWorld(seed, difficulty);
const renderer = createRenderer(canvas);
const audio = createAudio();

/** A fresh grove on a fresh (or the same) seed; the old one is dropped. */
function newWorld(nextSeed) {
  seed = nextSeed >>> 0;
  world = createWorld(seed, difficulty);
  return world;
}

function readBest(key = difficulty) {
  try {
    return Number.parseInt(window.localStorage.getItem(`${BEST_KEY}.${key}`) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function readBests() {
  const bests = {};
  for (const key of DIFFICULTY_ORDER) bests[key] = readBest(key);
  return bests;
}

function saveBest(value, key = difficulty) {
  try {
    window.localStorage.setItem(`${BEST_KEY}.${key}`, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function readBestWave(key = difficulty) {
  try {
    return Number.parseInt(window.localStorage.getItem(`${BEST_WAVE_KEY}.${key}`) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBestWave(value, key = difficulty) {
  try {
    window.localStorage.setItem(`${BEST_WAVE_KEY}.${key}`, String(value));
  } catch {
    // Storage can be off; the best wave then lasts this visit only.
  }
}

function inRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function runShot(name) {
  const scene = stageShot(name, world);
  // A read-only handle for the screenshot run (never used by the game).
  window.__rootwarden = { screen: scene.screen, state: world.state, world };
  const ui = {
    best: scene.best, difficulty, bests: readBests(), seed, newBest: false,
    stars: scene.screen === SCREEN_VICTORY ? victoryStars(world.state) : 1,
    selectedGrowth: null, selectedTower: null, mouse: null, speed: 1, muted: true, hint: null,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let bests = readBests();
  let bestWave = readBestWave();
  let newBest = false;
  let stars = 1;
  let accumulator = 0;
  let last = performance.now();
  let speed = 1;
  let selectedGrowth = null;
  let selectedTower = null;
  let hint = null;
  let hintUntil = 0;

  function announce(message) {
    status.textContent = message;
  }

  function ui() {
    return {
      best, bests, difficulty, seed, newBest, stars,
      selectedGrowth, selectedTower, mouse: input.mouse(), speed,
      muted: audio.isMuted(), hint: performance.now() < hintUntil ? hint : null,
    };
  }

  function say(message, ms = 2600) {
    hint = message;
    hintUntil = performance.now() + ms;
    announce(message);
  }

  function startGame(sameSeed = false) {
    newWorld(sameSeed ? seed : Math.floor(Math.random() * 4294967296));
    newBest = false;
    stars = 1;
    best = readBest();
    bestWave = readBestWave();
    selectedGrowth = null;
    selectedTower = null;
    accumulator = 0;
    speed = 1;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Plant growths, then start the wave.');
  }

  function quitToTitle() {
    newWorld(Math.floor(Math.random() * 4294967296));
    selectedGrowth = null;
    selectedTower = null;
    screen = SCREEN_TITLE;
    announce('Rootwarden. Press Enter or click to start.');
  }

  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_DEFEAT;
    stars = victory ? victoryStars(world.state) : 1;
    newBest = world.state.score > best && world.state.score > 0;
    if (newBest) {
      best = world.state.score;
      bests = { ...bests, [difficulty]: best };
      saveBest(best);
    }
    const waves = world.state.stats.wavesCleared;
    if (waves > bestWave) {
      bestWave = waves;
      saveBestWave(bestWave);
    }
    if (victory) audio.victory();
    else audio.defeat();
    announce(victory
      ? `Victory! ${stars} stars. Score ${world.state.score}. Best ${best}.`
      : `The Heartwood falls on wave ${world.state.wave}. Score ${world.state.score}. Best ${best}.`);
  }

  function pickDraftCard(index) {
    const cards = world.state.draftCards;
    if (!cards || index >= cards.length) return;
    const card = cards[index];
    applyDraft(world, card);
    audio.draftChime();
    screen = SCREEN_PLAY;
    say(`Chose ${card.name}. Wave ${world.state.wave} awaits.`);
  }

  function reroll() {
    if (rerollDraft(world)) {
      audio.draftChime();
      say('Blessings re-dealt.');
    } else {
      audio.denied();
    }
  }

  function draftCardAt(mouse) {
    const cards = world.state.draftCards ?? [];
    for (let i = 0; i < cards.length; i += 1) {
      const x = LAYOUT.draftCardX0 + i * (LAYOUT.draftCardW + LAYOUT.draftCardGap);
      if (inRect(mouse.x, mouse.y, { x, y: LAYOUT.draftCardY, w: LAYOUT.draftCardW, h: LAYOUT.draftCardH })) return i;
    }
    return -1;
  }

  function diffAt(mouse) {
    for (let i = 0; i < DIFFICULTY_ORDER.length; i += 1) {
      const x = LAYOUT.diffX0 + i * (LAYOUT.diffW + LAYOUT.diffGap);
      if (inRect(mouse.x, mouse.y, { x, y: LAYOUT.diffY, w: LAYOUT.diffW, h: LAYOUT.diffH })) return i;
    }
    return -1;
  }

  function buildCardAt(mouse) {
    if (mouse.y < LAYOUT.cardY || mouse.y > LAYOUT.cardY + LAYOUT.cardH) return -1;
    for (let i = 0; i < 6; i += 1) {
      const x = LAYOUT.cardX0 + i * (LAYOUT.cardW + LAYOUT.cardGap);
      if (mouse.x >= x && mouse.x <= x + LAYOUT.cardW) return i;
    }
    return -1;
  }

  function plotAt(mouse) {
    let found = null;
    let foundD = Infinity;
    for (const plot of world.state.plots) {
      const d = Math.hypot(mouse.x - plot.x, mouse.y - plot.y);
      if (d < 30 && d < foundD) {
        foundD = d;
        found = plot;
      }
    }
    return found;
  }

  function towerAt(mouse) {
    for (const tower of world.state.towers) {
      if (!tower.alive) continue;
      if (Math.hypot(mouse.x - tower.x, mouse.y - tower.y) < 30) return tower;
    }
    return null;
  }

  function selectGrowth(kind) {
    if (!world.state.unlocked.has(kind)) {
      audio.denied();
      say('That growth is locked — find it in the draft after a wave.');
      return;
    }
    selectedGrowth = selectedGrowth === kind ? null : kind;
    selectedTower = null;
    if (selectedGrowth) announce(`Planting ${selectedGrowth}. Click a soil mound.`);
  }

  function tryPlant(plot) {
    if (!selectedGrowth) return;
    const result = plantTower(world, plot.id, selectedGrowth);
    if (result.ok) {
      audio.plant();
      if (world.state.sap < costNow(world.state, selectedGrowth)) selectedGrowth = null;
    } else if (result.reason === 'sap') {
      audio.denied();
      say('Not enough Sap — slay Blight or plant Sunblooms.');
    } else if (result.reason === 'occupied') {
      audio.denied();
    }
  }

  function tryUpgrade() {
    if (!selectedTower) return;
    const result = upgradeTowerById(world, selectedTower.id);
    if (result.ok) {
      audio.upgrade();
      say(`${selectedTower.kind} raised to tier ${selectedTower.tier}.`);
    } else if (result.reason === 'sap') {
      audio.denied();
      say('Not enough Sap for the upgrade.');
    } else if (result.reason === 'maxed') {
      audio.denied();
      say('That growth is already at its full height.');
    }
  }

  function trySell() {
    if (!selectedTower) return;
    const result = sellTowerById(world, selectedTower.id);
    if (result.ok) {
      audio.coin();
      say(`Uprooted for +${result.value} Sap.`);
      selectedTower = null;
    }
  }

  function handleClick(mouse) {
    if (screen === SCREEN_TITLE) {
      const picked = diffAt(mouse);
      if (picked >= 0) {
        difficulty = DIFFICULTY_ORDER[picked];
        world.setDifficulty(difficulty);
        best = readBest();
        bests = readBests();
        bestWave = readBestWave();
        announce(`Wardenship: ${difficulty}.`);
        return;
      }
      startGame();
      return;
    }
    if (screen === SCREEN_DRAFT) {
      const index = draftCardAt(mouse);
      if (index >= 0) pickDraftCard(index);
      else if (inRect(mouse.x, mouse.y, LAYOUT.rerollBtn)) reroll();
      return;
    }
    if (screen === SCREEN_VICTORY || screen === SCREEN_DEFEAT) {
      if (inRect(mouse.x, mouse.y, LAYOUT.endRestart)) startGame();
      else if (inRect(mouse.x, mouse.y, LAYOUT.endSameSeed)) startGame(true);
      else if (inRect(mouse.x, mouse.y, LAYOUT.endTitle)) quitToTitle();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (inRect(mouse.x, mouse.y, LAYOUT.pauseResume)) screen = SCREEN_PLAY;
      else if (inRect(mouse.x, mouse.y, LAYOUT.pauseRestart)) startGame();
      else if (inRect(mouse.x, mouse.y, LAYOUT.pauseMute)) audio.toggleMute();
      else if (inRect(mouse.x, mouse.y, LAYOUT.pauseTitle)) quitToTitle();
      return;
    }
    // Play screen: HUD buttons first.
    if (inRect(mouse.x, mouse.y, LAYOUT.startWave)) {
      if (world.state.phase === PHASE_BUILD) {
        startWave(world);
        audio.waveHorn();
      }
      return;
    }
    if (inRect(mouse.x, mouse.y, LAYOUT.speedBtn)) {
      speed = speed === 1 ? 2 : 1;
      announce(speed === 2 ? 'Fast-forward.' : 'Normal speed.');
      return;
    }
    if (inRect(mouse.x, mouse.y, LAYOUT.pauseBtn)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (inRect(mouse.x, mouse.y, LAYOUT.muteBtn)) {
      audio.toggleMute();
      return;
    }
    // The tower panel's buttons.
    if (selectedTower && selectedTower.alive) {
      if (inRect(mouse.x, mouse.y, LAYOUT.towerUpgrade)) {
        tryUpgrade();
        return;
      }
      if (inRect(mouse.x, mouse.y, LAYOUT.towerSell)) {
        trySell();
        return;
      }
      if (inRect(mouse.x, mouse.y, LAYOUT.towerClose)) {
        selectedTower = null;
        return;
      }
      if (inRect(mouse.x, mouse.y, LAYOUT.towerPanel)) return;
    }
    // The build bar.
    const card = buildCardAt(mouse);
    if (card >= 0) {
      const kinds = ['thorn', 'sprayer', 'spore', 'wall', 'sunbloom', 'mine'];
      selectGrowth(kinds[card]);
      return;
    }
    // The clearing: a tower, a plot, or open ground.
    const tower = towerAt(mouse);
    if (tower) {
      selectedTower = tower;
      selectedGrowth = null;
      return;
    }
    const plot = plotAt(mouse);
    if (plot && !plot.tower) {
      if (selectedGrowth) tryPlant(plot);
      else say('Pick a growth below (keys 1–6), then click a mound.');
      return;
    }
    selectedGrowth = null;
    selectedTower = null;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (input.takeRightClick()) {
      selectedGrowth = null;
      selectedTower = null;
    }
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE) {
      let picked = -1;
      if (actions & ACTION_PICK_1) picked = 0;
      else if (actions & ACTION_PICK_2) picked = 1;
      else if (actions & ACTION_PICK_3) picked = 2;
      if (picked >= 0) {
        difficulty = DIFFICULTY_ORDER[picked];
        world.setDifficulty(difficulty);
        best = readBest();
        bests = readBests();
        bestWave = readBestWave();
        announce(`Wardenship: ${difficulty}.`);
        return;
      }
      if (actions & ACTION_CONFIRM) startGame();
      else if (input.takeClick()) handleClick(input.mouse());
      return;
    }
    if (screen === SCREEN_DRAFT) {
      if (actions & ACTION_PICK_1) pickDraftCard(0);
      else if (actions & ACTION_PICK_2) pickDraftCard(1);
      else if (actions & ACTION_PICK_3) pickDraftCard(2);
      else if (actions & ACTION_REROLL) reroll();
      else if (input.takeClick()) handleClick(input.mouse());
      return;
    }
    if (screen === SCREEN_VICTORY || screen === SCREEN_DEFEAT) {
      if (actions & ACTION_SAME_SEED) startGame(true);
      else if (actions & ACTION_CONFIRM) startGame();
      else if (actions & ACTION_TITLE) quitToTitle();
      else if (input.takeClick()) handleClick(input.mouse());
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) screen = SCREEN_PLAY;
      else if (actions & ACTION_TITLE) quitToTitle();
      else if (input.takeClick()) handleClick(input.mouse());
      return;
    }
    // Play screen.
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_SPEED) {
      speed = speed === 1 ? 2 : 1;
      announce(speed === 2 ? 'Fast-forward.' : 'Normal speed.');
    }
    if (actions & ACTION_START_WAVE && world.state.phase === PHASE_BUILD) {
      startWave(world);
      audio.waveHorn();
    }
    if (actions & ACTION_DESELECT) {
      selectedGrowth = null;
      selectedTower = null;
    }
    for (let i = 0; i < PICK_ACTIONS.length; i += 1) {
      if (actions & PICK_ACTIONS[i]) {
        const kinds = ['thorn', 'sprayer', 'spore', 'wall', 'sunbloom', 'mine'];
        selectGrowth(kinds[i]);
        break;
      }
    }
    if (actions & ACTION_UPGRADE) tryUpgrade();
    if (actions & ACTION_SELL) trySell();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (input.takeClick()) handleClick(input.mouse());
  }

  function playStep() {
    const events = {};
    stepWorld(world, STEP, events);
    if (events.shoot) audio.shoot();
    if (events.spray) audio.spray();
    if (events.kill) audio.kill();
    if (events.explosion) audio.explosion();
    if (events.treeHurt) audio.treeHurt();
    if (events.towerLost) audio.towerLost();
    if (events.wave) audio.waveHorn();
    if (events.boss || events.bossPhase) audio.bossRoar();
    if (events.waveClear) audio.waveClear();
    if (events.draft) {
      screen = SCREEN_DRAFT;
      audio.draftChime();
      announce(`Wave cleared! Choose a blessing.`);
    }
    if (world.state.phase === PHASE_WON) endGame(true);
    else if (world.state.phase === PHASE_LOST) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The grove breathes behind the title: leaves drift, the tree sways,
      // but the horn never sounds on its own.
      const events = {};
      while (accumulator >= STEP) {
        world.state.buildTimer = 30;
        stepWorld(world, STEP, events);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        for (let s = 0; s < speed; s += 1) {
          playStep();
          if (screen !== SCREEN_PLAY) break;
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, ui());
  }

  // Leaving the tab pauses a running game rather than letting the Blight
  // march unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Rootwarden. Press Enter or click to start.');
  // A read-only handle for automated playtests (never used by the game).
  window.__rootwarden = {
    get screen() {
      return screen;
    },
    get best() {
      return best;
    },
    get state() {
      return world.state;
    },
    get world() {
      return world;
    },
    get seed() {
      return seed;
    },
    get difficulty() {
      return difficulty;
    },
  };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
