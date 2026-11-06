# OPTIMIST LUDO — source bundle

This ZIP contains the complete current Classic MVP source tree at the time of packaging.

## Contents
- `index.html`, `styles.css`, `src/`: Telegram Mini App client and visual components.
- `apps/backend/`: authoritative Classic game engine, room server, Telegram auth, resume and voice-message cache.
- `assets/`: original OPTIMIST LUDO board artwork and 12 optimized character WebP files.
- `tests/`: 49 automated unit/contract tests.
- `scripts/server-smoke.mjs`: multi-client HTTP/WebSocket smoke scenario.
- `README.md`, `DESIGN-SPEC.md`, `ROADMAP.md`, `VOICE-MESSAGES.md`, `FREE-HOSTING.md`: setup and architecture notes.

## Verification
`npm test`: 49 passed, 0 failed.
`npm run smoke`: not verified in the packaging environment because the `ws` npm dependency could not be installed before the network timeout. Run `npm install` followed by `npm run smoke` on the deployment machine.

## Important release limits
The current milestone is Classic 2–4 player MVP. Rooms, resume state and voice clips are held in process memory, and are lost on server restart. This is not yet a persistent production service. See `README.md` and `ROADMAP.md` for the exact boundaries.
