# OPTIMIST LUDO — extended board geometry

## Research basis
- SECUSO Privacy Friendly Ludo is an open-source GPL-3.0 app supporting up to six seats. It proves a classic Ludo ruleset can be adapted to a 6-seat board. OPTIMIST LUDO does not copy its code, artwork, screenshots or branding.
- PlayLudo's 5/6-player guide describes one arm per player, triangular token yards, five home cells and 13 shared-track cells per arm (65 for PENTA, 78 for HEX).
- LudoLive describes a different house-rule variant: 55/66 shared cells and four home cells. OPTIMIST LUDO chooses the 13-per-arm / five-home-cell variant; the two rule sets must not be mixed.
- All coordinates and SVG artwork here are original OPTIMIST LUDO work.

## Geometry contract
- Artwork plane: 720×720 SVG viewBox, square and vector.
- DIAMOND: 4 players, 52 outer cells, 5 home cells per player, 8 safe cells.
- PENTA: 5 players, 65 outer cells, 5 home cells per player, 10 safe cells.
- HEX: 6 players, 78 outer cells, 5 home cells per player, 12 safe cells.
- Every arm has exactly 13 unique outer route cells.
- Each player's start is at the middle of its side; home entry is the previous route cell; second safe cell is seven spaces after its start.
- Every seat has four base wells, five home-lane cells and four separate finish wells.
- Seats five and six add PURPLE and ORANGE; RED/BLUE/YELLOW/GREEN remain.
- Geometry and materials are independent: every geometry has CLASSIC, NEON, ELITE and MARBLE SVGs.

## Phone sizing and touch
- Board is always square with a 720×720 vector coordinate plane.
- Pawn art must be sized from the local cell width, not Classic's global width.
- Recommended single-pawn diameter: 0.9× local track-cell width; stack scales: 100%, 64%, 60%, 56% for 1–4 pawns.
- Touch target stays independent of art size: 48×48 CSS px. A shared cell opens the existing token chooser when several own pawns are legal.
- On very narrow screens, provide explicit zoom/pan rather than making pawns or targets unusably small.
- Preserve the bottom dice dock and safe-area spacing.

## Implementation status
The extended geometry data and vector assets are now prepared. The live RoomManager, Classic rules engine and room API are still Classic-only (2–4 players). Do not expose DIAMOND/PENTA/HEX as playable room options until geometry-aware server rules, seat/color allocation, token rendering and multiplayer end-to-end tests are connected.
