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

## Crear eventos

Puedes crear y editar eventos sin tocar JavaScript. Revisa [events/README.md](events/README.md) para ver la guía, y copia [events/PLANTILLA.txt](events/PLANTILLA.txt) para empezar.

- `events/rest.txt`: eventos que pueden ocurrir al dormir.
- `events/silver.txt`: eventos que requieren que Silver este contigo.

Los archivos usan bloques `[EVENT]`, `[MESSAGE]` y `[CHOICE]`. Cada campo ocupa su propia línea; ya no necesitas arreglos JSON ni cadenas separadas por `|`.


## Spaces and physical objects

The evacuation ship is divided into six rooms: galley, cargo bay, medical bay, engineering, crew quarters and auxiliary storage. Pickups are low-poly 3D objects placed on the floor in their assigned rooms, not floating icons.

After escape, the life pod is explored in first person. Stored items are physically displayed on the floor; use `E` when standing close to an item or station. The net uses `E` at its winch, and `SHIFT + E` connects a battery. The repair panel, bunk and Silver are also interacted with in the room. The survival HUD only shows hull, energy and day.
