# Stranded in Space

A browser-based 3D survival prototype inspired by short-form scavenging and night-event survival games. Built for a personal project; the visual identity, characters, dialogue, items and events are original to this game.

## Run

Open the repository with a local web server (ES modules and Three.js require an HTTP origin):

- VS Code: use **Live Server** on `index.html`.
- Python: `python -m http.server 8000`, then open `http://localhost:8000`.
- GitHub Pages can host the static project directly.

Three.js is loaded from jsDelivr through an import map. No bundler or npm install is required.

## Controls

### Evacuation
- `W A S D`: move.
- Mouse: look around (click the 3D view once to capture the pointer).
- `E`: pick up the nearest object or deposit everything currently in your hands when standing inside the pod zone.
- You have **3 hand slots**. Large objects consume 2 slots and a person consumes all 3.
- Reach the glowing zone beside the escape pod before the 60-second countdown ends.

### Survival
- Use the right-side action panel to cast the space net, repair the hull, talk to Silver, or sleep.
- Actions that require effort cost energy. Resting advances the day and restores a little energy.
- Select an item in storage to use it.

## Current prototype features

- Real-time 3D ship interior built with Three.js.
- 60-second evacuation phase, three-slot hand inventory, oversized objects and a single companion slot.
- Escape-pod deposit zone and a short launch / mothership destruction cinematic.
- Persistent pod storage, a four-point energy system, random space-net loot, battery-assisted searches and food rewards.
- Hull integrity, a screw-tightening repair minigame, sleep cycles and random night events.
- Silver as a placeholder companion with dialogue and a temporary net upgrade.
- Procedural sound effects using the Web Audio API.
- Local save data via `localStorage`.

## Add your PNG art

See [assets/README.md](assets/README.md). Missing PNGs are replaced with simple in-game placeholder artwork, so the game is playable before the final art is ready.

## Notes

This is an early playable prototype. The balancing values, event pool, item effects and placeholder visuals are intentionally easy to adjust in `src/game.js`.
