# emberfall

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/alifrestu519-hub/emberfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/alifrestu519-hub/emberfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

ROOTWARDEN — Defend the Last Seed: a living-tree tower defence. You are the Warden of the Heartwood, the last great tree in the clearing, and the Blight marches down three winding paths in twelve waves to devour it. Grow six kinds of living defence on the soil mounds — Thorn Turrets, Sap Sprayers, Spore Clouds, Root Walls, Sunblooms and Bramble Mines — each with three tiers, spend the Sap your kills earn, and draft one of three blessings after every cleared wave (a new growth, a lasting boon, or a one-time gift, with one free reroll). The seasons turn every three waves and change the rules: Spring makes growth cheap, Summer doubles Sunbloom Sap, Autumn slows the Blight with falling leaves, Winter hardens it. Survive to wave 12 and face the Hollow Stag, a two-phase boss that enrages, charges and calls minions. Three wardenships (Seedling, Warden, Blightstorm), each with its own best score and best wave; 1–3 star victories by the Heartwood's remaining health; procedural WebAudio sound (plant thocks, wave horns, a forest round); replay any grove from its seed (`?seed=N`, or S after a run ends).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in your browser.

## Play it

- **Mouse** — click a build-bar card (or press **1–6**), then click a soil mound to plant; click a growth to upgrade (**U**) or sell (**X**).
- **Space** — start the next wave early (bonus Sap for the time left on the build clock).
- **F** — fast-forward ×2 · **P** / **Esc** — pause · **M** — mute · **R** — restart · **G** — reroll the draft.

## Screenshots

Deterministic scenes, staged by `game/src/shots.js` from the real rules:

| Shot | Scene |
| --- | --- |
| `1-title.jpg` | Title — the Heartwood, three wardenships, best scores |
| `2-play.jpg` | Wave 6 in full flow — dense grove, HUD, build bar |
| `3-draft.jpg` | The draft — three blessings after a cleared wave |
| `4-victory.jpg` | Victory — three stars, full stats, restart |

---

<sub>Entered on [make.fun](https://make.fun/?ref=06djxp1d&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
