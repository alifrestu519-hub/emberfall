// The waves: what each wave brings, when each group steps out of the
// forest, and which path it takes. Spawn order walks the paths in turn so
// no road is ever quiet for long.
import { WAVES } from './config.js';
import { createEnemy } from './enemies.js';

/** The spawn schedule for a wave: timed entries, paths assigned in turn. */
export function buildWaveSchedule(wave, rng) {
  const groups = WAVES[wave - 1] ?? [];
  const schedule = [];
  let pathTurn = rng.int(0, 2);
  for (const group of groups) {
    for (let i = 0; i < group.count; i += 1) {
      schedule.push({
        kind: group.kind,
        at: group.at + i * group.gap,
        pathIndex: pathTurn % 3,
      });
      pathTurn += 1;
    }
  }
  schedule.sort((a, b) => a.at - b.at);
  return schedule;
}

/** How many foes a wave brings in all. */
export function waveTotal(wave) {
  return (WAVES[wave - 1] ?? []).reduce((sum, group) => sum + group.count, 0);
}

/** Whether a wave carries the Hollow Stag. */
export function waveHasBoss(wave) {
  return (WAVES[wave - 1] ?? []).some((group) => group.kind === 'stag');
}

/** Spawn every foe whose time has come; returns the newly spawned. */
export function spawnDue(schedule, waveTime, wave, difficulty, season, paths) {
  const spawned = [];
  while (schedule.length > 0 && schedule[0].at <= waveTime) {
    const entry = schedule.shift();
    const enemy = createEnemy(entry.kind, entry.pathIndex, wave, difficulty, season);
    const start = paths[entry.pathIndex].points[0];
    enemy.x = start.x;
    enemy.y = start.y;
    spawned.push(enemy);
  }
  return spawned;
}
