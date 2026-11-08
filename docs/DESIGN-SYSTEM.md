# OPTIMIST LUDO — visual design system

## Product layout

The board is the main visual surface. Player status, current turn and compact chat stay secondary. The primary dice action is large, fixed and centered below the board. On mobile, the playing surface must remain readable without horizontal scrolling.

The same game state must render consistently in lobby preview, active player view and observer view. Spectators can read the table and participate in chat, but must not see enabled game controls.

## Geometry is not artwork

The logical geometry is authoritative. Theme work may change materials, lighting, trim, surface texture, color and decoration; it must not move or resize route centres, safe markers, bases, home lanes, finish slots or tap targets.

All themes retain the 720 × 720 SVG viewBox and preserve the same `data-cell` IDs for a given geometry. The three board modes stay distinct:

- CLASSIC: 4 seats, 52 outer cells, 5 home cells per seat.
- HEXA: 6 seats, 72 outer cells, 6 home cells per seat.
- ROYAL: 4 seats, 68 outer cells, 7 home cells per seat.

## Theme direction

- **CLASSIC** — warm light oak, satin brass, ivory enamel cells and clear colored player zones. Familiar and approachable.
- **NEON** — deep graphite / black chrome, restrained luminous rails, crisp electric blue, cyan, magenta and lime accents. Glow must not blur cell boundaries.
- **ELITE** — dark walnut, brushed gold, deep jewel-toned enamel and subtle embossed detailing. Luxury without visual clutter.
- **MARBLE** — cool slate and blue-grey stone, platinum trim, pale polished cells and restrained icy highlights.

Keep the Optimist brand mark on the frame or central medallion only when it does not cover a playable cell or finish socket. Avoid large labels across the centre.

## Piece and interaction system

Character pawns need one consistent pivot and visual footprint across themes. Stack layout must preserve visibility at 1–4 pieces and show overflow clearly above four. The active move, selected pawn, safe cell and last move need distinct states that remain visible on both bright and dark surfaces.

Minimum acceptance checks:
1. All route and home cells align with the coordinate map.
2. No pawn socket, frame, label or ornament overlaps a playable cell.
3. Four pawns on one route cell remain distinguishable on a narrow phone.
4. Four finish pawns remain individually visible.
5. Dice, chat, voice and observer states remain operable at mobile width.
6. Visual assets regenerate or validate deterministically in CI.
