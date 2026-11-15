// The arena itself: player, enemies, bolts, cogs, particles and waves.
// The world advances in fixed 1/60 s steps and reports events as a bitmask,
// so the loop, the screenshots and the autopilot all share one simulation.
// Echoloop adds three systems on top of the arena core: echoes — ghosts of
// the player's own cleared waves that fight beside them; the rewind, which
// jumps body and health back three seconds; and paradox, which stops time
// when the horologist stands close to their past selves. Bolts rust the
// clockwork foes until they seize solid, and the Great Chime bends time
// for the whole arena on its own clock.
import { BOSS, CHIME, COMBO, DIFFICULTY, ECHO, ELITE, ENEMY, FIELD, LEVEL_XP, PARADOX, PLAYER, POOL, REWIND, RUST, SPAWN, WAVE_QUOTA, WAVE_REST, WAVES, WELL } from './config.js';
import { rollUpgrades } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_LEVEL = 4;
export const EVENT_WAVE = 8;
export const EVENT_WIN = 16;
export const EVENT_KILL = 32;
export const EVENT_SEIZE = 64;
export const EVENT_BREAK = 128;
export const EVENT_CHIME = 256;

const TAU = Math.PI * 2;

function makePool(size, make) {
  const items = [];
  for (let i = 0; i < size; i += 1) items.push(make());
  return items;
}

export function createWorld(random) {
  const state = {
    time: 0,
    wave: 1,
    waveKills: 0,
    waveState: 'fight', // fight | rest | boss
    restTimer: 0,
    spawnTimer: 0,
    kills: 0,
    score: 0,
    level: 1,
    xp: 0,
    xpNext: LEVEL_XP[0],
    shake: 0,
    flash: 0,
    boss: null,
    bossSpawned: false,
    bossPhase2: false,
    levelChoices: null,
    taken: {},
    rerollsLeft: 0,
    difficulty: 'normal',
    eliteSpawned: false,
    eliteDefeated: false,
    eliteAnnounced: false,
    damageDealt: 0,
    shotsFired: 0,
    combo: 0,
    comboTimer: 0,
    comboBest: 0,
    comboMult: 1,
    brokenKills: 0,
    chimeState: 'calm', // calm | warn | chime
    chimeTimer: CHIME.firstAt,
    chimeTime: 0,
    wellTimer: WELL.every,
    wells: makePool(POOL.wells, () => ({ active: false })),
    // The loop: this wave's path (becomes an echo on a clear), the
    // rewind's three seconds of past, and the paradox meter.
    recording: [],
    recordTimer: 0,
    echoes: makePool(POOL.echoes, () => ({ active: false, points: [] })),
    history: [],
    historyTimer: 0,
    paradox: 0,
    timeStop: 0,
    player: null,
    enemies: makePool(POOL.enemies, () => ({ active: false })),
    bolts: makePool(POOL.bolts, () => ({ active: false })),
    shards: makePool(POOL.shards, () => ({ active: false })),
    particles: makePool(POOL.particles, () => ({ active: false })),
    texts: makePool(POOL.texts, () => ({ active: false })),
    stars: [],
  };

  for (let i = 0; i < 90; i += 1) {
    state.stars.push({
      x: random.range(0, FIELD.width),
      y: random.range(0, FIELD.height),
      r: random.range(0.6, 2.2),
      twinkle: random.range(0, TAU),
      speed: random.range(0.4, 1.6),
    });
  }

  function spawnParticle(x, y, colour, count, speed, life, size) {
    let made = 0;
    for (let i = 0; i < state.particles.length && made < count; i += 1) {
      const p = state.particles[i];
      if (p.active) continue;
      const a = random.angle();
      const v = random.range(speed * 0.3, speed);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = random.range(life * 0.5, life);
      p.maxLife = p.life;
      p.size = random.range(size * 0.6, size * 1.4);
      p.colour = colour;
      made += 1;
    }
  }

  function floatText(x, y, text, colour, size = 14) {
    for (let i = 0; i < state.texts.length; i += 1) {
      const t = state.texts[i];
      if (t.active) continue;
      t.active = true;
      t.x = x;
      t.y = y;
      t.text = text;
      t.colour = colour;
      t.size = size;
      t.life = 0.9;
      return;
    }
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMY[kind];
    const e = free(state.enemies);
    if (!e) return null;
    const diff = DIFFICULTY[state.difficulty] ?? DIFFICULTY.normal;
    const waveScale = 1 + (state.wave - 1) * 0.14;
    e.active = true;
    e.kind = kind;
    e.elite = false;
    e.x = x;
    e.y = y;
    e.hp = def.hp * waveScale * diff.enemyHp;
    e.maxHp = e.hp;
    e.speed = def.speed * diff.enemySpeed * random.range(0.9, 1.1);
    e.radius = def.radius;
    e.damage = def.damage;
    e.xp = def.xp;
    e.score = def.score;
    e.colour = def.colour;
    e.hitFlash = 0;
    e.spawnTime = state.time;
    e.kx = 0;
    e.ky = 0;
    e.slowUntil = 0;
    e.rust = 0;
    e.rustTimer = 0;
    e.seizedUntil = 0;
    e.immuneUntil = 0;
    e.shootTimer = random.range(1, 2);
    e.chargeTimer = BOSS.chargeEvery;
    e.charging = 0;
    e.chargeDir = { x: 0, y: 0 };
    e.moteTimer = BOSS.spawnMinionsEvery;
    e.burstTimer = BOSS.burstEvery;
    e.lungeState = 'stalk'; // stalk | crouch | lunge
    e.lungeTimer = random.range(1.5, 3);
    e.lungeDir = { x: 0, y: 0 };
    e.wobble = random.range(0, TAU);
    return e;
  }

  function spawnAtEdge(kind) {
    const side = random.int(0, 3);
    const m = FIELD.margin;
    let x;
    let y;
    if (side === 0) { x = random.range(m, FIELD.width - m); y = -30; }
    else if (side === 1) { x = random.range(m, FIELD.width - m); y = FIELD.height + 30; }
    else if (side === 2) { x = -30; y = random.range(m, FIELD.height - m); }
    else { x = FIELD.width + 30; y = random.range(m, FIELD.height - m); }
    return spawnEnemy(kind, x, y);
  }

  function pickKind() {
    const wave = state.wave;
    const roll = random.next();
    if (wave >= 6) {
      if (roll < 0.22) return 'tick';
      if (roll < 0.4) return 'spring';
      if (roll < 0.54) return 'cogwheel';
      if (roll < 0.66) return 'mainspring';
      if (roll < 0.8) return 'bell';
      if (roll < 0.92) return 'pendulum';
      return 'golem';
    }
    if (wave >= 5) {
      if (roll < 0.26) return 'tick';
      if (roll < 0.44) return 'spring';
      if (roll < 0.58) return 'cogwheel';
      if (roll < 0.72) return 'mainspring';
      if (roll < 0.86) return 'bell';
      if (roll < 0.95) return 'pendulum';
      return 'golem';
    }
    if (wave >= 4) {
      if (roll < 0.3) return 'tick';
      if (roll < 0.5) return 'spring';
      if (roll < 0.64) return 'cogwheel';
      if (roll < 0.78) return 'mainspring';
      if (roll < 0.9) return 'bell';
      return 'pendulum';
    }
    if (wave >= 3) {
      if (roll < 0.36) return 'tick';
      if (roll < 0.58) return 'spring';
      if (roll < 0.74) return 'cogwheel';
      if (roll < 0.88) return 'mainspring';
      return 'bell';
    }
    if (wave >= 2) {
      if (roll < 0.44) return 'tick';
      if (roll < 0.7) return 'spring';
      if (roll < 0.86) return 'cogwheel';
      return 'pendulum';
    }
    return roll < 0.7 ? 'tick' : 'spring';
  }

  /** The combo's score multiplier: +1 every five chained kills, to x6. */
  function comboMultiplier() {
    return Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.perStep));
  }

  function dropShard(x, y, value) {
    const s = free(state.shards);
    if (!s) return;
    s.active = true;
    s.x = x;
    s.y = y;
    s.vx = random.range(-50, 50);
    s.vy = random.range(-50, 50);
    s.value = value;
    s.life = 14;
    s.magnet = false;
  }

  function killEnemy(e, awardXp) {
    const wasSeized = state.time < e.seizedUntil;
    e.active = false;
    state.kills += 1;
    state.waveKills += 1;
    // The combo: every kill inside the window chains, and the multiplier
    // pays out on the score. A seized kill breaks apart for double.
    state.combo = Math.min(COMBO.max, state.combo + 1);
    state.comboTimer = COMBO.window + (state.player?.comboBonus ?? 0);
    if (state.combo > state.comboBest) state.comboBest = state.combo;
    let gained = e.score * comboMultiplier();
    if (e.elite) {
      gained += ELITE.score;
      state.eliteDefeated = true;
      floatText(e.x, e.y - 44, `${ELITE.name} FELLED!  +${ELITE.score}`, '#ffd166', 22);
      spawnParticle(e.x, e.y, '#ffd166', 30, 280, 0.9, 5);
      // The Rogue Cog's heart mends the keeper: the elite is a risk worth taking.
      const p = state.player;
      if (p && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + ELITE.heal);
        floatText(p.x, p.y - 34, `+${ELITE.heal} HEART`, '#7dffb0', 16);
      }
    }
    if (wasSeized) {
      gained *= 2;
      state.brokenKills += 1;
      spawnParticle(e.x, e.y, '#ffe9a8', 22, 260, 0.7, 4);
      floatText(e.x, e.y - 30, 'BREAK!', '#ffd166', 18);
    }
    state.score += gained;
    spawnParticle(e.x, e.y, e.colour, e.kind === 'grandfather' ? 60 : 12, 190, 0.6, 4);
    spawnParticle(e.x, e.y, '#ffd166', 6, 120, 0.5, 3);
    if (e.kind === 'mainspring') {
      spawnEnemy('spring', e.x - 14, e.y);
      spawnEnemy('spring', e.x + 14, e.y);
    }
    if (e.kind === 'golem') {
      spawnEnemy('tick', e.x - 20, e.y);
      spawnEnemy('tick', e.x + 20, e.y);
    }
    if (e.kind === 'grandfather') {
      state.boss = null;
      state.bossDefeated = true;
      floatText(e.x, e.y - 30, 'THE GRANDFATHER STOPS!', '#ffd166', 26);
      return;
    }
    if (awardXp) {
      for (let i = 0; i < e.xp; i += 1) dropShard(e.x + random.range(-12, 12), e.y + random.range(-12, 12), 1);
    }
  }

  /** Add rust to a foe; a full stack seizes its gears solid. Returns 'seize' when it locks. */
  function addRust(e, stacks) {
    if (e.kind === 'grandfather' || state.time < e.immuneUntil) return null;
    if (state.time >= e.seizedUntil) {
      e.rust = Math.min(RUST.maxStacks, e.rust + stacks);
      e.rustTimer = RUST.decayAfter;
      if (e.rust >= RUST.maxStacks) {
        e.seizedUntil = state.time + RUST.seizeTime;
        e.immuneUntil = e.seizedUntil + RUST.immuneTime;
        e.rust = 0;
        spawnParticle(e.x, e.y, '#ffe9a8', 14, 160, 0.6, 4);
        return 'seize';
      }
    }
    return null;
  }

  function hurtPlayer(damage, fromX, fromY) {
    const p = state.player;
    if (p.invulnerable > 0) return 0;
    p.hp -= damage;
    p.invulnerable = PLAYER.hurtInvulnerable;
    // A hit breaks the streak: the combo is a risk, not a given.
    if (state.combo >= 4) floatText(p.x, p.y - 40, 'COMBO LOST', '#ff6b81', 16);
    state.combo = 0;
    state.comboTimer = 0;
    state.flash = 0.35;
    state.shake = 10;
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    p.x += (dx / d) * 18;
    p.y += (dy / d) * 18;
    spawnParticle(p.x, p.y, '#ff6b81', 10, 160, 0.5, 4);
    floatText(p.x, p.y - 26, `-${damage}`, '#ff6b81', 16);
    if (p.hp <= 0) {
      p.hp = 0;
      return EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireBolt(angle, damage, pierce, fromX, fromY, echo = false) {
    const b = free(state.bolts);
    if (!b) return;
    b.active = true;
    b.echo = echo;
    b.x = fromX + Math.cos(angle) * 22;
    b.y = fromY + Math.sin(angle) * 22;
    b.vx = Math.cos(angle) * PLAYER.boltSpeed;
    b.vy = Math.sin(angle) * PLAYER.boltSpeed;
    b.damage = damage;
    b.radius = PLAYER.boltRadius;
    b.pierce = pierce;
    b.enemy = false;
    b.life = 1.4;
    if (!echo) spawnParticle(b.x, b.y, '#ffcf5c', 2, 40, 0.25, 3);
  }

  function fireVolley(angle) {
    const p = state.player;
    const n = p.projectiles;
    const spread = 0.16;
    state.shotsFired += n;
    for (let i = 0; i < n; i += 1) {
      const offset = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      fireBolt(angle + offset, p.boltDamage, p.pierce, p.x, p.y);
    }
  }

  function nearestEnemy(x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      if (!e.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function resetPlayer() {
    const diff = DIFFICULTY[state.difficulty] ?? DIFFICULTY.normal;
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      radius: PLAYER.radius,
      hp: diff.playerHp,
      maxHp: diff.playerHp,
      speed: PLAYER.speed,
      fireInterval: PLAYER.fireInterval,
      boltDamage: PLAYER.boltDamage,
      projectiles: 1,
      pierce: 0,
      pickupRadius: PLAYER.pickupRadius,
      rewindCharges: REWIND.startCharges,
      rewindMax: REWIND.maxCharges,
      rustPerHit: 1,
      comboBonus: 0,
      breakBonus: 0,
      fireTimer: 0,
      invulnerable: 0,
      aim: -Math.PI / 2,
      walkPhase: 0,
      moving: false,
    };
  }

  function reset() {
    state.time = 0;
    state.wave = 1;
    state.waveKills = 0;
    state.waveState = 'fight';
    state.restTimer = 0;
    state.spawnTimer = 0.8;
    state.kills = 0;
    state.score = 0;
    state.level = 1;
    state.xp = 0;
    state.xpNext = LEVEL_XP[0];
    state.shake = 0;
    state.flash = 0;
    state.boss = null;
    state.bossSpawned = false;
    state.bossDefeated = false;
    state.bossPhase2 = false;
    state.levelChoices = null;
    state.taken = {};
    state.rerollsLeft = 0;
    state.eliteSpawned = false;
    state.eliteDefeated = false;
    state.eliteAnnounced = false;
    state.damageDealt = 0;
    state.shotsFired = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.comboBest = 0;
    state.comboMult = 1;
    state.brokenKills = 0;
    state.chimeState = 'calm';
    state.chimeTimer = CHIME.firstAt;
    state.chimeTime = 0;
    state.wellTimer = WELL.every;
    state.recording = [];
    state.recordTimer = 0;
    state.history = [];
    state.historyTimer = 0;
    state.paradox = 0;
    state.timeStop = 0;
    for (const list of [state.enemies, state.bolts, state.shards, state.particles, state.texts, state.wells, state.echoes]) {
      for (const item of list) item.active = false;
    }
    resetPlayer();
  }

  function gainXp(amount) {
    state.xp += amount;
    if (state.xp < state.xpNext) return false;
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = LEVEL_XP[Math.min(state.level - 1, LEVEL_XP.length - 1)];
    state.levelChoices = rollUpgrades(random, state.taken);
    state.rerollsLeft = 1;
    // A level-up rewinds the clock by one charge: time is a resource too.
    const p = state.player;
    p.rewindCharges = Math.min(p.rewindMax, p.rewindCharges + 1);
    spawnParticle(state.player.x, state.player.y, '#ffd166', 26, 220, 0.8, 4);
    floatText(state.player.x, state.player.y - 34, 'LEVEL UP!', '#ffd166', 22);
    return true;
  }

  function applyUpgrade(upgrade) {
    upgrade.apply(state.player);
    state.taken[upgrade.id] = (state.taken[upgrade.id] ?? 0) + 1;
    state.levelChoices = null;
  }

  /** One free re-deal of the level-up cards, per level-up. */
  function rerollUpgrades() {
    if (state.rerollsLeft <= 0 || !state.levelChoices) return false;
    state.rerollsLeft -= 1;
    state.levelChoices = rollUpgrades(random, state.taken);
    return true;
  }

  /** The winding's bite: set before a run starts, kept across resets. */
  function setDifficulty(key) {
    if (!DIFFICULTY[key]) return;
    state.difficulty = key;
    // A fresh world (or a fresh run) takes the new winding's health at once.
    if (state.player && state.time === 0) {
      const hp = DIFFICULTY[key].playerHp;
      state.player.maxHp = hp;
      state.player.hp = hp;
    }
  }

  /** A cleared wave leaves its echo: the path just walked, fighting on. */
  function leaveEcho() {
    if (state.recording.length < 10) return;
    const slot = free(state.echoes);
    if (!slot) return;
    slot.active = true;
    slot.points = state.recording.map((pt) => ({ x: pt.x, y: pt.y }));
    slot.t = 0;
    slot.fireTimer = 0.5;
    slot.x = slot.points[0].x;
    slot.y = slot.points[0].y;
    slot.aim = -Math.PI / 2;
    floatText(FIELD.width / 2, 170, 'AN ECHO JOINS THE FIGHT', '#ffe9a8', 20);
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveKills = 0;
    state.waveState = 'fight';
    state.spawnTimer = 0.6;
    state.bossSpawned = false;
    state.recording = [];
    state.recordTimer = 0;
    if (wave === ELITE.wave && !state.eliteSpawned) {
      state.eliteSpawned = true;
      const elite = spawnAtEdge(ELITE.kind);
      if (elite) {
        elite.elite = true;
        elite.hp = elite.maxHp * ELITE.hpMult;
        elite.maxHp = elite.hp;
        elite.radius *= ELITE.radiusMult;
        elite.damage += 3;
        floatText(FIELD.width / 2, 170, `★ ${ELITE.name} STALKS THE CLOCK ★`, '#ffd166', 24);
      }
    }
    if (wave === WAVES) {
      const boss = spawnAtEdge('grandfather');
      state.boss = boss;
      state.bossSpawned = true;
    }
  }

  function step(dt, move, fireAngle, rewind, events) {
    const p = state.player;
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flash = Math.max(0, state.flash - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (state.timeStop > 0) state.timeStop -= dt;
    const stopped = state.timeStop > 0;

    // --- combo: the streak fades when the window lapses ---
    state.comboMult = comboMultiplier();
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // --- the Great Chime: calm, then a warning, then the strike itself ---
    state.chimeTimer -= dt;
    if (state.chimeState === 'calm' && state.chimeTimer <= 0) {
      state.chimeState = 'warn';
      state.chimeTimer = CHIME.warnTime;
      floatText(FIELD.width / 2, 150, 'THE GREAT CHIME COMES…', '#ffe9a8', 24);
      events.chimeWarn = true;
    } else if (state.chimeState === 'warn' && state.chimeTimer <= 0) {
      state.chimeState = 'chime';
      state.chimeTimer = CHIME.duration;
      state.chimeTime = 0;
      events.chime = true;
    } else if (state.chimeState === 'chime') {
      state.chimeTime += dt;
      if (state.chimeTimer <= 0) {
        state.chimeState = 'calm';
        state.chimeTimer = CHIME.every;
      }
    }
    const chiming = state.chimeState === 'chime';

    // The elite's arrival gets the boss's horn, one step late.
    if (state.eliteSpawned && !state.eliteAnnounced) {
      state.eliteAnnounced = true;
      events.boss = true;
    }

    // --- time wells: slow ground that rusts whatever stands on it ---
    state.wellTimer -= dt;
    if (state.wellTimer <= 0) {
      state.wellTimer = WELL.every;
      const r = free(state.wells);
      if (r) {
        r.active = true;
        r.x = random.range(120, FIELD.width - 120);
        r.y = random.range(120, FIELD.height - 120);
        r.radius = WELL.radius;
        r.life = WELL.life;
        r.maxLife = WELL.life;
      }
    }
    for (const r of state.wells) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      for (const e of state.enemies) {
        if (!e.active || e.kind === 'grandfather') continue;
        const dx = e.x - r.x;
        const dy = e.y - r.y;
        if (dx * dx + dy * dy < r.radius * r.radius) {
          e.rustFloat = (e.rustFloat ?? 0) + WELL.rustPerSecond * dt;
          if (e.rustFloat >= 1) {
            e.rustFloat -= 1;
            if (addRust(e, 1) === 'seize') events.seize = true;
          }
        }
      }
    }

    // --- the rewind's memory: three seconds of where the keeper has been ---
    state.historyTimer -= dt;
    if (state.historyTimer <= 0) {
      state.historyTimer = REWIND.sampleEvery;
      state.history.push({ x: p.x, y: p.y, hp: p.hp });
      const maxLen = Math.floor(REWIND.seconds / REWIND.sampleEvery);
      while (state.history.length > maxLen) state.history.shift();
    }

    // --- the rewind itself: Space jumps body and health back in time ---
    if (rewind && p.rewindCharges > 0 && state.history.length > 0) {
      const past = state.history[0];
      spawnParticle(p.x, p.y, '#ffe9a8', 18, 220, 0.6, 4);
      p.x = past.x;
      p.y = past.y;
      p.hp = past.hp;
      p.invulnerable = Math.max(p.invulnerable, 0.5);
      p.rewindCharges -= 1;
      state.history = [];
      state.historyTimer = 0;
      spawnParticle(p.x, p.y, '#ffe9a8', 18, 220, 0.6, 4);
      floatText(p.x, p.y - 34, 'REWIND!', '#ffe9a8', 20);
      events.rewind = true;
    }

    // --- this wave's recording: the path the next echo will walk ---
    if (state.waveState === 'fight') {
      state.recordTimer -= dt;
      if (state.recordTimer <= 0) {
        state.recordTimer = ECHO.sampleEvery;
        state.recording.push({ x: p.x, y: p.y });
      }
    }

    // --- echoes: past selves replaying their wave, and shooting ---
    for (const echo of state.echoes) {
      if (!echo.active) continue;
      const pts = echo.points;
      echo.t += dt;
      const span = pts.length * ECHO.sampleEvery;
      const ft = ((echo.t % span) / ECHO.sampleEvery);
      const i0 = Math.floor(ft) % pts.length;
      const i1 = (i0 + 1) % pts.length;
      const f = ft - Math.floor(ft);
      echo.x = pts[i0].x + (pts[i1].x - pts[i0].x) * f;
      echo.y = pts[i0].y + (pts[i1].y - pts[i0].y) * f;
      echo.fireTimer -= dt;
      if (echo.fireTimer <= 0) {
        const target = nearestEnemy(echo.x, echo.y, ECHO.range);
        if (target) {
          echo.fireTimer = ECHO.fireInterval;
          echo.aim = Math.atan2(target.y - echo.y, target.x - echo.x);
          fireBolt(echo.aim, ECHO.damage, 0, echo.x, echo.y, true);
        } else {
          echo.fireTimer = 0.2;
        }
      }
      // Paradox: standing near a past self winds the meter.
      const dx = p.x - echo.x;
      const dy = p.y - echo.y;
      if (dx * dx + dy * dy < PARADOX.radius * PARADOX.radius && state.timeStop <= 0) {
        state.paradox += PARADOX.fillPerSecond * dt;
        if (state.paradox >= 100) {
          state.paradox = 0;
          state.timeStop = PARADOX.stopTime;
          floatText(FIELD.width / 2, 200, 'TIME STOP!', '#ffe9a8', 30);
          state.shake = 8;
          events.timestop = true;
        }
      }
    }

    // --- player movement ---
    const len = Math.hypot(move.x, move.y);
    p.moving = len > 0;
    if (p.moving) {
      p.walkPhase += dt * 11;
      const nx = move.x / (len || 1);
      const ny = move.y / (len || 1);
      const speed = p.speed * (chiming ? 1 + CHIME.playerBoost : 1);
      p.x += nx * speed * dt;
      p.y += ny * speed * dt;
    }
    p.x = Math.min(FIELD.width - FIELD.margin, Math.max(FIELD.margin, p.x));
    p.y = Math.min(FIELD.height - FIELD.margin, Math.max(FIELD.margin, p.y));

    // --- aiming and auto-fire ---
    if (fireAngle !== null) p.aim = fireAngle;
    p.fireTimer -= dt;
    const target = nearestEnemy(p.x, p.y, 520);
    if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
    if (p.fireTimer <= 0 && target) {
      p.fireTimer = p.fireInterval;
      fireVolley(p.aim);
      events.shoot = true;
    }

    // --- spawning ---
    const quota = WAVE_QUOTA[state.wave - 1];
    if (state.waveState === 'fight') {
      state.spawnTimer -= dt;
      const interval = Math.max(SPAWN.min, SPAWN.base - state.waveKills * SPAWN.shrinkPerKill);
      if (state.spawnTimer <= 0 && state.waveKills + aliveCount() < quota + 12) {
        state.spawnTimer = interval;
        spawnAtEdge(pickKind());
      }
      if (state.waveKills >= quota && state.wave !== WAVES) {
        state.waveState = 'rest';
        state.restTimer = WAVE_REST;
        // The cleared wave stays behind as an echo, fighting on.
        leaveEcho();
        events.echo = true;
        // The mainspring mends the keeper between waves: +10 HP on a clear.
        if (p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + 10);
          floatText(p.x, p.y - 30, '+10 MENDED', '#ffd166', 15);
        }
        events.wave = true;
      } else if (state.waveKills >= quota && state.wave === WAVES && state.bossDefeated) {
        return EVENT_WIN;
      }
    } else if (state.waveState === 'rest') {
      state.restTimer -= dt;
      if (state.restTimer <= 0) {
        startWave(state.wave + 1);
        events.wave = true;
      }
    }

    // --- bolts ---
    for (const b of state.bolts) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      if (b.enemy) continue; // Enemy globs are checked against the player below.
      for (const e of state.enemies) {
        if (!e.active) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy < rr * rr) {
          const seized = state.time < e.seizedUntil;
          let damage = b.damage;
          if (seized) damage *= 1.5 + p.breakBonus;
          e.hp -= damage;
          state.damageDealt += Math.round(damage);
          e.hitFlash = 0.12;
          // A bolt shoves what it hits — a little less for the great ones.
          const shove = e.kind === 'grandfather' ? 12 : e.elite ? 30 : 90;
          const bv = Math.hypot(b.vx, b.vy) || 1;
          e.kx += (b.vx / bv) * shove;
          e.ky += (b.vy / bv) * shove;
          spawnParticle(b.x, b.y, '#ffcf5c', 4, 120, 0.3, 3);
          floatText(e.x, e.y - e.radius - 6, String(Math.round(damage)), seized ? '#ffd166' : '#fdf3dc', seized ? 16 : 13);
          events.hit = true;
          if (!b.echo && addRust(e, p.rustPerHit) === 'seize') events.seize = true;
          if (e.hp <= 0) {
            const wasSeized = seized;
            killEnemy(e, true);
            events.kill = true;
            if (wasSeized) events.break = true;
          }
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            b.active = false;
          }
          break;
        }
      }
    }

    // --- enemies ---
    for (const e of state.enemies) {
      if (!e.active) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.wobble += dt * 3;
      // Rust flakes off when no bolt has refreshed it lately.
      if (e.rust > 0) {
        e.rustTimer -= dt;
        if (e.rustTimer <= 0) e.rust = 0;
      }
      const frozen = state.time < e.seizedUntil || stopped;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const rustSlow = 1 - e.rust * RUST.slowPerStack;
      const chimeSlow = chiming ? 1 - CHIME.enemySlow : 1;
      const slow = (state.time < e.slowUntil ? 0.6 : 1) * rustSlow * chimeSlow;
      let vx = frozen ? 0 : (dx / dist) * e.speed * slow;
      let vy = frozen ? 0 : (dy / dist) * e.speed * slow;

      if (!frozen && e.kind === 'bell') {
        // Keep a ringing distance, then lob brass globs.
        const want = 260;
        const dir = dist < want ? -1 : 1;
        vx = (dx / dist) * e.speed * slow * dir * 0.7;
        vy = (dy / dist) * e.speed * slow * dir * 0.7;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 480) {
          e.shootTimer = random.range(1.8, 2.6);
          const g = free(state.bolts);
          if (g) {
            // Enemy globs reuse the bolt pool with a negative flag via damage sign.
            g.active = true;
            g.x = e.x;
            g.y = e.y;
            g.vx = (dx / dist) * 190;
            g.vy = (dy / dist) * 190;
            g.damage = -e.damage;
            g.radius = 8;
            g.pierce = 0;
            g.life = 3;
            g.echo = false;
            g.enemy = true;
          }
        }
      }

      if (!frozen && e.kind === 'pendulum') {
        // Sway, still (telegraphed), then swing at triple speed.
        e.lungeTimer -= dt;
        if (e.lungeState === 'stalk') {
          if (e.lungeTimer <= 0 && dist < 320) {
            e.lungeState = 'crouch';
            e.lungeTimer = 0.45;
            e.lungeDir = { x: dx / dist, y: dy / dist };
          }
        } else if (e.lungeState === 'crouch') {
          vx = 0;
          vy = 0;
          if (e.lungeTimer <= 0) {
            e.lungeState = 'lunge';
            e.lungeTimer = 0.5;
          }
        } else if (e.lungeState === 'lunge') {
          vx = e.lungeDir.x * e.speed * 3.1;
          vy = e.lungeDir.y * e.speed * 3.1;
          if (e.lungeTimer <= 0) {
            e.lungeState = 'stalk';
            e.lungeTimer = random.range(1.6, 3.2);
          }
        }
      }

      if (!frozen && e.kind === 'grandfather') {
        // Phase 2: below half health the Grandfather strikes twelve —
        // faster charges, and a radial burst of brass pins every few seconds.
        if (!state.bossPhase2 && e.hp < e.maxHp * BOSS.phase2At) {
          state.bossPhase2 = true;
          floatText(e.x, e.y - 60, 'THE GRANDFATHER STRIKES TWELVE!', '#ff8a5c', 22);
          state.shake = 14;
          events.boss = true;
        }
        e.moteTimer -= dt;
        if (e.moteTimer <= 0) {
          e.moteTimer = BOSS.spawnMinionsEvery;
          spawnEnemy('mainspring', e.x - 40, e.y);
          spawnEnemy('mainspring', e.x + 40, e.y);
          events.boss = true;
        }
        if (state.bossPhase2) {
          e.burstTimer -= dt;
          if (e.burstTimer <= 0) {
            e.burstTimer = BOSS.burstEvery;
            for (let i = 0; i < BOSS.burstCount; i += 1) {
              const g = free(state.bolts);
              if (!g) break;
              const a = (i / BOSS.burstCount) * TAU + random.range(0, 0.3);
              g.active = true;
              g.x = e.x;
              g.y = e.y;
              g.vx = Math.cos(a) * BOSS.burstSpeed;
              g.vy = Math.sin(a) * BOSS.burstSpeed;
              g.damage = -12;
              g.radius = 8;
              g.pierce = 0;
              g.life = 3.2;
              g.echo = false;
              g.enemy = true;
            }
            events.boss = true;
          }
        }
        e.chargeTimer -= dt;
        const chargeEvery = state.bossPhase2 ? BOSS.chargeEvery * 0.6 : BOSS.chargeEvery;
        if (e.charging > 0) {
          e.charging -= dt;
          vx = e.chargeDir.x * BOSS.chargeSpeed;
          vy = e.chargeDir.y * BOSS.chargeSpeed;
        } else if (e.chargeTimer <= 0) {
          e.chargeTimer = chargeEvery;
          e.charging = BOSS.chargeTime;
          e.chargeDir = { x: dx / dist, y: dy / dist };
          events.boss = true;
        }
      }

      e.x += vx * dt;
      e.y += vy * dt;
      // Knockback bleeds off fast, so a bolt shoves but never throws.
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx *= Math.max(0, 1 - 7 * dt);
      e.ky *= Math.max(0, 1 - 7 * dt);

      // Touch damage (a seized foe cannot bite).
      const rr = e.radius + p.radius - 2;
      if (!frozen && dx * dx + dy * dy < rr * rr) {
        const result = hurtPlayer(e.damage, e.x, e.y);
        if (result & EVENT_OVER) return EVENT_OVER;
        if (result & EVENT_HIT) events.hurt = true;
        // Push the enemy back a little so one touch is one hit.
        e.x -= (dx / dist) * 26;
        e.y -= (dy / dist) * 26;
      }
    }

    // --- enemy globs vs player ---
    for (const b of state.bolts) {
      if (!b.active || !b.enemy) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const rr = p.radius + b.radius;
      if (dx * dx + dy * dy < rr * rr) {
        b.active = false;
        const result = hurtPlayer(-b.damage, b.x - b.vx, b.y - b.vy);
        if (result & EVENT_OVER) return EVENT_OVER;
        if (result & EVENT_HIT) events.hurt = true;
      }
    }

    // --- shards ---
    for (const s of state.shards) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.92;
      s.vy *= 0.92;
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < p.pickupRadius) s.magnet = true;
      if (s.magnet) {
        s.x += (dx / dist) * 420 * dt;
        s.y += (dy / dist) * 420 * dt;
      }
      if (dist < p.radius + 10) {
        s.active = false;
        events.pickup = true;
        if (gainXp(s.value)) return EVENT_LEVEL;
      }
    }

    // --- particles and floating text ---
    for (const pt of state.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy = pt.vy * 0.94 + 55 * dt; // Brass falls: debris drifts down.
    }
    for (const t of state.texts) {
      if (!t.active) continue;
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) t.active = false;
    }

    return 0;
  }

  function aliveCount() {
    let n = 0;
    for (const e of state.enemies) if (e.active) n += 1;
    return n;
  }

  reset();

  return {
    state,
    reset,
    applyUpgrade,
    rerollUpgrades,
    setDifficulty,
    startWave,
    /** Advance one fixed step. `events` is filled with what happened. */
    step,
    aliveCount,
  };
}
