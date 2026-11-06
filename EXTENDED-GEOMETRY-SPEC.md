# OPTIMIST LUDO — extended board geometry

## Research basis
- SECUSO Privacy Friendly Ludo is an open-source GPL-3.0 app supporting up to six seats; used only as proof that 6-seat Ludo exists. No source code, artwork, screenshots or branding are copied.
- PlayLudo's 5/6-player guide describes one arm per player, five home cells and 13 shared-track cells per arm (65 for PENTA, 78 for HEX).
- LudoLive describes a different variant: 55/66 shared cells and four home cells. OPTIMIST LUDO adopts the 13-per-arm / five-home-cell variant and does not mix rule sets.
- All geometry coordinates and SVG artwork here are original OPTIMIST LUDO work.

## Geometry contract
- Artwork plane: 720×720 SVG viewBox.
- DIAMOND: 4 players, 52 outer cells, 5 home cells per player, 8 safe cells.
- PENTA: 5 players, 65 outer cells, 5 home cells per player, 10 safe cells.
- HEX: 6 players, 78 outer cells, 5 home cells per player, 12 safe cells.
- Every side contributes 13 unique route cells. Start is the middle cell of that side; home entry is the previous route cell; the second safe cell is seven spaces after start.
- Every seat owns four base wells, five home-lane cells and four separate finish wells.
- Seat five/six colors are PURPLE and ORANGE, in addition to RED/BLUE/GREEN/YELLOW.
- Finish pocket radii from board center: DIAMOND 100, PENTA 105, HEX 110 SVG units. This leaves the center logo clear and separates each player's four finish wells.
- Geometry and material theme are independent: each geometry has CLASSIC, NEON, ELITE and MARBLE SVGs.

## Phone sizing and touch
- Single pawn art diameter = 0.82× local cell spacing, not a global CSS percentage.
- Stacks use local cell-relative sizing and offsets: 1 pawn 100%; 2 pawns 48% at ±0.21 cell; 3 pawns 46% triangular; 4 pawns 43% in 2×2 at ±0.22 cell. These keep miniatures within the route-cell footprint.
- Hit area stays 48×48 CSS px and is independent from art size. When multiple movable pawns share a cell, use nearest-cell resolution and token chooser.
- At narrow widths use explicit board zoom/pan rather than shrinking art or tap targets.
- Preserve the bottom dice dock and mobile safe-area.

## Implementation status
The SVGs and coordinate definitions are the original artwork/design foundation. The live RoomManager, Classic rules engine and room API still use Classic-only (2–4 players). Do not expose DIAMOND/PENTA/HEX as playable room options until geometry-aware server rules, seat/color allocation, token renderer, movement/capture logic and multiplayer tests are integrated.
