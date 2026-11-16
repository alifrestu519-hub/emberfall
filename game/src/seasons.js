// The seasons turn every three waves and change the rules of the grove:
// Spring makes growth cheap, Summer doubles Sunbloom Sap, Autumn slows
// the Blight with falling leaves, and Winter hardens it.
import { SEASONS } from './config.js';

/** The season in force for a wave number (1-based). */
export function seasonForWave(wave) {
  for (const season of SEASONS) {
    if (season.waves.includes(wave)) return season;
  }
  return SEASONS[SEASONS.length - 1];
}

/** The index (0-3) of the season in force for a wave number. */
export function seasonIndexForWave(wave) {
  return Math.min(3, Math.floor((wave - 1) / 3));
}

/** The palette tint each season washes over the clearing. */
export const SEASON_TINTS = [
  { ground: '#2c4a22', sky: 'rgba(154, 216, 106, 0.06)', leaf: '#7ec850' },
  { ground: '#3a5220', sky: 'rgba(255, 209, 102, 0.08)', leaf: '#9ac850' },
  { ground: '#4a3d1e', sky: 'rgba(224, 138, 74, 0.09)', leaf: '#d89a4a' },
  { ground: '#24384a', sky: 'rgba(168, 200, 232, 0.10)', leaf: '#8aa86a' },
];

/** The ambient particle each season sheds: petals, pollen, leaves, snow. */
export const SEASON_FALL = [
  { colour: '#ffb8d8', count: 1, name: 'petals' },
  { colour: '#ffe9a8', count: 1, name: 'pollen' },
  { colour: '#e08a4a', count: 2, name: 'leaves' },
  { colour: '#e8f2ff', count: 2, name: 'snow' },
];
