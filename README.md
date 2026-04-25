# Pinumbra

Pinumbra is a browser-based 3D first-person survival shooter set in an endless
polar-desert. Your one-and-only purpose: hunt white bears. A lot of them.

![screenshot placeholder](docs/screenshot.png)

## Features

- Fully playable 3D FPS running in any modern browser via [Three.js](https://threejs.org).
- Pointer-lock mouse-look, WASD movement, sprint, jump, crouch.
- Three modern firearms — **Pistol**, **Assault Rifle**, **Shotgun** — each
  with swappable **attachments & upgrades**:
  - Red-dot / Scope (accuracy + zoom)
  - Suppressor (bear stealth)
  - Extended magazine (ammo capacity)
  - Laser sight (hip-fire accuracy)
  - Heavy barrel (damage)
- **Organ-based damage model** on every bear: brain, heart, lungs, liver,
  stomach, spine, front legs, hind legs. Where you hit matters — a brain shot
  drops a bear instantly; a leg shot only slows it down; organ bleeding causes
  progressive damage over time.
- **Survival systems:** hunger, thirst, warmth, sleep, bladder, and a rising
  **bloodlust** meter that rewards kills and punishes pacifism.
- **Loot** scattered across the snow desert: ammo crates, rations, water
  bottles, thermoses, medkits, sleeping bags, and weapon attachments.
- Procedurally lit snowy wasteland with drifting fog, sparse dead trees and
  ice rocks, and a full day/night cycle.
- On-screen HUD with anatomical organ panel, needs bars, compass, ammo
  counter and bear kill tally.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:5173
```

Click the canvas to lock the mouse and start playing. Press **Esc** to release
the pointer at any time.

## Controls

| Action                | Key                        |
| --------------------- | -------------------------- |
| Move                  | `W` `A` `S` `D`            |
| Sprint                | `Shift` (hold)             |
| Crouch                | `C` (toggle)               |
| Jump                  | `Space`                    |
| Fire                  | Left mouse                 |
| Aim Down Sights       | Right mouse (hold)         |
| Reload                | `R`                        |
| Switch weapon         | `1` / `2` / `3` or wheel   |
| Cycle attachment slot | `T`                        |
| Toggle attachment     | `F`                        |
| Interact / pick up    | `E`                        |
| Eat / Drink           | `G` / `H`                  |
| Sleep (in bag)        | `Z`                        |
| Relieve bladder       | `B`                        |
| Pause / menu          | `Esc`                      |

## Build for production

```bash
npm run build
npm run preview
```

The `dist/` folder is a static bundle that can be dropped on any web host.

## Project layout

```
src/
  main.js       # bootstrap
  game.js       # scene, loop, systems wiring
  world.js      # snow terrain, props, loot spawner, day/night
  player.js     # controller, needs, inventory, hit model
  weapons.js    # guns, attachments, ballistics
  bears.js      # bear AI + organ damage model
  hud.js        # DOM HUD overlay
  input.js      # keyboard / mouse / pointer lock
  config.js     # gameplay tuning constants
  styles.css
```

## License

MIT — see [LICENSE](LICENSE).
