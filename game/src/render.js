// Everything the player sees: the clearing, the Heartwood, the growths,
// the Blight and every screen (title, play, draft, pause, victory,
// defeat). The canvas is scaled to the window; all drawing is done in
// the fixed 1280x720 logical field.
import {
  BUILD_BAR_Y, DIFFICULTY, DIFFICULTY_ORDER, ENEMIES, FIELD, FONT, GROWTHS,
  GROWTH_ORDER, HUD_HEIGHT, PALETTE, SEASONS, TOTAL_WAVES, TREE,
} from './config.js';
import { createRandom } from './random.js';
import { PLOT_RADIUS } from './paths.js';
import { costNow, enemiesRemaining } from './world.js';
import { sellValue, towerStats, upgradeCost } from './towers.js';
import { SEASON_TINTS } from './seasons.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_DEFEAT = 'defeat';

const TAU = Math.PI * 2;

/**
 * Every clickable rectangle, in logical coordinates. main.js hit-tests
 * against these, so this table is the single source of layout truth.
 */
export const LAYOUT = {
  cardW: 204, cardH: 80, cardGap: 8, cardX0: 8, cardY: 634,
  startWave: { x: 982, y: 10, w: 160, h: 44 },
  speedBtn: { x: 1150, y: 10, w: 36, h: 44 },
  pauseBtn: { x: 1190, y: 10, w: 36, h: 44 },
  muteBtn: { x: 1230, y: 10, w: 36, h: 44 },
  towerPanel: { x: 16, y: 508, w: 308, h: 112 },
  towerUpgrade: { x: 28, y: 578, w: 150, h: 32 },
  towerSell: { x: 188, y: 578, w: 108, h: 32 },
  towerClose: { x: 296, y: 516, w: 20, h: 20 },
  draftCardW: 280, draftCardH: 300, draftCardGap: 32, draftCardY: 186, draftCardX0: 188,
  rerollBtn: { x: 540, y: 516, w: 200, h: 40 },
  diffW: 240, diffH: 84, diffGap: 24, diffY: 494, diffX0: 256,
  titleStart: { x: 490, y: 596, w: 300, h: 56 },
  endRestart: { x: 340, y: 566, w: 180, h: 48 },
  endSameSeed: { x: 540, y: 566, w: 200, h: 48 },
  endTitle: { x: 760, y: 566, w: 180, h: 48 },
  pauseResume: { x: 540, y: 318, w: 200, h: 44 },
  pauseRestart: { x: 540, y: 374, w: 200, h: 44 },
  pauseMute: { x: 540, y: 430, w: 200, h: 44 },
  pauseTitle: { x: 540, y: 486, w: 200, h: 44 },
};

function inRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let decorSeed = -1;
  let decor = null;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(w * DPR));
    canvas.height = Math.max(1, Math.floor(h * DPR));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Grass tufts, flowers and stones, fixed per seed so the grove is stable. */
  function buildDecor(seed) {
    const rng = createRandom(seed ^ 0x5eed);
    const items = [];
    for (let i = 0; i < 90; i += 1) {
      items.push({
        x: rng.range(16, FIELD.width - 16),
        y: rng.range(HUD_HEIGHT + 14, BUILD_BAR_Y - 10),
        kind: rng.pick(['tuft', 'tuft', 'tuft', 'flower', 'stone', 'mushroom']),
        size: rng.range(0.7, 1.4),
        rot: rng.range(0, TAU),
      });
    }
    return items;
  }

  function circle(x, y, r, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function ellipse(x, y, rx, ry, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function panel(x, y, w, h, fill = PALETTE.panel, edge = PALETTE.panelEdge) {
    ctx.fillStyle = fill;
    roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function text(str, x, y, size, colour, align = 'left', weight = 700) {
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function textOutline(str, x, y, size, colour, align = 'left', weight = 800) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 8);
    ctx.strokeStyle = 'rgba(10, 16, 6, 0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = colour;
    ctx.fillText(str, x, y);
  }

  function drawGround(state) {
    const tint = SEASON_TINTS[state.seasonIndex];
    ctx.fillStyle = tint.ground;
    ctx.fillRect(0, HUD_HEIGHT, FIELD.width, BUILD_BAR_Y - HUD_HEIGHT);
    // Soft mowing stripes across the clearing.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let y = HUD_HEIGHT; y < BUILD_BAR_Y; y += 56) {
      ctx.fillRect(0, y, FIELD.width, 28);
    }
    ctx.fillStyle = tint.sky;
    ctx.fillRect(0, HUD_HEIGHT, FIELD.width, BUILD_BAR_Y - HUD_HEIGHT);
    // The forest edge: dark treetops hemming the clearing in.
    ctx.fillStyle = '#16240e';
    for (let x = 0; x < FIELD.width; x += 46) {
      circle(x + 20, HUD_HEIGHT + 2, 26, '#16240e');
      circle(x + 8, BUILD_BAR_Y - 2, 26, '#16240e');
    }
    for (let y = HUD_HEIGHT; y < BUILD_BAR_Y; y += 46) {
      circle(2, y + 20, 26, '#16240e');
      circle(FIELD.width - 2, y + 8, 26, '#16240e');
    }
    if (decorSeed !== state.seed) {
      decorSeed = state.seed;
      decor = buildDecor(state.seed);
    }
    for (const d of decor) {
      if (d.kind === 'tuft') {
        ctx.strokeStyle = 'rgba(126, 200, 80, 0.5)';
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(d.x + i * 3, d.y);
          ctx.lineTo(d.x + i * 5, d.y - 7 * d.size);
          ctx.stroke();
        }
      } else if (d.kind === 'flower') {
        circle(d.x, d.y, 3.5 * d.size, '#e8a8d8');
        circle(d.x, d.y, 1.5 * d.size, '#ffd166');
      } else if (d.kind === 'stone') {
        ellipse(d.x, d.y, 5 * d.size, 3.5 * d.size, 'rgba(120, 120, 110, 0.6)');
      } else if (d.kind === 'mushroom') {
        circle(d.x, d.y - 2, 4 * d.size, '#c96a5a');
        ctx.fillStyle = '#e8dcc8';
        ctx.fillRect(d.x - 1.5, d.y - 1, 3, 4);
      }
    }
  }

  function drawPaths(state) {
    for (const path of state.paths) {
      const pts = path.points;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = PALETTE.pathEdge;
      ctx.lineWidth = 40;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.path;
      ctx.lineWidth = 32;
      ctx.stroke();
      // Marching chevrons show the Blight's direction of travel.
      const total = path.total;
      const offset = (state.time * 26) % 44;
      ctx.fillStyle = 'rgba(255, 220, 160, 0.55)';
      for (let d = offset; d < total - 30; d += 44) {
        let i = 1;
        while (i < path.lengths.length - 1 && path.lengths[i] < d) i += 1;
        const seg = path.lengths[i] - path.lengths[i - 1] || 1;
        const t = (d - path.lengths[i - 1]) / seg;
        const a = pts[i - 1];
        const b = pts[i];
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-4, -6);
        ctx.lineTo(-4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawPlots(state, ui) {
    const showAll = ui.selectedGrowth !== null;
    for (const plot of state.plots) {
      if (plot.tower) continue;
      ellipse(plot.x, plot.y + 4, PLOT_RADIUS + 2, PLOT_RADIUS * 0.62, 'rgba(0, 0, 0, 0.25)');
      ellipse(plot.x, plot.y, PLOT_RADIUS, PLOT_RADIUS * 0.78, PALETTE.soil);
      ellipse(plot.x, plot.y - 3, PLOT_RADIUS - 6, PLOT_RADIUS * 0.6, PALETTE.soilDark);
      const hovered = ui.mouse && Math.hypot(ui.mouse.x - plot.x, ui.mouse.y - plot.y) < PLOT_RADIUS + 6;
      if (showAll || hovered) {
        ctx.strokeStyle = hovered ? '#ffd166' : 'rgba(255, 209, 102, 0.35)';
        ctx.lineWidth = hovered ? 2.5 : 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.ellipse(plot.x, plot.y, PLOT_RADIUS + 3, (PLOT_RADIUS + 3) * 0.78, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Range preview: where the chosen growth would reach from this plot.
    if (ui.selectedGrowth && ui.mouse) {
      const plot = state.plots.find((p) => !p.tower && Math.hypot(ui.mouse.x - p.x, ui.mouse.y - p.y) < PLOT_RADIUS + 8);
      if (plot) {
        const stats = towerStats(ui.selectedGrowth, 1);
        const range = stats.range * (1 + (state.buffs.rangeBonus || 0));
        if (range > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(plot.x, plot.y, range, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.globalAlpha = 0.75;
        drawTowerIcon(plot.x, plot.y - 8, ui.selectedGrowth, 1, state.time);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** The Heartwood: trunk, spreading branches, and a glowing amber heart. */
  function drawTree(state, cx, cy, scale) {
    const sway = Math.sin(state.time * 0.7) * 2;
    const hpShare = state.treeHp / state.treeMaxHp;
    // Roots.
    ctx.strokeStyle = PALETTE.treeBark;
    ctx.lineWidth = 7 * scale;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU + 0.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 18 * scale, cy + 26 * scale);
      ctx.quadraticCurveTo(
        cx + Math.cos(a) * 42 * scale, cy + 34 * scale,
        cx + Math.cos(a) * 58 * scale, cy + 26 * scale + Math.sin(a) * 6,
      );
      ctx.stroke();
    }
    // Trunk.
    ctx.fillStyle = PALETTE.treeTrunk;
    ctx.beginPath();
    ctx.moveTo(cx - 20 * scale, cy + 34 * scale);
    ctx.quadraticCurveTo(cx - 26 * scale, cy - 20 * scale, cx - 14 * scale, cy - 52 * scale);
    ctx.lineTo(cx + 14 * scale, cy - 52 * scale);
    ctx.quadraticCurveTo(cx + 26 * scale, cy - 20 * scale, cx + 20 * scale, cy + 34 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.treeBark;
    ctx.beginPath();
    ctx.moveTo(cx - 20 * scale, cy + 34 * scale);
    ctx.quadraticCurveTo(cx - 12 * scale, cy, cx - 14 * scale, cy - 52 * scale);
    ctx.lineTo(cx - 6 * scale, cy - 52 * scale);
    ctx.quadraticCurveTo(cx - 4 * scale, cy, cx - 10 * scale, cy + 34 * scale);
    ctx.closePath();
    ctx.fill();
    // Branches.
    ctx.strokeStyle = PALETTE.treeTrunk;
    ctx.lineWidth = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 48 * scale);
    ctx.quadraticCurveTo(cx - 34 * scale, cy - 78 * scale, cx - 52 * scale + sway, cy - 96 * scale);
    ctx.moveTo(cx, cy - 48 * scale);
    ctx.quadraticCurveTo(cx + 34 * scale, cy - 78 * scale, cx + 52 * scale + sway, cy - 96 * scale);
    ctx.moveTo(cx, cy - 48 * scale);
    ctx.lineTo(cx + sway * 0.5, cy - 108 * scale);
    ctx.stroke();
    // Canopy: layered crowns that spread as the grove grows.
    const canopy = [
      [0, -104, 62], [-44, -84, 46], [44, -84, 46],
      [-24, -122, 42], [24, -122, 42], [0, -132, 40],
    ];
    for (const [ox, oy, r] of canopy) {
      circle(cx + ox * scale + sway * 0.4, cy + oy * scale, r * scale, PALETTE.leafDark);
    }
    for (const [ox, oy, r] of canopy) {
      circle(cx + ox * scale + sway * 0.4 - 4, cy + oy * scale - 5, r * scale * 0.82, PALETTE.leaf);
    }
    circle(cx - 16 * scale, cy - 118 * scale, 20 * scale, PALETTE.leafLight);
    circle(cx + 20 * scale, cy - 100 * scale, 16 * scale, PALETTE.leafLight);
    // The amber heart, pulsing; it dims as the tree is wounded.
    const pulse = 1 + Math.sin(state.time * 2.4) * 0.08;
    const heartGlow = 0.35 + hpShare * 0.65;
    ctx.globalAlpha = heartGlow;
    circle(cx, cy - 18 * scale, 15 * scale * pulse, PALETTE.heart);
    circle(cx, cy - 18 * scale, 8 * scale * pulse, '#fff3c8');
    ctx.globalAlpha = 1;
    if (state.treeFlash > 0) {
      ctx.globalAlpha = Math.min(1, state.treeFlash * 4);
      circle(cx, cy - 18 * scale, 20 * scale, '#ff6a4a');
      ctx.globalAlpha = 1;
    }
    // Cracks when the Heartwood is hurt.
    if (hpShare < 0.5) {
      ctx.strokeStyle = 'rgba(20, 10, 4, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 10 * scale, cy + 30 * scale);
      ctx.lineTo(cx - 4 * scale, cy + 8 * scale);
      ctx.lineTo(cx - 12 * scale, cy - 10 * scale);
      ctx.stroke();
    }
  }

  /** A growth's portrait, drawn small for cards and the build bar. */
  function drawTowerIcon(x, y, kind, tier, time) {
    const c = GROWTHS[kind];
    const s = 1 + (tier - 1) * 0.12;
    if (kind === 'thorn') {
      circle(x, y, 13 * s, c.dark);
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * TAU - Math.PI / 2;
        ctx.fillStyle = c.colour;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s);
        ctx.lineTo(x + Math.cos(a + 0.25) * 5 * s, y + Math.sin(a + 0.25) * 5 * s);
        ctx.lineTo(x + Math.cos(a - 0.25) * 5 * s, y + Math.sin(a - 0.25) * 5 * s);
        ctx.closePath();
        ctx.fill();
      }
      circle(x, y, 6 * s, '#e8ffd8');
    } else if (kind === 'sprayer') {
      circle(x, y, 12 * s, c.dark);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        ellipse(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s, 6 * s, 3.5 * s, c.colour);
      }
      circle(x, y, 5 * s, '#8a5a10');
    } else if (kind === 'spore') {
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(x - 3 * s, y - 2, 6 * s, 10 * s);
      ctx.fillStyle = c.colour;
      ctx.beginPath();
      ctx.arc(x, y - 2, 12 * s, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      circle(x - 5 * s, y - 6 * s, 2.5 * s, '#e8d8ff');
      circle(x + 4 * s, y - 9 * s, 2 * s, '#e8d8ff');
    } else if (kind === 'wall') {
      ctx.fillStyle = c.dark;
      roundRect(x - 13 * s, y - 12 * s, 26 * s, 22 * s, 5);
      ctx.fill();
      ctx.strokeStyle = c.colour;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 10 * s, y + 6 * s);
      ctx.quadraticCurveTo(x, y - 14 * s, x + 10 * s, y + 6 * s);
      ctx.moveTo(x, y + 8 * s);
      ctx.lineTo(x, y - 10 * s);
      ctx.stroke();
    } else if (kind === 'sunbloom') {
      const rot = time * 0.4;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + rot;
        ellipse(x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s, 7 * s, 3.5 * s, c.colour);
      }
      circle(x, y, 6.5 * s, '#8a5a10');
      circle(x, y, 3 * s, '#5d3a08');
    } else if (kind === 'mine') {
      circle(x, y, 11 * s, c.dark);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + 0.4;
        ctx.fillStyle = c.colour;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 13 * s, y + Math.sin(a) * 13 * s);
        ctx.lineTo(x + Math.cos(a + 0.3) * 6 * s, y + Math.sin(a + 0.3) * 6 * s);
        ctx.lineTo(x + Math.cos(a - 0.3) * 6 * s, y + Math.sin(a - 0.3) * 6 * s);
        ctx.closePath();
        ctx.fill();
      }
      circle(x, y, 4 * s, '#ffd166');
    }
  }

  function drawTowers(state, ui) {
    // A selected tower shows its reach.
    const selected = ui.selectedTower;
    if (selected && selected.alive && selected.range > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, selected.range, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    for (const tower of state.towers) {
      if (!tower.alive) continue;
      const kind = GROWTHS[tower.kind];
      // Spore clouds show their poisoned ground.
      if (tower.kind === 'spore') {
        ctx.fillStyle = 'rgba(176, 127, 232, 0.09)';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.range, 0, TAU);
        ctx.fill();
      }
      if (tower.kind === 'wall') {
        // Roots reach from the mound to the path it blocks.
        ctx.strokeStyle = 'rgba(160, 122, 74, 0.8)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(tower.x, tower.y);
        ctx.lineTo(tower.blockX, tower.blockY);
        ctx.stroke();
        circle(tower.blockX, tower.blockY, 16, 'rgba(160, 122, 74, 0.35)');
      }
      ellipse(tower.x, tower.y + 10, 24, 10, 'rgba(0, 0, 0, 0.3)');
      ellipse(tower.x, tower.y + 6, PLOT_RADIUS, PLOT_RADIUS * 0.78, PALETTE.soil);
      const bob = tower.kind === 'sunbloom' ? Math.sin(tower.sway * 2) * 1.5 : 0;
      drawTowerIcon(tower.x, tower.y - 6 + bob, tower.kind, tower.tier, state.time);
      if (tower.tier >= 3) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y - 6, 19, 0, TAU);
        ctx.stroke();
      }
      if (tower.flash > 0) {
        ctx.globalAlpha = Math.min(1, tower.flash * 6);
        circle(tower.x, tower.y - 6, 16, '#ff6a4a');
        ctx.globalAlpha = 1;
      }
      // Tier pips and a health bar when wounded.
      for (let i = 0; i < tower.tier; i += 1) {
        circle(tower.x - 8 + i * 8, tower.y + 16, 2.5, i < tower.tier ? '#ffd166' : '#5a5a4a');
      }
      if (tower.hp < tower.maxHp) {
        const w = 36;
        const share = tower.hp / tower.maxHp;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(tower.x - w / 2, tower.y + 22, w, 5);
        ctx.fillStyle = share > 0.4 ? '#8fd45e' : '#e86a4a';
        ctx.fillRect(tower.x - w / 2, tower.y + 22, w * share, 5);
      }
      if (selected && selected.id === tower.id) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(tower.x, tower.y + 6, PLOT_RADIUS + 4, (PLOT_RADIUS + 4) * 0.78, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawEnemies(state) {
    const sorted = [...state.enemies].sort((a, b) => a.y - b.y);
    for (const enemy of sorted) {
      if (!enemy.alive) continue;
      const def = ENEMIES[enemy.kind];
      const scale = enemy.spawnScale * (enemy.boss ? 1 : 1);
      const floatY = enemy.flying ? -16 + Math.sin(state.time * 3 + enemy.id) * 3 : 0;
      const x = enemy.x;
      const y = enemy.y + floatY;
      const r = enemy.radius * scale;
      if (enemy.flying) {
        ellipse(enemy.x, enemy.y + 6, r * 0.9, r * 0.35, 'rgba(0, 0, 0, 0.3)');
      } else {
        ellipse(enemy.x, enemy.y + r * 0.7, r * 0.95, r * 0.35, 'rgba(0, 0, 0, 0.3)');
      }
      // Body.
      if (enemy.kind === 'wisp') {
        ctx.globalAlpha = 0.35;
        circle(x, y, r + 8, def.colour);
        ctx.globalAlpha = 1;
        circle(x, y, r, def.colour);
        circle(x - r * 0.3, y - r * 0.3, r * 0.45, '#e8fbff');
      } else if (enemy.kind === 'stag') {
        // The Hollow Stag: a pale great beast with branching antlers.
        ellipse(x, y, r * 1.15, r * 0.85, def.colour);
        circle(x + r * 0.9, y - r * 0.5, r * 0.5, def.colour);
        ctx.strokeStyle = '#e8e8f8';
        ctx.lineWidth = 4;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + r * 0.9 + side * 6, y - r * 0.9);
          ctx.lineTo(x + r * 0.9 + side * 16, y - r * 1.5);
          ctx.lineTo(x + r * 0.9 + side * 10, y - r * 1.3);
          ctx.moveTo(x + r * 0.9 + side * 16, y - r * 1.5);
          ctx.lineTo(x + r * 0.9 + side * 26, y - r * 1.35);
          ctx.stroke();
        }
        circle(x + r * 1.05, y - r * 0.55, 4, enemy.phase2 ? '#ff4a2a' : '#4a2a8a');
        circle(x + r * 0.75, y - r * 0.55, 4, enemy.phase2 ? '#ff4a2a' : '#4a2a8a');
        if (enemy.phase2) {
          ctx.globalAlpha = 0.25 + Math.sin(state.time * 6) * 0.1;
          circle(x, y, r + 10, '#ff4a2a');
          ctx.globalAlpha = 1;
        }
      } else {
        circle(x, y, r, def.colour);
        circle(x - r * 0.3, y - r * 0.35, r * 0.55, def.dark);
        if (enemy.kind === 'sproutling') {
          ctx.strokeStyle = '#4a8a2e';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x, y - r * 0.8);
          ctx.lineTo(x, y - r * 1.4);
          ctx.stroke();
          ellipse(x + 4, y - r * 1.4, 5, 2.5, '#7ec850');
        } else if (enemy.kind === 'husk') {
          ctx.strokeStyle = def.dark;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - r * 0.5, y - r * 0.2);
          ctx.lineTo(x, y + r * 0.2);
          ctx.lineTo(x + r * 0.4, y - r * 0.3);
          ctx.stroke();
        } else if (enemy.kind === 'spitter') {
          circle(x, y + r * 0.25, r * 0.4, '#5d2a08');
          circle(x, y + r * 0.25, r * 0.2, '#e8b23a');
        } else if (enemy.kind === 'brute') {
          circle(x - r * 0.7, y - r * 0.4, r * 0.45, def.dark);
          circle(x + r * 0.7, y - r * 0.4, r * 0.45, def.dark);
        }
        // Eyes, all facing the Heartwood.
        const face = Math.atan2(TREE.y - enemy.y, TREE.x - enemy.x);
        const ex = Math.cos(face) * r * 0.35;
        const ey = Math.sin(face) * r * 0.35;
        circle(x + ex - 4, y + ey - 3, 2.5, '#1a1208');
        circle(x + ex + 4, y + ey - 3, 2.5, '#1a1208');
      }
      // Poison tint and slow tint.
      if (state.time < enemy.poisonUntil) {
        ctx.globalAlpha = 0.3;
        circle(x, y, r, '#b07fe8');
        ctx.globalAlpha = 1;
      }
      if (state.time < enemy.slowUntil) {
        ctx.globalAlpha = 0.3;
        circle(x, y, r, '#e8b23a');
        ctx.globalAlpha = 1;
      }
      if (enemy.flash > 0) {
        ctx.globalAlpha = Math.min(1, enemy.flash * 8);
        circle(x, y, r, '#ffffff');
        ctx.globalAlpha = 1;
      }
      // Health bar.
      if (enemy.hp < enemy.maxHp && !enemy.boss) {
        const w = Math.max(24, r * 2);
        const share = enemy.hp / enemy.maxHp;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x - w / 2, y - r - 12, w, 5);
        ctx.fillStyle = share > 0.4 ? '#8fd45e' : '#e86a4a';
        ctx.fillRect(x - w / 2, y - r - 12, w * share, 5);
      }
    }
    // The Stag gets a great health bar of its own.
    const boss = state.enemies.find((e) => e.alive && e.boss);
    if (boss) {
      const w = 420;
      const x = (FIELD.width - w) / 2;
      const y = HUD_HEIGHT + 10;
      panel(x - 10, y - 8, w + 20, 34, 'rgba(20, 10, 10, 0.85)', '#c9a8a8');
      text('THE HOLLOW STAG', x + w / 2, y + 2, 12, '#e8d8d8', 'center');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x, y + 10, w, 8);
      ctx.fillStyle = boss.phase2 ? '#ff4a2a' : '#d8d8e8';
      ctx.fillRect(x, y + 10, w * (boss.hp / boss.maxHp), 8);
    }
  }

  function drawProjectilesAndParticles(state) {
    for (const p of state.projectiles) {
      if (!p.alive) continue;
      if (p.kind === 'thorn') {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#c8f09a';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -3.5);
        ctx.lineTo(-5, 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        circle(p.x, p.y, 5, '#e8b23a');
        circle(p.x, p.y, 2.5, '#fff3c8');
      }
    }
    for (const p of state.particles) {
      const alpha = p.ambient ? 0.7 * (p.life / p.maxLife) : Math.min(1, (p.life / p.maxLife) * 2);
      ctx.globalAlpha = Math.max(0, alpha);
      if (p.kind === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'spore') {
        circle(p.x, p.y, p.size, p.colour);
      } else if (p.kind === 'drop') {
        circle(p.x, p.y, p.size, p.colour);
      } else {
        circle(p.x, p.y, p.size, p.colour);
      }
    }
    ctx.globalAlpha = 1;
    for (const t of state.texts) {
      ctx.globalAlpha = Math.min(1, t.life / 0.5);
      textOutline(t.text, t.x, t.y, 15, t.colour, 'center', 800);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, ui) {
    ctx.fillStyle = '#1a2410';
    ctx.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    ctx.fillStyle = '#0e1608';
    ctx.fillRect(0, HUD_HEIGHT - 4, FIELD.width, 4);
    // Wave + season.
    text(`WAVE ${Math.min(state.wave, TOTAL_WAVES)}/${TOTAL_WAVES}`, 14, 22, 22, PALETTE.text);
    const season = SEASONS[state.seasonIndex];
    ctx.fillStyle = season.colour;
    roundRect(14, 38, 82, 20, 10);
    ctx.fill();
    text(season.name, 55, 48, 12, '#1a2410', 'center', 800);
    text(season.blurb, 104, 48, 11, PALETTE.muted, 'left', 600);
    // The Heartwood's health.
    text('HEARTWOOD', 236, 16, 11, PALETTE.muted);
    const hpW = 240;
    const hpShare = Math.max(0, state.treeHp / state.treeMaxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(236, 26, hpW, 18, 9);
    ctx.fill();
    ctx.fillStyle = hpShare > 0.4 ? PALETTE.hp : PALETTE.hpLow;
    if (hpShare > 0) {
      roundRect(236, 26, Math.max(18, hpW * hpShare), 18, 9);
      ctx.fill();
    }
    text(`${Math.ceil(state.treeHp)} / ${state.treeMaxHp}`, 356, 35, 13, '#ffffff', 'center');
    // Sap.
    text('SAP', 500, 16, 11, PALETTE.muted);
    circle(508, 36, 8, PALETTE.sap);
    text(`${state.sap}`, 522, 36, 22, PALETTE.sap);
    // Score.
    text('SCORE', 640, 16, 11, PALETTE.muted);
    text(`${state.score}`, 640, 38, 22, PALETTE.text);
    // Foes left + wave progress.
    text('FOES LEFT', 780, 16, 11, PALETTE.muted);
    const remaining = state.phase === 'combat' ? enemiesRemaining(state) : 0;
    text(state.phase === 'combat' ? `${remaining}` : '—', 780, 38, 22, remaining > 0 ? '#ff9a7a' : PALETTE.text);
    // Start wave / build timer.
    const btn = LAYOUT.startWave;
    if (state.phase === 'build') {
      const bonus = Math.ceil(state.buildTimer);
      ctx.fillStyle = '#c08a1e';
      roundRect(btn.x, btn.y, btn.w, btn.h, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      roundRect(btn.x + 2, btn.y + 2, btn.w - 4, btn.h - 4, 8);
      ctx.fill();
      text(`START WAVE ${state.wave}`, btn.x + btn.w / 2, btn.y + 16, 15, '#3a2408', 'center', 800);
      text(`SPACE · early +${bonus} Sap`, btn.x + btn.w / 2, btn.y + 33, 11, '#5d3a08', 'center', 700);
    } else if (state.phase === 'combat') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(btn.x, btn.y, btn.w, btn.h, 10);
      ctx.fill();
      text('WAVE IN PROGRESS', btn.x + btn.w / 2, btn.y + 22, 13, PALETTE.muted, 'center', 700);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(btn.x, btn.y, btn.w, btn.h, 10);
      ctx.fill();
      text('—', btn.x + btn.w / 2, btn.y + 22, 13, PALETTE.muted, 'center', 700);
    }
    // Speed / pause / mute.
    const smallBtn = (r, label, active) => {
      ctx.fillStyle = active ? '#7a9a55' : 'rgba(255, 255, 255, 0.1)';
      roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      text(label, r.x + r.w / 2, r.y + r.h / 2 + 1, 15, active ? '#101a0c' : PALETTE.text, 'center', 800);
    };
    smallBtn(LAYOUT.speedBtn, ui.speed === 2 ? '2×' : '1×', ui.speed === 2);
    smallBtn(LAYOUT.pauseBtn, 'II', false);
    smallBtn(LAYOUT.muteBtn, ui.muted ? '✕' : '♪', false);
  }

  function drawBuildBar(state, ui) {
    ctx.fillStyle = '#1a2410';
    ctx.fillRect(0, BUILD_BAR_Y, FIELD.width, FIELD.height - BUILD_BAR_Y);
    ctx.fillStyle = '#0e1608';
    ctx.fillRect(0, BUILD_BAR_Y, FIELD.width, 4);
    for (let i = 0; i < GROWTH_ORDER.length; i += 1) {
      const kind = GROWTH_ORDER[i];
      const def = GROWTHS[kind];
      const x = LAYOUT.cardX0 + i * (LAYOUT.cardW + LAYOUT.cardGap);
      const y = LAYOUT.cardY;
      const unlocked = state.unlocked.has(kind);
      const selected = ui.selectedGrowth === kind;
      const cost = costNow(state, kind);
      const afford = state.sap >= cost;
      ctx.fillStyle = selected ? '#3a5220' : PALETTE.card;
      roundRect(x, y, LAYOUT.cardW, LAYOUT.cardH, 10);
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffd166' : unlocked ? PALETTE.cardEdge : '#4a4a3a';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();
      if (!unlocked) {
        ctx.globalAlpha = 0.55;
        drawTowerIcon(x + 30, y + 34, kind, 1, state.time);
        ctx.globalAlpha = 1;
        text(def.name, x + 56, y + 22, 15, '#8a8a7a');
        text('Locked — draft card', x + 56, y + 44, 11, '#8a8a7a', 'left', 600);
        text(`[${def.key}]`, x + LAYOUT.cardW - 12, y + 18, 12, '#8a8a7a', 'right');
        continue;
      }
      drawTowerIcon(x + 30, y + 34, kind, 1, state.time);
      text(def.name, x + 56, y + 20, 15, PALETTE.text);
      text(def.desc, x + 56, y + 40, 10.5, PALETTE.muted, 'left', 600);
      text(`${cost} Sap`, x + 56, y + 62, 14, afford ? PALETTE.sap : '#e86a4a');
      text(`[${def.key}]`, x + LAYOUT.cardW - 12, y + 18, 12, PALETTE.muted, 'right');
      if (selected) text('CLICK A PLOT', x + LAYOUT.cardW - 12, y + 62, 10, '#ffd166', 'right', 800);
    }
    if (ui.hint) {
      text(ui.hint, FIELD.width / 2, BUILD_BAR_Y - 12, 13, PALETTE.muted, 'center', 600);
    }
  }

  function drawTowerPanel(state, ui) {
    const tower = ui.selectedTower;
    if (!tower || !tower.alive) return;
    const p = LAYOUT.towerPanel;
    panel(p.x, p.y, p.w, p.h);
    const def = GROWTHS[tower.kind];
    drawTowerIcon(p.x + 30, p.y + 32, tower.kind, tower.tier, state.time);
    text(def.name, p.x + 56, p.y + 20, 17, PALETTE.text);
    text(`Tier ${tower.tier} / 3`, p.x + 56, p.y + 40, 12, PALETTE.muted, 'left', 600);
    text(`HP ${Math.ceil(tower.hp)} / ${tower.maxHp}`, p.x + 150, p.y + 40, 12, PALETTE.muted, 'left', 600);
    const stats = tower.kind === 'spore'
      ? `Poison ${Math.round(tower.dps)}/s · range ${Math.round(tower.range)}`
      : tower.kind === 'sunbloom'
        ? `+${Math.round(tower.income)} Sap / wave · trickle ${tower.trickle.toFixed(1)}/s`
        : tower.kind === 'wall'
          ? `Blocks the path · thorns ${Math.round(tower.thornDamage)}/s`
          : tower.kind === 'mine'
            ? `Blast ${Math.round(tower.damage)} dmg · radius ${tower.blastRadius}`
            : `${Math.round(tower.damage)} dmg · every ${tower.interval.toFixed(2)}s · range ${Math.round(tower.range)}`;
    text(stats, p.x + 14, p.y + 60, 12, PALETTE.text, 'left', 600);
    const up = LAYOUT.towerUpgrade;
    const sell = LAYOUT.towerSell;
    const upCost = upgradeCost(tower, state.season);
    if (upCost > 0) {
      const afford = state.sap >= upCost;
      ctx.fillStyle = afford ? '#7a9a55' : 'rgba(255, 255, 255, 0.12)';
      roundRect(up.x, up.y, up.w, up.h, 8);
      ctx.fill();
      text(`UPGRADE · ${upCost} Sap [U]`, up.x + up.w / 2, up.y + up.h / 2 + 1, 12, afford ? '#101a0c' : PALETTE.muted, 'center', 800);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(up.x, up.y, up.w, up.h, 8);
      ctx.fill();
      text('MAX TIER', up.x + up.w / 2, up.y + up.h / 2 + 1, 12, PALETTE.muted, 'center', 800);
    }
    ctx.fillStyle = 'rgba(232, 106, 74, 0.85)';
    roundRect(sell.x, sell.y, sell.w, sell.h, 8);
    ctx.fill();
    text(`SELL +${sellValue(tower)} [X]`, sell.x + sell.w / 2, sell.y + sell.h / 2 + 1, 12, '#ffffff', 'center', 800);
    text('✕', LAYOUT.towerClose.x + 10, LAYOUT.towerClose.y + 10, 14, PALETTE.muted, 'center');
  }

  function drawPlay(state, ui) {
    // Deterministic shake (a function of time, never of Math.random).
    const shakeX = state.shake > 0 ? Math.sin(state.time * 47.3) * state.shake * 0.6 : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.time * 39.1) * state.shake * 0.6 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawGround(state);
    drawPaths(state);
    drawPlots(state, ui);
    drawTowers(state, ui);
    // The Heartwood visibly grows as the grove does.
    const grown = 1 + Math.min(state.towers.filter((t) => t.alive).length * 0.022, 0.25);
    drawTree(state, TREE.x, TREE.y, grown);
    drawEnemies(state);
    drawProjectilesAndParticles(state);
    ctx.restore();
    drawHud(state, ui);
    drawBuildBar(state, ui);
    drawTowerPanel(state, ui);
    if (state.phase === 'build' && state.wave === 1 && state.stats.planted === 0) {
      textOutline('Plant growths on the soil mounds, then START WAVE', FIELD.width / 2, 120, 18, '#ffd166', 'center');
      textOutline('Keys 1–6 pick a growth · click a mound to plant · Space starts the wave', FIELD.width / 2, 146, 14, PALETTE.text, 'center', 600);
    }
  }

  function drawTitle(state, ui) {
    drawGround(state);
    drawPaths(state);
    drawPlots(state, { ...ui, selectedGrowth: null, mouse: null });
    drawTree(state, FIELD.width / 2, 402, 1.35);
    drawProjectilesAndParticles(state);
    ctx.fillStyle = 'rgba(10, 16, 6, 0.35)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    textOutline('ROOTWARDEN', FIELD.width / 2, 92, 76, '#f2ecd8', 'center', 900);
    textOutline('Defend the Last Seed', FIELD.width / 2, 146, 24, '#ffd166', 'center', 700);
    text('Twelve waves march on the Last Seed. Grow its defences, draft blessings, hold the grove.', FIELD.width / 2, 186, 15, PALETTE.text, 'center', 600);
    // Difficulty boxes.
    text('CHOOSE YOUR WARDENSHIP', FIELD.width / 2, 474, 14, PALETTE.muted, 'center', 800);
    for (let i = 0; i < DIFFICULTY_ORDER.length; i += 1) {
      const key = DIFFICULTY_ORDER[i];
      const def = DIFFICULTY[key];
      const x = LAYOUT.diffX0 + i * (LAYOUT.diffW + LAYOUT.diffGap);
      const y = LAYOUT.diffY;
      const selected = ui.difficulty === key;
      ctx.fillStyle = selected ? '#3a5220' : PALETTE.panel;
      roundRect(x, y, LAYOUT.diffW, LAYOUT.diffH, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffd166' : PALETTE.panelEdge;
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();
      text(def.label, x + LAYOUT.diffW / 2, y + 22, 20, PALETTE.text, 'center');
      text(def.hint, x + LAYOUT.diffW / 2, y + 46, 12, PALETTE.muted, 'center', 600);
      const best = ui.bests?.[key] ?? 0;
      text(best > 0 ? `Best ${best}` : 'No run yet', x + LAYOUT.diffW / 2, y + 66, 12, PALETTE.sap, 'center', 700);
      text(`[${i + 1}]`, x + LAYOUT.diffW - 12, y + 16, 11, PALETTE.muted, 'right');
    }
    // Start button.
    const btn = LAYOUT.titleStart;
    ctx.fillStyle = '#c08a1e';
    roundRect(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    roundRect(btn.x + 2, btn.y + 2, btn.w - 4, btn.h - 4, 10);
    ctx.fill();
    text('GROW THE GROVE', btn.x + btn.w / 2, btn.y + btn.h / 2 + 1, 22, '#3a2408', 'center', 900);
    text('Click or press Enter · 1–3 choose a wardenship', FIELD.width / 2, btn.y + btn.h + 20, 13, PALETTE.muted, 'center', 600);
    text('Mouse to plant · 1–6 growths · Space start wave · F fast-forward · M mute · R restart', FIELD.width / 2, 700, 13, PALETTE.muted, 'center', 600);
  }

  function drawDraft(state, ui) {
    drawPlay(state, { ...ui, selectedGrowth: null });
    ctx.fillStyle = 'rgba(10, 16, 6, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    textOutline(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 96, 40, '#8fd45e', 'center', 900);
    text('The grove offers three blessings. Choose one — it shapes the war.', FIELD.width / 2, 140, 16, PALETTE.text, 'center', 600);
    const cards = state.draftCards ?? [];
    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const x = LAYOUT.draftCardX0 + i * (LAYOUT.draftCardW + LAYOUT.draftCardGap);
      const y = LAYOUT.draftCardY;
      const hovered = ui.mouse && inRect(ui.mouse.x, ui.mouse.y, { x, y, w: LAYOUT.draftCardW, h: LAYOUT.draftCardH });
      ctx.fillStyle = hovered ? '#3a5220' : PALETTE.card;
      roundRect(x, y, LAYOUT.draftCardW, LAYOUT.draftCardH, 14);
      ctx.fill();
      ctx.strokeStyle = hovered ? '#ffd166' : PALETTE.cardEdge;
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.stroke();
      const tag = card.kind === 'unlock' ? 'NEW GROWTH' : card.kind === 'buff' ? 'LASTING BOON' : 'ONE-TIME GIFT';
      const tagColour = card.kind === 'unlock' ? '#ffd166' : card.kind === 'buff' ? '#8fd45e' : '#9ad8e8';
      text(tag, x + LAYOUT.draftCardW / 2, y + 26, 12, tagColour, 'center', 800);
      if (card.growth) {
        drawTowerIcon(x + LAYOUT.draftCardW / 2, y + 82, card.growth, 1, state.time);
      } else {
        circle(x + LAYOUT.draftCardW / 2, y + 82, 26, 'rgba(255, 209, 102, 0.2)');
        text('✦', x + LAYOUT.draftCardW / 2, y + 82, 30, '#ffd166', 'center');
      }
      text(card.name, x + LAYOUT.draftCardW / 2, y + 132, 22, PALETTE.text, 'center');
      // Wrapped description.
      const words = card.desc.split(' ');
      const lines = [];
      let line = '';
      ctx.font = `600 13px ${FONT}`;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > LAYOUT.draftCardW - 40) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      lines.forEach((l, li) => text(l, x + LAYOUT.draftCardW / 2, y + 168 + li * 20, 13, PALETTE.muted, 'center', 600));
      text(`[${i + 1}]`, x + LAYOUT.draftCardW / 2, y + LAYOUT.draftCardH - 24, 13, PALETTE.sap, 'center', 800);
    }
    const rb = LAYOUT.rerollBtn;
    const canReroll = state.rerollsLeft > 0;
    ctx.fillStyle = canReroll ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.05)';
    roundRect(rb.x, rb.y, rb.w, rb.h, 10);
    ctx.fill();
    ctx.strokeStyle = canReroll ? PALETTE.panelEdge : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(canReroll ? 'REROLL — 1 FREE [G]' : 'REROLL SPENT', rb.x + rb.w / 2, rb.y + rb.h / 2 + 1, 14, canReroll ? PALETTE.text : PALETTE.muted, 'center', 800);
    text(`Sap ${state.sap} · Tree ${Math.ceil(state.treeHp)}/${state.treeMaxHp} · Score ${state.score}`, FIELD.width / 2, rb.y + rb.h + 28, 14, PALETTE.muted, 'center', 600);
  }

  function drawPaused(state, ui) {
    drawPlay(state, ui);
    ctx.fillStyle = 'rgba(10, 16, 6, 0.7)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(440, 220, 400, 340);
    text('PAUSED', FIELD.width / 2, 268, 36, PALETTE.text, 'center', 900);
    text(`Wave ${state.wave} · Score ${state.score} · Sap ${state.sap}`, FIELD.width / 2, 302, 14, PALETTE.muted, 'center', 600);
    const btn = (r, label) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(label, r.x + r.w / 2, r.y + r.h / 2 + 1, 15, PALETTE.text, 'center', 800);
    };
    btn(LAYOUT.pauseResume, 'RESUME [Esc]');
    btn(LAYOUT.pauseRestart, 'RESTART [R]');
    btn(LAYOUT.pauseMute, ui.muted ? 'SOUND: OFF [M]' : 'SOUND: ON [M]');
    btn(LAYOUT.pauseTitle, 'QUIT TO TITLE [T]');
  }

  function drawEnd(state, ui, victory) {
    drawPlay(state, { ...ui, selectedGrowth: null });
    ctx.fillStyle = 'rgba(10, 16, 6, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(300, 88, 680, 560);
    if (victory) {
      textOutline('THE GROVE ENDURES', FIELD.width / 2, 148, 42, '#8fd45e', 'center', 900);
      text('The Hollow Stag has fallen. The Last Seed is safe — for now.', FIELD.width / 2, 192, 15, PALETTE.text, 'center', 600);
      // Stars.
      const stars = ui.stars ?? 1;
      for (let i = 0; i < 3; i += 1) {
        const x = FIELD.width / 2 + (i - 1) * 64;
        const lit = i < stars;
        text('★', x, 246, i === 1 ? 56 : 46, lit ? '#ffd166' : 'rgba(255,255,255,0.2)', 'center');
      }
      text(stars === 3 ? 'A flawless wardenship!' : stars === 2 ? 'A strong wardenship!' : 'The grove survives!', FIELD.width / 2, 296, 15, PALETTE.sap, 'center', 700);
    } else {
      textOutline('THE HEARTWOOD FALLS', FIELD.width / 2, 148, 42, '#e86a4a', 'center', 900);
      text(`The Blight reached the tree on wave ${state.wave}. The grove remembers — try again.`, FIELD.width / 2, 192, 15, PALETTE.text, 'center', 600);
    }
    if (ui.newBest) {
      text('★ NEW BEST SCORE ★', FIELD.width / 2, 326, 18, '#ffd166', 'center', 900);
    }
    // Stats table.
    const rows = [
      ['Score', `${state.score}`, `Best ${ui.best}`],
      ['Waves survived', `${state.stats.wavesCleared} / ${TOTAL_WAVES}`, `Wave ${state.wave}`],
      ['Blight slain', `${state.kills}`, ''],
      ['Sap earned', `${state.sapEarned}`, ''],
      ['Growths planted', `${state.stats.planted}`, `Upgraded ${state.stats.upgraded}`],
      ['Time', `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`, DIFFICULTY[state.difficultyKey].label],
      ['Heartwood', `${Math.ceil(state.treeHp)} / ${state.treeMaxHp} HP`, victory ? 'Standing' : 'Fallen'],
    ];
    const y0 = victory ? 356 : 268;
    rows.forEach(([label, value, note], i) => {
      const y = y0 + i * 28;
      text(label, 380, y, 15, PALETTE.muted, 'left', 600);
      text(value, 700, y, 15, PALETTE.text, 'left', 800);
      if (note) text(note, 860, y, 13, PALETTE.sap, 'left', 600);
    });
    const btn = (r, label, primary) => {
      ctx.fillStyle = primary ? '#ffd166' : 'rgba(255, 255, 255, 0.1)';
      roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      if (!primary) {
        ctx.strokeStyle = PALETTE.panelEdge;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      text(label, r.x + r.w / 2, r.y + r.h / 2 + 1, 15, primary ? '#3a2408' : PALETTE.text, 'center', 800);
    };
    btn(LAYOUT.endRestart, 'PLAY AGAIN [R]', true);
    btn(LAYOUT.endSameSeed, 'SAME SEED [S]', false);
    btn(LAYOUT.endTitle, 'TITLE [T]', false);
  }

  /** Paint one frame: the world, the HUD, and the screen on top. */
  function draw(state, screen, ui) {
    resize();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / FIELD.width, h / FIELD.height);
    const ox = (w - FIELD.width * scale) / 2;
    const oy = (h - FIELD.height * scale) / 2;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * ox, DPR * oy);
    if (screen === SCREEN_TITLE) drawTitle(state, ui);
    else if (screen === SCREEN_DRAFT) drawDraft(state, ui);
    else if (screen === SCREEN_PAUSED) drawPaused(state, ui);
    else if (screen === SCREEN_VICTORY) drawEnd(state, ui, true);
    else if (screen === SCREEN_DEFEAT) drawEnd(state, ui, false);
    else drawPlay(state, ui);
  }

  return { draw, drawTowerIcon };
}
