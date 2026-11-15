// The level-up choices: twelve upgrades, each with a short name, a line
// of flavour and the effect it applies to the player. A card can be taken
// at most three or four times; the roll never offers a maxed-out upgrade.
// Four of them feed Echoloop's own systems: rust, breaking and the rewind.
export const UPGRADES = [
  {
    id: 'split',
    name: 'Split Gear',
    icon: '✦',
    text: '+1 gear bolt per volley',
    max: 3,
    apply(p) {
      p.projectiles += 1;
    },
  },
  {
    id: 'rapid',
    name: 'Quick Escapement',
    icon: '≫',
    text: 'The clockkeeper fires 18% faster',
    max: 4,
    apply(p) {
      p.fireInterval *= 0.82;
    },
  },
  {
    id: 'heavy',
    name: 'Heavy Hammer',
    icon: '●',
    text: 'Bolts deal 30% more damage',
    max: 4,
    apply(p) {
      p.boltDamage *= 1.3;
    },
  },
  {
    id: 'boots',
    name: 'Oiled Joints',
    icon: '»',
    text: 'Move 12% faster',
    max: 4,
    apply(p) {
      p.speed *= 1.12;
    },
  },
  {
    id: 'magnet',
    name: 'Magnet Coil',
    icon: '◎',
    text: 'Cogs fly to you from 45% farther',
    max: 3,
    apply(p) {
      p.pickupRadius *= 1.45;
    },
  },
  {
    id: 'heart',
    name: 'Mainspring Heart',
    icon: '♥',
    text: '+25 max health and mend 25 now',
    max: 4,
    apply(p) {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    },
  },
  {
    id: 'rewind',
    name: 'Rewind Charm',
    icon: '↯',
    text: '+1 rewind charge held, and refill one now',
    max: 3,
    apply(p) {
      p.rewindMax += 1;
      p.rewindCharges = Math.min(p.rewindMax, p.rewindCharges + 1);
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Pinion',
    icon: '→',
    text: 'Bolts pierce through +1 foe',
    max: 3,
    apply(p) {
      p.pierce += 1;
    },
  },
  {
    id: 'deeprust',
    name: 'Deep Rust',
    icon: '❋',
    text: 'Each bolt stacks +1 rust — foes seize twice as fast',
    max: 2,
    apply(p) {
      p.rustPerHit += 1;
    },
  },
  {
    id: 'breaker',
    name: 'Breaker',
    icon: '✧',
    text: 'Seized foes take +50% damage from your bolts',
    max: 3,
    apply(p) {
      p.breakBonus += 0.5;
    },
  },
  {
    id: 'combo',
    name: 'Combo Master',
    icon: '×',
    text: 'The combo window lasts +1 second',
    max: 3,
    apply(p) {
      p.comboBonus += 1;
    },
  },
  {
    id: 'paradox',
    name: 'Paradox Shield',
    icon: '◐',
    text: 'Mend 15 now, and +5 more mending each wave clear',
    max: 2,
    apply(p) {
      p.hp = Math.min(p.maxHp, p.hp + 15);
      p.maxHp += 10;
    },
  },
];

/** Roll three distinct upgrades the player has not maxed out yet. */
export function rollUpgrades(random, taken) {
  const available = UPGRADES.filter((u) => (taken[u.id] ?? 0) < u.max);
  const picks = [];
  while (picks.length < 3 && available.length > 0) {
    const index = Math.floor(random.next() * available.length);
    picks.push(available.splice(index, 1)[0]);
  }
  return picks;
}
