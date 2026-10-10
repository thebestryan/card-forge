# Card Forge

A character card builder and editor compatible with **SillyTavern**, **Marinara Engine**, and **HordeStudio**.

Runs entirely in your browser — no install, no dependencies, no server required (though a local server is recommended for full functionality).

## Quick Start

```bash
./start.sh
```

Opens at `http://localhost:9090`. Use `./start.sh 8080` for a custom port.

You can also just open `index.html` directly in a browser.

## Features

### Characters

Create and edit character cards with full support for all three target platforms:

| Format | Export | Import |
|---|---|---|
| **CCv2** (SillyTavern / Marinara) | PNG with `chara` metadata, JSON | PNG, JSON |
| **CCv3** (latest spec) | PNG with `ccv3` metadata, JSON | PNG, JSON |
| **HordeStudio `.nexus`** | JSON | JSON |

PNG exports embed character data as base64-encoded `tEXt` chunks — the same format SillyTavern and Marinara Engine use when reading cards. CCv3 exports include both `ccv3` and `chara` chunks for backward compatibility.

**Editable fields:** name, description, personality, scenario, first message, example messages, alternate greetings, system prompt, post-history instructions, depth prompt, tags, creator, version, creator notes, talkativeness, avatar.

### World Info / Lorebooks

Build SillyTavern-compatible world info with full entry editing:

- Primary and secondary keywords
- Content with position/depth control
- Insertion order, probability, constant/selective modes
- Case sensitivity and whole-word matching

Export as SillyTavern world JSON or HordeStudio `.horde_world`.

### Scenarios

Define reusable scenario templates with system prompts, opening messages, genre, difficulty, tags, and story hooks.

### Personas

Create user personas with name, age, pronouns, appearance, public identity, reputation, and color. Export as SillyTavern user settings, HordeStudio persona format, or plain JSON.

### Import

Drag-and-drop or file picker import for:

- `.png` — SillyTavern character cards (CCv2/CCv3)
- `.json` — Character cards, world info, personas
- `.nexus` — HordeStudio characters
- `.horde_world` — HordeStudio worlds

### Backup

Export all characters, worlds, scenarios, and personas as a single backup JSON. Import restores everything.

## Platform Compatibility

**SillyTavern** — CCv2 and CCv3 PNG cards import/export directly. World info is fully compatible.

**Marinara Engine** — Uses the same `chara_card_v2` spec as SillyTavern. All exports work directly.

**HordeStudio** — Native `.nexus` character format and `.horde_world` world format. SillyTavern PNG cards also import cleanly.

## Running Locally

No build step. The app is vanilla HTML/CSS/JS.

```bash
# Python
python3 -m http.server 9090

# Node
npx http-server -p 9090

# Or just open index.html in a browser
```

## Tech

- Pure HTML/CSS/JavaScript — no frameworks, no build tools
- PNG metadata handling via custom chunk reader/writer (`png-util.js`)
- State persisted in `localStorage`
- Fonts: Cinzel, Crimson Text, JetBrains Mono (Google Fonts)

## License

MIT
