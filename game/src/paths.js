// The clearing's geography: three winding paths from the forest edge to
// the Heartwood, and the soil plots a Warden may plant on. Everything here
// is fixed geometry — the same grove every run, so the grove can be learned.
import { BUILD_BAR_Y, FIELD, HUD_HEIGHT, TREE } from './config.js';

/** The three paths, as waypoint polylines from the edge to the tree. */
export const PATH_WAYPOINTS = [
  // The western road: in from the left, a bend, then home.
  [[-30, 196], [168, 196], [232, 372], [408, 372], [486, 332], [TREE.x - TREE.biteRadius, TREE.y]],
  // The northern road: down from the top right, a long hook.
  [[1148, HUD_HEIGHT - 20], [1148, 168], [936, 168], [872, 296], [724, 332], [TREE.x + TREE.biteRadius, TREE.y]],
  // The southern road: up from the bottom left, a slow S.
  [[196, BUILD_BAR_Y + 20], [196, 516], [392, 516], [448, 428], [556, 396], [TREE.x - 34, TREE.y + 40]],
];

/** Plot geometry: a mound a growth can be planted on. */
export const PLOT_RADIUS = 26;
/** How close a plot may sit to a path's centreline. */
const PLOT_PATH_CLEARANCE = 34;
/** How close a plot may sit to the Heartwood. */
const PLOT_TREE_CLEARANCE = 112;

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** The nearest point on any path to (x, y), and how far away it is. */
export function nearestPathPoint(x, y) {
  let best = { x, y, distance: Infinity, path: 0 };
  for (let p = 0; p < PATH_WAYPOINTS.length; p += 1) {
    const pts = PATH_WAYPOINTS[p];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx;
      const cy = ay + t * dy;
      const d = Math.hypot(x - cx, y - cy);
      if (d < best.distance) best = { x: cx, y: cy, distance: d, path: p };
    }
  }
  return best;
}

/** True when a plot centre is clear of every path and of the tree. */
function plotIsClear(x, y) {
  if (Math.hypot(x - TREE.x, y - TREE.y) < PLOT_TREE_CLEARANCE) return false;
  for (const pts of PATH_WAYPOINTS) {
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (distanceToSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < PLOT_PATH_CLEARANCE) return false;
    }
  }
  return true;
}

/**
 * The build plots: a staggered grid over the clearing, keeping only the
 * mounds clear of the paths and the Heartwood. A plot knows how close it
 * sits to a path, which is what makes a Root Wall useful there.
 */
export function buildPlots() {
  const plots = [];
  let id = 0;
  const stepX = 74;
  const stepY = 70;
  for (let row = 0, y = HUD_HEIGHT + 34; y < BUILD_BAR_Y - 26; row += 1, y += stepY) {
    const offset = row % 2 === 0 ? 0 : stepX / 2;
    for (let x = 44 + offset; x < FIELD.width - 30; x += stepX) {
      if (!plotIsClear(x, y)) continue;
      const near = nearestPathPoint(x, y);
      plots.push({
        id: id += 1,
        x, y,
        tower: null,
        pathDistance: near.distance,
        path: near.path,
        pathX: near.x,
        pathY: near.y,
      });
    }
  }
  return plots;
}

/** A path with its cumulative lengths, for walking and for targeting. */
export function buildPaths() {
  return PATH_WAYPOINTS.map((pts) => {
    const points = pts.map(([x, y]) => ({ x, y }));
    const lengths = [0];
    for (let i = 1; i < points.length; i += 1) {
      lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    return { points, lengths, total: lengths[lengths.length - 1] };
  });
}

/** Where an enemy stands after walking `distance` along a path. */
export function pointAlongPath(path, distance) {
  const d = Math.max(0, Math.min(distance, path.total));
  let i = 1;
  while (i < path.lengths.length - 1 && path.lengths[i] < d) i += 1;
  const segLen = path.lengths[i] - path.lengths[i - 1] || 1;
  const t = (d - path.lengths[i - 1]) / segLen;
  const a = path.points[i - 1];
  const b = path.points[i];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
