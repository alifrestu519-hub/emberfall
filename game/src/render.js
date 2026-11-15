// Everything the player sees: the clockwork hall, the turning gears, the
// dust in the lamplight, the constructs, the echoes and every screen
// (title, play, level-up, pause, victory, game over). The canvas is scaled
// to the window; all drawing is done in the fixed 1280x720 logical field.
import { COMBO, DIFFICULTY, DIFFICULTY_ORDER, ECHO, ELITE, FIELD, FONT, KIND_FIRST_WAVE, KIND_LABEL, PALETTE, PARADOX, WAVE_KINDS, WAVE_QUOTA, WAVES } from './config.js';
import { UPGRADES } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVEL = 'level';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  function circle(x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /** A gear silhouette: a toothed wheel, drawn with the given rotation. */
  function gear(g, x, y, r, teeth, rot, colour) {
    g.fillStyle = colour;
    g.beginPath();
    for (let i = 0; i < teeth; i += 1) {
      const a0 = rot + (i / teeth) * TAU;
      const a1 = a0 + (TAU / teeth) * 0.5;
      const rOut = r * 1.18;
      const rIn = r * 0.92;
      g.moveTo(x + Math.cos(a0) * rIn, y + Math.sin(a0) * rIn);
      g.lineTo(x + Math.cos(a0) * rOut, y + Math.sin(a0) * rOut);
      g.lineTo(x + Math.cos(a1) * rOut, y + Math.sin(a1) * rOut);
      g.lineTo(x + Math.cos(a1) * rIn, y + Math.sin(a1) * rIn);
    }
    g.fill();
    g.beginPath();
    g.arc(x, y, r * 0.95, 0, TAU);
    g.fill();
    g.fillStyle = PALETTE.backdrop;
    g.beginPath();
    g.arc(x, y, r * 0.32, 0, TAU);
    g.fill();
  }

  // The static half of the hall — backdrop, clock dial, gears at rest —
  // is painted once to an offscreen canvas at boot, so each frame only
  // redraws what moves (turning gears, dust, wells, light). That keeps the
  // frame rate up on weak machines: ~250 draw calls become one blit.
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = FIELD.width;
  bgCanvas.height = FIELD.height;
  function paintStaticBackground() {
    const g = bgCanvas.getContext('2d');
    const grad = g.createRadialGradient(640, 360, 60, 640, 360, 900);
    grad.addColorStop(0, PALETTE.backdrop);
    grad.addColorStop(1, PALETTE.backdropEdge);
    g.fillStyle = grad;
    g.fillRect(0, 0, FIELD.width, FIELD.height);
    // Great gears at rest in the walls, half-seen in the dark.
    gear(g, 80, 90, 70, 10, 0.3, 'rgba(58, 44, 28, 0.9)');
    gear(g, 1200, 110, 90, 12, 0.1, 'rgba(58, 44, 28, 0.9)');
    gear(g, 60, 640, 80, 10, 0.5, 'rgba(58, 44, 28, 0.9)');
    gear(g, 1220, 620, 70, 10, 0.2, 'rgba(58, 44, 28, 0.9)');
    // The floor is a clock dial: a brass ring, hour ticks, four numerals.
    g.fillStyle = PALETTE.ground;
    g.beginPath();
    g.arc(640, 360, 330, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(217, 164, 65, 0.5)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(640, 360, 330, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(217, 164, 65, 0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(640, 360, 300, 0, TAU);
    g.stroke();
    for (let h = 0; h < 12; h += 1) {
      const a = (h / 12) * TAU - Math.PI / 2;
      const big = h % 3 === 0;
      g.strokeStyle = big ? 'rgba(255, 217, 138, 0.6)' : 'rgba(217, 164, 65, 0.4)';
      g.lineWidth = big ? 4 : 2;
      g.beginPath();
      g.moveTo(640 + Math.cos(a) * (big ? 292 : 300), 360 + Math.sin(a) * (big ? 292 : 300));
      g.lineTo(640 + Math.cos(a) * 318, 360 + Math.sin(a) * 318);
      g.stroke();
    }
    g.fillStyle = 'rgba(255, 217, 138, 0.5)';
    g.font = `700 30px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('XII', 640, 110);
    g.fillText('III', 905, 370);
    g.fillText('VI', 640, 640);
    g.fillText('IX', 375, 370);
    // Rivets in the floor plates.
    g.fillStyle = PALETTE.groundDot;
    for (let gx = 340; gx <= 940; gx += 44) {
      for (let gy = 90; gy <= 630; gy += 44) {
        const dx = gx - 640;
        const dy = gy - 360;
        if (dx * dx + dy * dy < 330 * 330) {
          g.beginPath();
          g.arc(gx, gy, 2, 0, TAU);
          g.fill();
        }
      }
    }
  }
  paintStaticBackground();

  // Two great gears that turn with time, behind the fight.
  const TURNING = [
    { x: 180, y: 140, r: 90, teeth: 12, speed: 0.12, colour: 'rgba(90, 68, 38, 0.55)' },
    { x: 1100, y: 580, r: 110, teeth: 14, speed: -0.09, colour: 'rgba(90, 68, 38, 0.5)' },
  ];

  function drawBackground(state) {
    // The static hall, blitted in one call; only the sky moves per frame.
    ctx.drawImage(bgCanvas, 0, 0);
    const t = state.time;

    // The turning gears: slow, heavy, endless.
    for (const tg of TURNING) {
      gear(ctx, tg.x, tg.y, tg.r, tg.teeth, t * tg.speed, tg.colour);
    }

    // Dust motes in the lamplight, drifting down and sideways.
    const chiming = state.chimeState === 'chime';
    const fall = chiming ? 3.2 : 1;
    for (const s of state.stars) {
      const y = (s.y + t * s.speed * 14 * fall) % (FIELD.height + 8);
      const x = (s.x + Math.sin(t * s.speed + s.twinkle) * 8 + FIELD.width) % FIELD.width;
      ctx.globalAlpha = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.speed + s.twinkle));
      circle(x, y - 4, s.r, '#ffe9a8');
    }
    ctx.globalAlpha = 1;

    // Time wells: slow golden ground.
    for (const r of state.wells) {
      if (!r.active) continue;
      const fade = Math.min(1, r.life / 2);
      const rg = ctx.createRadialGradient(r.x, r.y, 4, r.x, r.y, r.radius);
      rg.addColorStop(0, `rgba(255, 209, 102, ${0.28 * fade})`);
      rg.addColorStop(1, 'rgba(255, 209, 102, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 209, 102, ${0.5 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius - 2, 0, TAU);
      ctx.stroke();
      // A turning hand inside the well, marking the slow time.
      ctx.strokeStyle = `rgba(255, 233, 168, ${0.7 * fade})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + Math.cos(t * 0.8) * (r.radius - 10), r.y + Math.sin(t * 0.8) * (r.radius - 10));
      ctx.stroke();
    }

    // The keeper's warm lamplight around the player.
    const p = state.player;
    const light = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 300);
    light.addColorStop(0, 'rgba(255, 217, 138, 0.16)');
    light.addColorStop(0.55, 'rgba(217, 164, 65, 0.06)');
    light.addColorStop(1, 'rgba(217, 164, 65, 0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawShard(s, time) {
    const bob = Math.sin(time * 4 + s.x * 0.05) * 2;
    const blink = 0.75 + 0.25 * Math.sin(time * 6 + s.y * 0.07);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(s.x, s.y + bob);
    ctx.rotate(time * 2 + s.x);
    gear(ctx, 0, 0, 6, 6, 0, PALETTE.shard);
    ctx.restore();
  }

  function drawEnemy(e, time) {
    const flash = e.hitFlash > 0;
    const seized = time < e.seizedUntil;
    const wob = Math.sin(e.wobble) * 2;
    // A soft shadow grounds every construct on the dial.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.radius * 0.85, e.radius * 0.9, e.radius * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(e.x, e.y + wob * 0.4);
    // Spawn-in: a construct winds up out of the dark instead of popping in.
    const born = Math.min(1, (time - (e.spawnTime ?? time)) / 0.25);
    const grow = 0.35 + 0.65 * (1 - (1 - born) * (1 - born));
    // Squash-and-stretch on a hit: the body flinches with the bolt.
    const sq = e.hitFlash > 0 ? e.hitFlash * 2.2 : 0;
    ctx.scale(grow * (1 + sq), grow * (1 - sq * 0.6));
    if (flash) ctx.globalAlpha = 0.85;

    if (e.kind === 'tick') {
      // A tick: a small gear with watchful eyes.
      gear(ctx, 0, 0, e.radius * 0.8, 8, time * 2, flash ? '#ffffff' : e.colour);
      ctx.fillStyle = '#2a1a08';
      circle(-5, -2, 2.5, '#2a1a08');
      circle(5, -2, 2.5, '#2a1a08');
    } else if (e.kind === 'spring') {
      // A spring: a darting coil of brass.
      ctx.strokeStyle = flash ? '#ffffff' : e.colour;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, e.radius - i * 3.5, time * 3 + i, time * 3 + i + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff6e0';
      circle(0, 0, 3.5, '#fff6e0');
    } else if (e.kind === 'cogwheel') {
      // A cogwheel: a heavy gear with a glowing hub.
      gear(ctx, 0, 0, e.radius * 0.85, 10, -time * 0.8, flash ? '#ffffff' : e.colour);
      ctx.fillStyle = '#ffd166';
      circle(0, 0, 5, '#ffd166');
      ctx.fillStyle = '#fff6e0';
      circle(-7, -8, 3, '#fff6e0');
      circle(7, -8, 3, '#fff6e0');
    } else if (e.kind === 'mainspring') {
      // A mainspring: a coiled spring that splits when it breaks.
      ctx.strokeStyle = flash ? '#ffffff' : e.colour;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let a = 0; a < TAU * 2.2; a += 0.3) {
        const r = 3 + (a / (TAU * 2.2)) * (e.radius - 3);
        const x = Math.cos(a + time) * r;
        const y = Math.sin(a + time) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#fff6e0';
      circle(-4, -3, 2, '#fff6e0');
      circle(4, -3, 2, '#fff6e0');
    } else if (e.kind === 'bell') {
      // A bell: a brass bell with a clapper mouth.
      ctx.fillStyle = flash ? '#ffffff' : e.colour;
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.8, e.radius * 0.5);
      ctx.quadraticCurveTo(-e.radius * 0.8, -e.radius * 0.9, 0, -e.radius);
      ctx.quadraticCurveTo(e.radius * 0.8, -e.radius * 0.9, e.radius * 0.8, e.radius * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a1a08';
      ctx.beginPath();
      ctx.arc(0, e.radius * 0.55, e.radius * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      circle(-5, -5, 2.5, '#fff');
      circle(5, -5, 2.5, '#fff');
    } else if (e.kind === 'pendulum') {
      // A pendulum: a brass bob on a rod. It stills before it swings.
      const swing = e.lungeState === 'crouch' ? 0 : Math.sin(e.wobble * 1.4) * 0.35;
      const lunging = e.lungeState === 'lunge' ? 1.25 : 1;
      ctx.rotate(swing);
      ctx.scale(lunging, e.lungeState === 'crouch' ? 0.7 : 1);
      ctx.strokeStyle = flash ? '#ffffff' : '#8a6a35';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius * 1.4);
      ctx.lineTo(0, 0);
      ctx.stroke();
      circle(0, 0, e.radius, flash ? '#ffffff' : e.colour);
      ctx.fillStyle = '#2a1a08';
      circle(-5, -3, 2.5, '#2a1a08');
      circle(5, -3, 2.5, '#2a1a08');
      ctx.fillStyle = e.lungeState === 'crouch' ? '#ff6b81' : '#2a1a08';
      circle(0, 4, 3, e.lungeState === 'crouch' ? '#ff6b81' : '#2a1a08');
    } else if (e.kind === 'golem') {
      // A golem: a great rolling boulder of riveted brass.
      circle(0, 0, e.radius, flash ? '#ffffff' : e.colour);
      ctx.fillStyle = '#7a5c2e';
      circle(-e.radius * 0.4, -e.radius * 0.3, e.radius * 0.2, '#7a5c2e');
      circle(e.radius * 0.35, e.radius * 0.25, e.radius * 0.18, '#7a5c2e');
      circle(0, -e.radius * 0.5, e.radius * 0.14, '#7a5c2e');
      ctx.fillStyle = '#2a1a08';
      circle(-8, -6, 3.5, '#2a1a08');
      circle(8, -6, 3.5, '#2a1a08');
      ctx.strokeStyle = '#2a1a08';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(10, 8);
      ctx.stroke();
    } else if (e.kind === 'grandfather') {
      // The Grandfather: a towering clock case with a burning face.
      const pulse = 1 + 0.04 * Math.sin(time * 3);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = flash ? '#ffffff' : '#3d2410';
      ctx.fillRect(-e.radius * 0.8, -e.radius * 1.2, e.radius * 1.6, e.radius * 2.2);
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 3;
      ctx.strokeRect(-e.radius * 0.8, -e.radius * 1.2, e.radius * 1.6, e.radius * 2.2);
      // The clock face, with hands that turn the wrong way.
      circle(0, -e.radius * 0.6, e.radius * 0.55, '#fdf3dc');
      ctx.strokeStyle = '#2a1a08';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius * 0.6);
      ctx.lineTo(Math.cos(-time * 0.5) * e.radius * 0.3, -e.radius * 0.6 + Math.sin(-time * 0.5) * e.radius * 0.3);
      ctx.moveTo(0, -e.radius * 0.6);
      ctx.lineTo(Math.cos(-time * 0.1 + 2) * e.radius * 0.4, -e.radius * 0.6 + Math.sin(-time * 0.1 + 2) * e.radius * 0.4);
      ctx.stroke();
      // Burning eyes and a swinging pendulum.
      ctx.fillStyle = '#ff8a5c';
      circle(-e.radius * 0.45, e.radius * 0.15, 5, '#ff8a5c');
      circle(e.radius * 0.45, e.radius * 0.15, 5, '#ff8a5c');
      const swing = Math.sin(time * 2.4) * 0.4;
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, e.radius * 0.35);
      ctx.lineTo(Math.sin(swing) * e.radius * 0.5, e.radius * 0.35 + Math.cos(swing) * e.radius * 0.5);
      ctx.stroke();
      circle(Math.sin(swing) * e.radius * 0.5, e.radius * 0.35 + Math.cos(swing) * e.radius * 0.5, 7, '#d9a441');
    }
    // A seized foe wears its rust cage, and rust shows as pips above it.
    if (seized) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#c9712e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#c9712e';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // The elite wears a gold ring and its name, so the threat reads at a glance.
    if (e.elite) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 9, 0, TAU);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `800 13px ${FONT}`;
      ctx.fillStyle = '#ffd166';
      ctx.fillText(ELITE.name, e.x, e.y - e.radius - 36);
    }

    if (e.rust > 0 && !seized && e.kind !== 'grandfather') {
      for (let i = 0; i < e.rust; i += 1) {
        circle(e.x - (e.rust - 1) * 4 + i * 8, e.y - e.radius - 18, 3, '#c9712e');
      }
    }

    // A health bar over anything hurt.
    if (e.hp < e.maxHp && e.kind !== 'grandfather') {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
      ctx.fillStyle = PALETTE.hp;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawEchoFigure(x, y, aim, alpha, time) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    // A ghost of the keeper: the same hooded shape, in pale gold.
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
    glow.addColorStop(0, 'rgba(255, 233, 168, 0.4)');
    glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.quadraticCurveTo(16, -6, 13, 11);
    ctx.quadraticCurveTo(0, 22, -13, 11);
    ctx.quadraticCurveTo(-16, -6, 0, -20);
    ctx.fill();
    ctx.fillStyle = '#2a1a08';
    circle(-3, -5, 1.8, '#2a1a08');
    circle(3, -5, 1.8, '#2a1a08');
    const lx = Math.cos(aim) * 24;
    const ly = Math.sin(aim) * 24;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.fillStyle = '#fff6e0';
    circle(lx, ly, 3, '#fff6e0');
    ctx.restore();
  }

  function drawEcho(echo, time) {
    // Afterimages trail the ghost, so the loop reads as motion through time.
    const pts = echo.points;
    if (pts.length > 2) {
      const span = pts.length * ECHO.sampleEvery;
      for (const back of [0.4, 0.2]) {
        const tt = (echo.t - back + span) % span;
        const idx = Math.floor(tt / ECHO.sampleEvery) % pts.length;
        drawEchoFigure(pts[idx].x, pts[idx].y, echo.aim, 0.16, time);
      }
    }
    drawEchoFigure(echo.x, echo.y, echo.aim, 0.55, time);
    // A thin ring marks the paradox radius, faintly.
    ctx.strokeStyle = 'rgba(255, 233, 168, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(echo.x, echo.y, PARADOX.radius, 0, TAU);
    ctx.stroke();
  }

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invulnerable > 0 && Math.floor(state.time * 14) % 2 === 0;
    // The keeper's own shadow on the dial.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.radius * 0.85, p.radius * 0.95, p.radius * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    if (blink) ctx.globalAlpha = 0.45;

    // A soft warm glow under the keeper.
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    glow.addColorStop(0, 'rgba(255, 217, 138, 0.5)');
    glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, TAU);
    ctx.fill();

    // The keeper: a brass-coated figure, pocket watch held out.
    const bob = p.moving ? Math.sin(p.walkPhase) * 2 : Math.sin(state.time * 2) * 1.5;
    ctx.translate(0, bob);
    ctx.fillStyle = '#6b4d26';
    ctx.beginPath();
    ctx.moveTo(0, -p.radius - 4);
    ctx.quadraticCurveTo(p.radius, -p.radius * 0.4, p.radius * 0.8, p.radius * 0.7);
    ctx.quadraticCurveTo(0, p.radius + 6, -p.radius * 0.8, p.radius * 0.7);
    ctx.quadraticCurveTo(-p.radius, -p.radius * 0.4, 0, -p.radius - 4);
    ctx.fill();
    // Face.
    ctx.fillStyle = PALETTE.playerCore;
    circle(0, -4, 8, PALETTE.playerCore);
    ctx.fillStyle = '#2a1a08';
    circle(-3, -5, 1.8, '#2a1a08');
    circle(3, -5, 1.8, '#2a1a08');
    // A gear on the chest.
    gear(ctx, 0, 6, 5, 6, state.time, '#d9a441');
    // The pocket watch, held out toward the aim.
    const lx = Math.cos(p.aim) * 24;
    const ly = Math.sin(p.aim) * 24;
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    circle(lx, ly, 8, '#fdf3dc');
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 8, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#2a1a08';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + Math.cos(-state.time * 2) * 5, ly + Math.sin(-state.time * 2) * 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      if (!pt.active) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      circle(pt.x, pt.y, pt.size, pt.colour);
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(state) {
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.min(1, t.life / 0.45);
      ctx.font = `700 ${t.size}px ${FONT}`;
      ctx.fillStyle = t.colour;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawBar(x, y, w, h, frac, colour, back) {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawHud(state, screen) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Top-left: health and rewind charges.
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('HEALTH', 24, 30);
    drawBar(24, 38, 220, 14, p.hp / p.maxHp, PALETTE.hp, PALETTE.hpBack);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 252, 50);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('REWIND', 24, 72);
    for (let i = 0; i < p.rewindMax; i += 1) {
      const filled = i < p.rewindCharges;
      circle(36 + i * 26, 84, 9, filled ? '#ffd166' : 'rgba(255, 209, 102, 0.18)');
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(36 + i * 26, 84, 9, 0, TAU);
      ctx.stroke();
      if (filled) {
        ctx.strokeStyle = '#2a1a08';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(36 + i * 26, 84);
        ctx.lineTo(36 + i * 26, 78);
        ctx.moveTo(36 + i * 26, 84);
        ctx.lineTo(36 + i * 26 + 4, 84);
        ctx.stroke();
      }
    }
    if (p.rewindCharges > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.fillText('SPACE — back 3 seconds', 252, 88);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('no charges — level up', 252, 88);
    }

    // Combo meter under the rewind row: the streak and its shrinking window.
    if (state.combo >= 2) {
      ctx.fillStyle = PALETTE.combo;
      ctx.font = `800 18px ${FONT}`;
      ctx.fillText(`COMBO x${state.comboMult}  —  ${state.combo} chained`, 24, 116);
      const comboWindow = COMBO.window + (p.comboBonus ?? 0);
      drawBar(24, 122, 220, 6, state.comboTimer / comboWindow, PALETTE.combo, PALETTE.hpBack);
    }

    // Paradox meter: standing near an echo winds it; full stops time.
    const echoCount = state.echoes.filter((e) => e.active).length;
    if (echoCount > 0) {
      ctx.fillStyle = '#ffe9a8';
      ctx.font = `800 15px ${FONT}`;
      ctx.fillText(`PARADOX  ${Math.floor(state.paradox)}%`, 24, 152);
      drawBar(24, 158, 220, 8, state.paradox / 100, '#ffe9a8', PALETTE.hpBack);
    }

    // Top-centre: wave and timer.
    ctx.textAlign = 'center';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    const waveLabel = state.waveState === 'boss' || (state.wave === WAVES && state.bossSpawned)
      ? 'FINAL WAVE — THE GRANDFATHER'
      : state.waveState === 'rest'
        ? `WAVE ${state.wave} CLEARED`
        : `WAVE ${state.wave} / ${WAVES}`;
    ctx.fillText(waveLabel, 640, 34);
    const quota = WAVE_QUOTA[state.wave - 1];
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    const clock = `${mins}:${String(secs).padStart(2, '0')}`;
    const chimeLabel = state.chimeState === 'chime'
      ? '   ·   THE CHIME STRIKES!'
      : state.chimeState === 'warn'
        ? '   ·   the chime comes…'
        : '';
    const echoLabel = echoCount > 0 ? `   ·   ${echoCount} echo${echoCount > 1 ? 'es' : ''} beside you` : '';
    ctx.fillText(`Felled ${state.waveKills} / ${quota}   ·   ${clock}${chimeLabel}${echoLabel}`, 640, 56);

    // Top-right: score, level, kills.
    ctx.textAlign = 'right';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${state.score}`, 1256, 34);
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`LEVEL ${state.level}   ·   ${state.kills} felled`, 1256, 56);

    // Bottom: XP bar.
    drawBar(24, 692, 1232, 10, state.xp / state.xpNext, PALETTE.xp, PALETTE.hpBack);
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'left';
    ctx.fillText(`COGS ${state.xp} / ${state.xpNext} — level ${state.level}   ·   best combo ${state.comboBest}   ·   ${state.brokenKills} broken`, 24, 686);

    // Boss bar.
    if (state.boss && state.boss.active) {
      ctx.textAlign = 'center';
      ctx.font = `800 15px ${FONT}`;
      ctx.fillStyle = '#ffb08a';
      ctx.fillText(state.bossPhase2 ? 'THE GRANDFATHER — STRIKING TWELVE' : 'THE GRANDFATHER', 640, 92);
      drawBar(440, 100, 400, 12, state.boss.hp / state.boss.maxHp, '#ff8a5c', '#2a1020');
    }

    // Wave-rest banner: the next wave's roster, with NEW tags on first-timers.
    if (state.waveState === 'rest' && screen === SCREEN_PLAY) {
      ctx.textAlign = 'center';
      ctx.font = `800 30px ${FONT}`;
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(`WAVE ${state.wave + 1} IN ${Math.ceil(state.restTimer)}…`, 640, 200);
      const next = state.wave + 1;
      const kinds = WAVE_KINDS[next] ?? [];
      const roster = kinds.map((k) => (KIND_FIRST_WAVE[k] === next ? `${KIND_LABEL[k]} NEW` : KIND_LABEL[k])).join('   ·   ');
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(roster, 640, 232);
      if (next === ELITE.wave) {
        ctx.font = `800 16px ${FONT}`;
        ctx.fillStyle = '#ffd166';
        ctx.fillText(`★ ${ELITE.name} stalks this wave ★`, 640, 260);
      }
    }

    // The build, at a glance: every boon taken, with its stack count.
    const owned = UPGRADES.filter((u) => (state.taken[u.id] ?? 0) > 0);
    if (owned.length > 0) {
      let bx = 24;
      const by = 606;
      ctx.textAlign = 'left';
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('BOONS', 24, by - 6);
      for (const u of owned) {
        ctx.fillStyle = 'rgba(42, 30, 16, 0.85)';
        ctx.fillRect(bx, by, 30, 30);
        ctx.strokeStyle = PALETTE.cardEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, 29, 29);
        ctx.fillStyle = '#ffe9a8';
        ctx.font = `400 18px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(u.icon, bx + 15, by + 22);
        const count = state.taken[u.id];
        if (count > 1) {
          ctx.fillStyle = PALETTE.combo;
          ctx.font = `800 11px ${FONT}`;
          ctx.fillText(`x${count}`, bx + 24, by + 11);
        }
        bx += 36;
      }
    }

    // Mute hint, on a dark chip so a pale foe cannot wash it out.
    ctx.fillStyle = 'rgba(5, 10, 18, 0.55)';
    ctx.fillRect(1076, 662, 180, 22);
    ctx.textAlign = 'right';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = 'rgba(179, 155, 120, 0.9)';
    ctx.fillText('P pause · M mute · R restart', 1256, 677);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  /** Difficulty boxes on the title screen; main.js mirrors this layout for clicks. */
  const DIFF_BOX = { y: 262, w: 240, h: 80, gap: 20 };

  function drawTitle(state, ui) {
    const difficulty = ui.difficulty ?? 'normal';
    const bests = ui.bests ?? {};
    ctx.fillStyle = 'rgba(10, 6, 2, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `800 84px ${FONT}`;
    ctx.fillText('ECHOLOOP', 640, 140);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText('— Fight Beside Your Past Selves —', 640, 180);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 18px ${FONT}`;
    ctx.fillText('The Grandfather is winding the clock down. Survive six waves and stop him.', 640, 212);

    // Three windings to choose from, each with its own best score.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText('CHOOSE YOUR WINDING — press 1, 2 or 3, or click', 640, 248);
    const total = DIFFICULTY_ORDER.length * DIFF_BOX.w + (DIFFICULTY_ORDER.length - 1) * DIFF_BOX.gap;
    let dx = 640 - total / 2;
    DIFFICULTY_ORDER.forEach((key, i) => {
      const d = DIFFICULTY[key];
      const selected = key === difficulty;
      ctx.fillStyle = selected ? 'rgba(90, 62, 28, 0.95)' : 'rgba(30, 20, 10, 0.88)';
      ctx.fillRect(dx, DIFF_BOX.y, DIFF_BOX.w, DIFF_BOX.h);
      ctx.strokeStyle = selected ? '#ffd166' : PALETTE.panelEdge;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.strokeRect(dx + 1, DIFF_BOX.y + 1, DIFF_BOX.w - 2, DIFF_BOX.h - 2);
      ctx.fillStyle = selected ? '#ffd166' : PALETTE.text;
      ctx.font = `800 20px ${FONT}`;
      ctx.fillText(`[${i + 1}]  ${d.label}`, dx + DIFF_BOX.w / 2, DIFF_BOX.y + 30);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `400 13px ${FONT}`;
      ctx.fillText(d.hint, dx + DIFF_BOX.w / 2, DIFF_BOX.y + 52);
      const b = bests[key] ?? 0;
      ctx.fillStyle = PALETTE.combo;
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText(b > 0 ? `Best ${b}` : 'No run yet', dx + DIFF_BOX.w / 2, DIFF_BOX.y + 70);
      dx += DIFF_BOX.w + DIFF_BOX.gap;
    });

    panel(390, 368, 500, 120);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('WASD / Arrows — move        Mouse — aim the burst', 640, 404);
    ctx.fillText('Gear bolts fire on their own        Space — rewind 3 seconds', 640, 434);
    ctx.fillText('Cleared waves leave echoes — stand near them to stop time', 640, 464);

    ctx.fillStyle = '#ffe9a8';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText('Press SPACE or CLICK to begin', 640, 540);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('6 waves · 7 foes + an elite · a two-phase boss · 12 boons · echoes · time stop', 640, 570);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(`Seed ${ui.seed ?? 0} — the same seed replays the same clock (?seed=N)`, 640, 600);
  }

  function drawLevelUp(state) {
    const choices = state.levelChoices ?? [];
    ctx.fillStyle = 'rgba(10, 6, 2, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.xp;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('LEVEL UP — CHOOSE A BOON', 640, 150);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 17px ${FONT}`;
    ctx.fillText('Click a card, or press 1, 2 or 3.', 640, 184);

    const w = 280;
    const h = 240;
    const gap = 32;
    const total = choices.length * w + (choices.length - 1) * gap;
    let x = 640 - total / 2;
    const y = 240;
    choices.forEach((u, i) => {
      ctx.fillStyle = PALETTE.card;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = PALETTE.cardEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = `400 54px ${FONT}`;
      ctx.fillText(u.icon, x + w / 2, y + 82);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 21px ${FONT}`;
      ctx.fillText(u.name, x + w / 2, y + 128);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `400 15px ${FONT}`;
      wrapText(u.text, x + 18, y + 158, w - 36, 20);
      ctx.fillStyle = PALETTE.cardEdge;
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(`[${i + 1}]`, x + w / 2, y + h - 20);
      x += w + gap;
    });

    // One free re-deal per level-up: a second chance at the right boon.
    const rerolls = state.rerollsLeft ?? 0;
    ctx.fillStyle = rerolls > 0 ? 'rgba(90, 62, 28, 0.95)' : 'rgba(30, 20, 10, 0.6)';
    ctx.fillRect(530, 500, 220, 36);
    ctx.strokeStyle = rerolls > 0 ? '#ffd166' : PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(531, 501, 218, 34);
    ctx.fillStyle = rerolls > 0 ? '#ffd166' : PALETTE.muted;
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(rerolls > 0 ? 'F — REROLL THE BOONS' : 'REROLL SPENT', 640, 524);
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x + maxWidth / 2, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x + maxWidth / 2, yy);
  }

  function drawPaused(state) {
    ctx.fillStyle = 'rgba(10, 6, 2, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText('PAUSED', 640, 250);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 18px ${FONT}`;
    ctx.fillText('P or Space to keep playing — R to start over', 640, 292);
    // The run's build, so a pause is also a moment to take stock.
    const owned = UPGRADES.filter((u) => (state.taken[u.id] ?? 0) > 0);
    if (owned.length > 0) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 18px ${FONT}`;
      ctx.fillText('BOONS TAKEN', 640, 350);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `400 16px ${FONT}`;
      const line = owned.map((u) => `${u.icon} ${u.name}${(state.taken[u.id] ?? 0) > 1 ? ` x${state.taken[u.id]}` : ''}`).join('    ');
      ctx.fillText(line, 640, 380);
    }
  }

  function drawEnd(state, ui, victory) {
    const best = ui.best ?? 0;
    ctx.fillStyle = victory ? 'rgba(30, 20, 10, 0.55)' : 'rgba(26, 10, 12, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    if (victory) {
      ctx.fillStyle = '#ffe9a8';
      ctx.font = `800 64px ${FONT}`;
      ctx.fillText('THE CLOCK STOPS', 640, 150);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 24px ${FONT}`;
      ctx.fillText('The Grandfather is still. Every echo can rest now.', 640, 192);
    } else {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `800 64px ${FONT}`;
      ctx.fillText('THE CLOCK WINDS YOU DOWN', 640, 150);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 24px ${FONT}`;
      ctx.fillText('The gears grind on… this time. The loop will bring you back.', 640, 192);
    }
    // Stars: a win with a healthy keeper earns all three.
    const stars = victory ? (state.player.hp >= state.player.maxHp * 0.6 ? 3 : 2) : state.wave >= 5 ? 1 : 0;
    ctx.font = `400 44px ${FONT}`;
    ctx.fillStyle = '#ffd166';
    ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), 640, 248);

    panel(340, 280, 600, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score}`, 640, 332);
    if (ui.newBest && state.score > 0) {
      ctx.fillStyle = '#7dffb0';
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText('★ NEW BEST ★', 640, 358);
    }
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    const clock = `${mins}:${String(secs).padStart(2, '0')}`;
    const wavesCleared = victory ? WAVES : state.wave - 1;
    const echoCount = state.echoes.filter((e) => e.active).length;
    const stats = [
      [`Waves cleared`, `${wavesCleared} / ${WAVES}`],
      [`Foes felled`, `${state.kills}`],
      [`Time survived`, clock],
      [`Level reached`, `${state.level}`],
      [`Best combo`, `x${state.comboBest}`],
      [`Foes broken`, `${state.brokenKills}`],
      [`Damage dealt`, `${state.damageDealt}`],
      [`Echoes raised`, `${echoCount}`],
    ];
    ctx.font = `600 16px ${FONT}`;
    stats.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? 380 : 700;
      const y = 392 + row * 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(label, x, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(value, x + 220, y);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(`Best ${best}  ·  Seed ${ui.seed ?? 0}  ·  ${DIFFICULTY[state.difficulty]?.label ?? ''}`, 640, 548);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('SPACE — new clock      S — same seed again', 640, 592);
  }

  function draw(state, screen, ui) {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * ox, DPR * oy);

    // Screen shake, from the world's own shake value. Deterministic: a
    // fast wobble off the clock, so the same moment always paints the same
    // frame (screenshots stay reproducible).
    if (state.shake > 0) {
      const s = state.shake;
      ctx.translate(Math.sin(state.time * 91) * s * 0.5, Math.cos(state.time * 113) * s * 0.5);
    }

    drawBackground(state);
    for (const s of state.shards) if (s.active) drawShard(s, state.time);
    for (const b of state.bolts) {
      if (!b.active) continue;
      if (b.enemy) {
        circle(b.x, b.y, b.radius + 3, 'rgba(217, 164, 65, 0.35)');
        circle(b.x, b.y, b.radius, '#d9a441');
      } else if (b.echo) {
        circle(b.x, b.y, b.radius + 2, 'rgba(255, 233, 168, 0.35)');
        circle(b.x, b.y, b.radius, '#ffe9a8');
      } else {
        circle(b.x, b.y, b.radius + 3, 'rgba(255, 207, 92, 0.35)');
        circle(b.x, b.y, b.radius, '#ffcf5c');
        circle(b.x, b.y, 2, '#ffffff');
      }
    }
    for (const e of state.enemies) if (e.active) drawEnemy(e, state.time);
    for (const echo of state.echoes) if (echo.active) drawEcho(echo, state.time);
    drawPlayer(state);
    drawParticles(state);
    // Floating combat text is part of play, not of the end screens: the
    // victory and game-over panels carry their own words.
    if (screen !== SCREEN_VICTORY && screen !== SCREEN_OVER) drawTexts(state);

    // A red flash when the keeper is hurt.
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 107, 129, ${state.flash * 0.45})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    // The Great Chime bends the light: golden streaks and a warm vignette.
    if (state.chimeState === 'chime') {
      const vg = ctx.createRadialGradient(640, 360, 200, 640, 360, 700);
      vg.addColorStop(0, 'rgba(255, 233, 168, 0)');
      vg.addColorStop(1, 'rgba(255, 233, 168, 0.22)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.strokeStyle = 'rgba(255, 233, 168, 0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 40; i += 1) {
        const sx = ((i * 173 + state.time * 900) % (FIELD.width + 120)) - 60;
        const sy = (i * 97 + state.time * 240) % (FIELD.height + 40);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 26, sy + 12);
        ctx.stroke();
      }
    }

    // Time Stop: the world holds its breath in gold.
    if (state.timeStop > 0) {
      const vg = ctx.createRadialGradient(640, 360, 200, 640, 360, 700);
      vg.addColorStop(0, 'rgba(255, 233, 168, 0.08)');
      vg.addColorStop(1, 'rgba(255, 233, 168, 0.3)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.textAlign = 'center';
      ctx.font = `800 34px ${FONT}`;
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText('TIME STOP', 640, 120);
    }

    if (screen === SCREEN_TITLE) drawTitle(state, ui);
    if (screen === SCREEN_PLAY || screen === SCREEN_LEVEL || screen === SCREEN_PAUSED) drawHud(state, screen);
    if (screen === SCREEN_LEVEL) drawLevelUp(state);
    if (screen === SCREEN_PAUSED) drawPaused(state);
    if (screen === SCREEN_VICTORY) drawEnd(state, ui, true);
    if (screen === SCREEN_OVER) drawEnd(state, ui, false);
  }

  return { draw };
}
