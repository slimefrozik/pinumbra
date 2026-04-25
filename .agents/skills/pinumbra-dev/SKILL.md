# Pinumbra — developer skill

Pinumbra is a browser-based 3D FPS built with **Three.js 0.160** and bundled
with **Vite**. The entire game is client-side; there is no backend.

## Run & build

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # writes static site to ./dist
npm run preview    # serve the built site on http://localhost:4173
npm run lint       # eslint over src/**/*.js (must pass CI)
```

CI (`.github/workflows/ci.yml`) runs `npm ci && npm run lint && npm run build`
on every push / PR. Both must pass before merging.

## Code layout

- `src/main.js` — DOM bootstrap, wires the menu / death screen buttons.
- `src/game.js` — central game loop, systems wiring, firing pipeline, loot
  pickup, day/night tick. Most gameplay changes land here.
- `src/world.js` — procedural snow terrain (value noise), decor spawner,
  loot spawner, day/night lighting.
- `src/player.js` — FPS controller + needs/health simulation.
- `src/weapons.js` — `Weapon` (ammo/stats + attachments) and
  `WeaponViewModel` (camera-mounted low-poly gun mesh).
- `src/bears.js` — polar bear AI + per-organ hit spheres & damage model.
- `src/audio.js` — synthesized SFX (Web Audio); no audio assets shipped.
- `src/hud.js` — pure DOM HUD updater; reads state from the game loop.
- `src/input.js` — pointer lock + keyboard + mouse edge state.
- `src/config.js` — all tuning data (weapons, attachments, organs, needs,
  loot table, world). Balance changes belong here, not in logic code.

## Gameplay contracts

- Needs are stored on `Player.needs` as `0..100`. Zero-to-threshold triggers
  passive damage; values over 95 on `bladder` / `bloodlust` also damage.
- Each `Bear` owns organ hit spheres built from `ORGANS` in `config.js`.
  Brain/heart kills are handled via the `crit: true` flag in that table.
- `Weapon.stats()` returns the post-attachment ballistic stats. The firing
  pipeline in `game.js _fireRay()` uses those stats for damage, spread,
  range and zoom. Add new attachment effects by extending `ATTACHMENTS` and
  accounting for the field in `Weapon.stats()` and/or `magCapacity()`.

## Testing manually

1. `npm run dev`, open http://localhost:5173.
2. Click **START HUNT**. Pointer lock fires on the canvas click.
3. WASD + mouse look should move. `1/2/3` to change weapons. `RMB` to ADS.
4. Shoot a bear's head for an instant kill. Shoot a leg to slow it.
5. Walk into a colored crate and press `E` to loot. Ammo crates refill
   reserve; attachments auto-mount if the slot is empty, otherwise press
   `T` to cycle slots and `F` to cycle attachments in the selected slot.
6. Let needs decay (rapid on the bloodlust meter) to verify the damage
   path.
