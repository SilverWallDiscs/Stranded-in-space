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

## Create your own events (no JavaScript required)

Night and companion events are loaded from plain text files at startup:

- `events/rest.txt`: events that can happen while sleeping.
- `events/silver.txt`: events that can happen when Silver is travelling with you.

Each event is separated by a line containing `---`. Lines beginning with `#` are comments. The parser accepts quoted text and JSON arrays.

Example:

```text
event name: Silver's idea
event type: question
event requires companion: yes
event weight: 3
event space background: none
event message chain: ["I have an idea.", "Can I use the computer to improve the net?"]
event choices: ["Let Silver try|upgrade red|computer|35|none|Silver works on the computer.|The net is upgraded."]
```

### Event fields

| Field | Meaning |
| --- | --- |
| `event name` | Title shown in the event window. Required. |
| `event type` | `question` or `message`. |
| `event weight` | Relative probability; higher means more likely. |
| `event requires companion` | Set to `yes` for Silver-only events. |
| `event space background` | Image path, or `none`. |
| `event message` | One message, when no chain is needed. |
| `event message chain` | JSON array of dialogue paragraphs shown in order. |
| `event choices` | JSON array of choices; see the format below. |
| `event trigger` | Effect applied when a message event is continued. |
| `event use item` | Item required for a message event, or `none`. |
| `event chance consuming item` | 0–100 percent chance to consume the required item. |
| `recompensas` / `event rewards` | Items gained or lost. |

A choice uses this pipe-separated format:

`"Button text|trigger|item|consume chance|rewards|description|result message"`

- Trigger: `none`, `upgrade red`, `break pod`, `damage pod 20`, `repair pod 15`, `break computer`, `fix computer`.
- Item IDs: `canned_food`, `duct_tape`, `computer`, `battery`, etc.
- Rewards: `none`, `+2 canned_food`, `-1 battery`. Separate multiple rewards with `; `.

The item in a choice is required to select it. The consume chance controls whether it is actually spent. A computer consumed by an event is marked broken. For example, Silver's computer upgrade has a 35% chance to break/consume the computer, but the network upgrade succeeds either way.

Use a local web server when testing so the browser can fetch these files. After adding an event, refresh the page; no code changes are needed.
