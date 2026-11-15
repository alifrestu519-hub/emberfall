// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, level-up, paused, victory and game over.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|levelup|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, DIFFICULTY_ORDER, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_LEVEL, EVENT_OVER, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, ACTION_REROLL, ACTION_RESTART, ACTION_REWIND, ACTION_SAME_SEED, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
/** Card hit-boxes, in logical coordinates; must match render.js's layout. */
const CARD = { y: 240, w: 280, h: 240, gap: 32 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
let seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
let world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** A fresh world on a fresh (or the same) seed; the old one is dropped. */
function newWorld(nextSeed) {
  seed = nextSeed >>> 0;
  world = createWorld(createRandom(seed));
  world.setDifficulty(difficulty);
  return world;
}

/** Difficulty boxes on the title screen; must match render.js's layout. */
const DIFF_BOX = { y: 262, w: 240, h: 80, gap: 20 };
/** The reroll button on the level-up screen; must match render.js. */
const REROLL_BTN = { x: 530, y: 500, w: 220, h: 36 };

/** The winter in force; the title screen changes it before a run. */
let difficulty = 'normal';

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
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // A read-only handle for the screenshot run (never used by the game).
  window.__echoloop = { screen: scene.screen, state: world.state, world };
  const ui = { best: scene.best, difficulty, bests: readBests(), seed, newBest: false };
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
  let newBest = false;
  let accumulator = 0;
  let last = performance.now();
  let rewindQueued = false;

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function ui() {
    return { best, difficulty, bests, seed, newBest };
  }

  function startGame(sameSeed = false) {
    // A new clock gets a new seed; the same seed rebuilds the same clock
    // from scratch, so the spawns replay exactly.
    newWorld(sameSeed ? seed : Math.floor(Math.random() * 4294967296));
    newBest = false;
    best = readBest();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Survive all six waves.');
  }

  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    newBest = world.state.score > best && world.state.score > 0;
    if (newBest) {
      best = world.state.score;
      bests = { ...bests, [difficulty]: best };
      saveBest(best);
    }
    if (victory) audio.victory();
    else audio.defeat();
    announce(victory ? `Victory! Score ${world.state.score}. Best ${best}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pickCard(index) {
    const choices = world.state.levelChoices;
    if (!choices || index >= choices.length) return;
    world.applyUpgrade(choices[index]);
    audio.levelUp();
    screen = SCREEN_PLAY;
    announce(`Chose ${choices[index].name}.`);
  }

  function reroll() {
    if (world.rerollUpgrades()) {
      audio.levelUp();
      announce('Boons re-dealt.');
    }
  }

  function cardAt(mouse) {
    const choices = world.state.levelChoices ?? [];
    const total = choices.length * CARD.w + (choices.length - 1) * CARD.gap;
    let x = 640 - total / 2;
    for (let i = 0; i < choices.length; i += 1) {
      if (mouse.x >= x && mouse.x <= x + CARD.w && mouse.y >= CARD.y && mouse.y <= CARD.y + CARD.h) return i;
      x += CARD.w + CARD.gap;
    }
    return -1;
  }

  function diffAt(mouse) {
    const total = DIFFICULTY_ORDER.length * DIFF_BOX.w + (DIFFICULTY_ORDER.length - 1) * DIFF_BOX.gap;
    let x = 640 - total / 2;
    for (let i = 0; i < DIFFICULTY_ORDER.length; i += 1) {
      if (mouse.x >= x && mouse.x <= x + DIFF_BOX.w && mouse.y >= DIFF_BOX.y && mouse.y <= DIFF_BOX.y + DIFF_BOX.h) return i;
      x += DIFF_BOX.w + DIFF_BOX.gap;
    }
    return -1;
  }

  function rerollAt(mouse) {
    return mouse.x >= REROLL_BTN.x && mouse.x <= REROLL_BTN.x + REROLL_BTN.w
      && mouse.y >= REROLL_BTN.y && mouse.y <= REROLL_BTN.y + REROLL_BTN.h;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_REWIND) rewindQueued = true;
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE) {
      // 1/2/3 or a click picks the winter; Space or a click elsewhere starts.
      let picked = -1;
      if (actions & ACTION_PICK_1) picked = 0;
      else if (actions & ACTION_PICK_2) picked = 1;
      else if (actions & ACTION_PICK_3) picked = 2;
      else if (input.takeClick()) picked = diffAt(input.mouse());
      if (picked >= 0) {
        difficulty = DIFFICULTY_ORDER[picked];
        best = readBest();
        bests = readBests();
        announce(`Winter: ${difficulty}.`);
        return;
      }
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_LEVEL) {
      if (actions & ACTION_PICK_1) pickCard(0);
      else if (actions & ACTION_PICK_2) pickCard(1);
      else if (actions & ACTION_PICK_3) pickCard(2);
      else if (actions & ACTION_REROLL) reroll();
      else if (input.takeClick()) {
        const mouse = input.mouse();
        const index = cardAt(mouse);
        if (index >= 0) pickCard(index);
        else if (rerollAt(mouse)) reroll();
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & ACTION_SAME_SEED) {
        startGame(true);
        return;
      }
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
  }

  function playStep() {
    const events = {};
    const dir = input.direction();
    let fireAngle = null;
    if (input.mouseDown()) {
      const m = input.mouse();
      fireAngle = Math.atan2(m.y - world.state.player.y, m.x - world.state.player.x);
    }
    const result = world.step(STEP, dir, fireAngle, rewindQueued, events);
    rewindQueued = false;
    if (events.shoot) audio.shoot();
    if (events.pickup) audio.pickup();
    if (events.hurt) audio.hurt();
    if (events.kill) audio.kill();
    if (events.rewind) audio.rewind();
    if (events.echo) audio.echo();
    if (events.timestop) audio.timestop();
    if (events.wave) audio.wave();
    if (events.boss) audio.boss();
    if (events.seize) audio.seize();
    if (events.break) audio.break();
    if (events.chime) audio.chime();
    if (events.chimeWarn) audio.chimeWarn();
    if (result & EVENT_WIN) endGame(true);
    else if (result & EVENT_OVER) endGame(false);
    else if (result & EVENT_LEVEL) {
      screen = SCREEN_LEVEL;
      audio.levelUp();
      announce('Level up! Choose a boon.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      const events = {};
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0 }, null, false, events);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        playStep();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, ui());
  }

  // Leaving the tab pauses a running game rather than letting the dark close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Echoloop. Press Space or click to start.');
  // A read-only handle for automated playtests (never used by the game).
  window.__echoloop = {
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
