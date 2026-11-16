// The draft: after every cleared wave the Warden chooses one of three
// cards — a new growth to unlock, a lasting boon for the grove, or a
// one-time gift. One free reroll per draft.
import { GROWTHS, GROWTH_ORDER } from './config.js';

/** Every card the draft can deal. `available` hides spent or unusable cards. */
export const DRAFT_CARDS = [
  {
    id: 'unlock-spore', kind: 'unlock', growth: 'spore',
    name: 'Spore Cloud', icon: 'spore',
    desc: 'Unlock the Spore Cloud growth: a poison cloud that melts crowds and flying Wisps.',
    available: (state) => !state.unlocked.has('spore'),
    apply: (state) => { state.unlocked.add('spore'); },
  },
  {
    id: 'unlock-wall', kind: 'unlock', growth: 'wall',
    name: 'Root Wall', icon: 'wall',
    desc: 'Unlock the Root Wall growth: a living wall that blocks a path and thorns its chewers.',
    available: (state) => !state.unlocked.has('wall'),
    apply: (state) => { state.unlocked.add('wall'); },
  },
  {
    id: 'unlock-mine', kind: 'unlock', growth: 'mine',
    name: 'Bramble Mine', icon: 'mine',
    desc: 'Unlock the Bramble Mine growth: a buried bomb that erupts when a foe steps on it.',
    available: (state) => !state.unlocked.has('mine'),
    apply: (state) => { state.unlocked.add('mine'); },
  },
  {
    id: 'deep-roots', kind: 'boon', icon: 'roots',
    name: 'Deep Roots', desc: 'The Heartwood grows stronger: +25 max HP and heal 25 HP now.',
    available: () => true,
    apply: (state) => {
      state.treeMaxHp += 25;
      state.treeHp = Math.min(state.treeMaxHp, state.treeHp + 25);
    },
  },
  {
    id: 'rich-soil', kind: 'boon', icon: 'sap',
    name: 'Rich Soil', desc: 'The grove yields a windfall: +45 Sap, right now.',
    available: () => true,
    apply: (state) => { state.sap += 45; state.sapEarned += 45; },
  },
  {
    id: 'thornstorm', kind: 'buff', icon: 'thorn',
    name: 'Thornstorm', desc: 'Thorn Turrets fire 25% faster, forever.',
    available: (state) => (state.buffs.thornRateBonus || 0) < 0.5,
    apply: (state) => { state.buffs.thornRateBonus = (state.buffs.thornRateBonus || 0) + 0.25; },
  },
  {
    id: 'swift-sap', kind: 'buff', icon: 'swift',
    name: 'Swift Sap', desc: 'Every growth fires 12% faster, forever.',
    available: (state) => (state.buffs.fireRateBonus || 0) < 0.36,
    apply: (state) => { state.buffs.fireRateBonus = (state.buffs.fireRateBonus || 0) + 0.12; },
  },
  {
    id: 'long-thorns', kind: 'buff', icon: 'range',
    name: 'Long Thorns', desc: 'Every growth reaches 15% farther, forever.',
    available: (state) => (state.buffs.rangeBonus || 0) < 0.45,
    apply: (state) => { state.buffs.rangeBonus = (state.buffs.rangeBonus || 0) + 0.15; },
  },
  {
    id: 'spore-bloom', kind: 'buff', icon: 'spore',
    name: 'Spore Bloom', desc: 'Spore Clouds poison 40% harder, forever.',
    available: (state) => state.unlocked.has('spore') && (state.buffs.sporeBonus || 0) < 0.8,
    apply: (state) => { state.buffs.sporeBonus = (state.buffs.sporeBonus || 0) + 0.4; },
  },
  {
    id: 'hardened-bark', kind: 'buff', icon: 'bark',
    name: 'Hardened Bark', desc: 'Walls and towers gain +50% max HP, forever.',
    available: (state) => (state.buffs.hpBonus || 0) < 1,
    apply: (state) => {
      state.buffs.hpBonus = (state.buffs.hpBonus || 0) + 0.5;
      for (const tower of state.towers) {
        if (!tower.alive) continue;
        tower.maxHp = Math.round(tower.maxHp * 1.5);
        tower.hp = Math.min(tower.maxHp, tower.hp + Math.round(tower.maxHp * 0.5));
      }
    },
  },
  {
    id: 'golden-sap', kind: 'buff', icon: 'gold',
    name: 'Golden Sap', desc: 'Every kill pays +2 Sap, forever.',
    available: (state) => (state.buffs.killSapBonus || 0) < 6,
    apply: (state) => { state.buffs.killSapBonus = (state.buffs.killSapBonus || 0) + 2; },
  },
  {
    id: 'menders-touch', kind: 'boon', icon: 'mend',
    name: "Mender's Touch", desc: 'Repair every growth to full HP and mend the Heartwood for 15.',
    available: (state) => state.towers.some((t) => t.alive && t.hp < t.maxHp) || state.treeHp < state.treeMaxHp,
    apply: (state) => {
      for (const tower of state.towers) if (tower.alive) tower.hp = tower.maxHp;
      state.treeHp = Math.min(state.treeMaxHp, state.treeHp + 15);
    },
  },
];

/** Deal three distinct cards the Warden can still use. */
export function dealDraft(state, rng) {
  const pool = DRAFT_CARDS.filter((card) => card.available(state));
  const dealt = [];
  const copy = [...pool];
  while (dealt.length < 3 && copy.length > 0) {
    const i = Math.floor(rng.next() * copy.length);
    dealt.push(copy.splice(i, 1)[0]);
  }
  // The grove always offers something, even late in the run.
  while (dealt.length < 3) {
    dealt.push(DRAFT_CARDS.find((c) => c.id === 'rich-soil'));
  }
  return dealt;
}

/** A growth's draft card, for the build bar's locked slots. */
export function unlockCardFor(kind) {
  return DRAFT_CARDS.find((card) => card.growth === kind);
}

export { GROWTHS, GROWTH_ORDER };
