# OPTIMIST LUDO — PENTA / HEX classic board specification

## Classic layout selected
We use the classic radial Ludo construction shown in the five- and six-player references, not a ring of randomly placed markers.

Every arm is a **3-column × 6-row grid**:
- left flank: six shared-route squares;
- outer connector: one shared-route square;
- right flank: six shared-route squares;
- middle column, remaining five squares: the owner's private home lane.

This gives 13 shared-route squares per arm, so PENTA has 65 and HEX has 78. A player's triangular yard sits between two neighboring arms. Its four recessed pawn wells are arranged 2×2. The player's start square is the outer-left cell of its matching arm, immediately beside its yard. Its home lane runs down the same arm's middle column.

## Rules and board counts

| Detail | PENTA | HEX |
|---|---:|---:|
| Seats | 5 | 6 |
| Shared route | 65 | 78 |
| Cells per arm | 13 | 13 |
| Grid per arm | 3 × 6 | 3 × 6 |
| Private home lane | 5 | 5 |
| Safe squares | 10 | 12 |
| Pawn wells per seat | 4 | 4 |
| Finish sockets per seat | 4 | 4 |
| Total pawns | 20 | 24 |

Each seat has two safe cells: its start square and the star eight route steps after its start. The game loop is continuous: every consecutive route-cell centre, including the transition between arms and the closing connection, is exactly one cell pitch apart.

## Coordinate system and dimensions

- SVG coordinate plane: 720 × 720, square.
- Board radius to outer start cells: 260 SVG units.
- Grid cell pitch is calculated separately for N=5 and N=6 so the 13-cell U-shaped arm endpoints meet the next arm exactly.
- PENTA cell pitch: 35.976 SVG units; tile face: 31.299 units.
- HEX cell pitch: 33.626 SVG units; tile face: 29.255 units.
- Tile face is 87% of pitch, leaving a consistent gap and metallic bevel.
- The central N-gon is sized so its side edges meet the inner edge of the final home-lane cell.
- Each base is a triangular wedge between adjacent arms, with four wells inside its boundary.
- The central finish is divided into N colored wedges, each with four individual finish sockets.

## Pawn art and mobile hit areas

- Single pawn art diameter: 82% of the local cell pitch.
- Two pawns: 68% scale with ±0.15-cell horizontal offsets.
- Three pawns: 64% scale with triangular offsets.
- Four pawns: 61% scale in a 2×2 formation with ±0.17-cell offsets.
- Four-pawn cluster bounding box remains smaller than the tile face.
- Base-well bezel diameter is 32.4 SVG units; it fits one normal pawn without clipping.
- On a 375 px-wide phone preview, the artwork scales uniformly; the square board is never stretched.
- Touch target remains 48 × 48 CSS px and is independent from the small pawn artwork. Because route cells are narrower than 48 px on a phone, input should resolve the nearest active cell centre; when several movable pawns occupy it, open the existing token chooser rather than overlaying many competing 48 px buttons.
- The dice dock remains outside the board art and keeps its mobile safe-area inset.

## Visual language
All eight PENTA/HEX assets use one grid and one set of coordinates; only surface materials and trim change:
- CLASSIC: warm oak / ivory tiles / champagne-gold edging.
- NEON: dark graphite / restrained violet-cyan ambience / bright gold metal / jewel-colour lanes.
- ELITE: dark walnut / rich gold edging / warm ivory cells.
- MARBLE: cool slate / pale marble cells / platinum-blue trim.

The original four-player board's visual hierarchy is retained: square light track tiles, coloured private lane, dark colour yard, four recessed pawn positions, metallic outlines, and a compact crowned centre. The five-/six-player form changes the geometry, not the visual vocabulary.

## Integration boundary
The SVGs and geometry data are ready as a design/coordinate foundation. The live room manager, Classic rules engine, and room creation API still accept Classic 2–4 only. PENTA and HEX are not selectable/playable online until server movement, player colours, token rendering, room size, and complete multiplayer tests are connected.

## Measured art dimensions (720 × 720 viewBox)
All dimensions below are SVG units, derived from the shared radial cell pitch rather than guessed independently per screen.

| Measure | PENTA | HEX |
|---|---:|---:|
| Logical cell pitch | 35.98 | 33.63 |
| Visible square tile | 31.30 | 29.25 |
| Single pawn art diameter | 29.50 | 27.57 |
| Four-token pawn diameter | 18.00 | 16.82 |
| Four-token cluster outer span | 30.23 | 28.25 |
| Base socket outer diameter | 34.54 | 32.28 |
| Base socket inner diameter | 30.94 | 28.92 |

The four-token cluster span stays below the tile face (30.23 < 31.30 for PENTA; 28.25 < 29.25 for HEX). Base yards use a true 2×2 pawn layout: two rows, two columns, with center spacing chosen to keep the four pawn silhouettes distinct. Socket rims are deliberately larger than the pawn diameter to leave a visible metallic bezel.

The board artwork is vector and scales proportionally. Pawn art size follows the local cell pitch; pointer/tap targets are a separate 48 CSS px layer and must not be scaled down with the artwork.
