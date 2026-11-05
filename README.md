# OPTIMIST LUDO

OPTIMIST LUDO is a Telegram Mini App project for classic 2–4 player Ludo.

## Design preview

Open [design-preview.html](./design-preview.html) to inspect the current visual direction: custom 3D six-sided dice, tactile throw button, bottom action dock, responsive board layout, player panels and NEON / CLASSIC / ELITE / MARBLE theme switching.

The preview is a standalone UI demonstration. Its dice result is simulated locally and is not connected to the multiplayer server.

## Release status

The integrated Classic MVP source bundle is prepared separately and includes the client, server-authoritative game engine, room management, Telegram authentication, reconnect support, text chat, voice-message endpoints, board artwork and 12 optimized character assets.

The full source bundle is not yet committed to this repository. Do not treat this design preview as a production multiplayer release.

## Local checks

The prepared source bundle currently passes 49 automated tests. The backend smoke test still needs its `ws` dependency installed and a live runtime check.

## Planned scope

- Classic board for 2–4 players
- Twelve character skins and four board themes
- Server-authoritative turns and moves
- Room lobby and reconnect support
- Text chat and short voice messages
- Mobile-first controls and safe-area layout

See [ROADMAP.md](./ROADMAP.md) and [DESIGN-SPEC.md](./DESIGN-SPEC.md) once the integrated source is committed.
