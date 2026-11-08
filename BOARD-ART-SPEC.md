# OPTIMIST LUDO — Board artwork specification
## Coordinate contract
- SVG artwork: 720×720 viewBox; square aspect ratio.
- Logical grid: 15×15.
- Cell center: x = 55 + column × 43.57; y = 55 + row × 43.57.
- Track tile face: 38.4×38.4 units, centered on the same logical cell as src/board-render.js.
- Outer route: the engine's 52 unique cells from src/geometry.js.
- Home lanes: five colored approach cells per player; center is the finish.
- Base spawn wells: four per player, aligned with BASE_SLOT_POINTS in src/board-render.js.
- Player yards: blue top-left, red top-right, green bottom-left, yellow bottom-right.
- Safe indices: 0, 8, 13, 21, 26, 34, 39, 47; four starts use team colors, four additional cells have stars.
## Pawn sizing
- Single pawn: 5.3% of stage width (about 0.875 route-tile diameter).
- Two: 0.64 scale; three: 0.60; four: 0.56 in a 2×2 cluster.
- Stack offsets: 0.19 cell for two, 0.20 for three and 0.22 for four; visible miniatures remain within the tile.
- Touch target remains 48×48 CSS px on mobile; hit targets are larger than visual pawns.
- More than four tokens show four miniatures plus an overflow badge.
## Responsive behavior
- Board remains square and fluid, maximum stage width 650 CSS px.
- SVG artwork is vector; it stays crisp on high-density screens.
- Narrow screens use available content width; 48px touch targets are preserved.
- Dice dock remains separate and respects safe-area inset.
## Themes
All four SVGs share identical route, lane, safe-cell and spawn coordinates. Only materials, finish and lighting change:
- CLASSIC: light oak and warm ivory.
- NEON: black chrome and cyan-violet light.
- ELITE: dark walnut and gold inlay.
- MARBLE: cool marble and platinum.
A visual theme never changes game rules, board geometry or hit targets.


## Extended 2.0 boards

HEXA and ROYAL use the same Optimist Ludo visual language as the Classic reference: dark enamel board plate, multi-tone metal frame, player-colour neon wells, ivory marble route tiles, gold safe stars, crowned finish medallion and character pawns. The renderer is `renderExtendedBoardSvg()` in `src/extended-geometries.js`; `scripts/build-extended-boards.js` generates all four themes per geometry.

The renderer reads the canonical route/home/base/finish coordinates and does not recalculate or move them. SVG cells expose `data-track-cell`, `data-home-cell`, `data-center`, `data-base-slot`, `data-finish-slot` and `data-safe-cell` attributes for automated audits. The six character images used by HEXA and ROYAL in `assets/boards/characters/board/` have compact 96×96 WebP board portraits. The build embeds those portraits directly into each generated SVG, so Mini App image rendering does not depend on loading external SVG subresources.

| Board | Players | Outer cells | Home cells per player | Finish progress |
|---|---:|---:|---:|---:|
| CLASSIC | 4 | 52 | 5 | 56 |
| HEXA | 6 | 72 | 6 | 78 |
| ROYAL | 4 | 68 | 7 | 74 |

Theme palettes vary the metal, glow and marble tones; artwork style, tile footprints, logical centers and player anchors remain shared and geometry-driven.
