# OPTIMIST LUDO 2.0.0 — geometry collision audit

Audit scope: CLASSIC / HEXA / ROYAL  
Audit method: exact cell-footprint and pawn-circle intersection checks  
Latest passing commit: `d20ca985ca02225db686ff9364145f6e73f68912`  
CI: 118 tests passed, 0 failed (run `42413143199`)

## Frozen board contracts

| Metric | CLASSIC | HEXA | ROYAL |
|---|---:|---:|---:|
| Players | 4 | 6 | 4 |
| Outer route cells | 52 | 72 | 68 |
| Home lane cells per player | 5 | 6 | 7 |
| Native canvas | 2304² | 2560² | 2816² |
| SVG viewBox | 720² | 720² | 720² |
| Logical cell pitch in SVG | 43.57 px | 36.00 px | 32.7273 px |
| Rendered tile footprint | 38.00 px | 29.52 px | 26.8364 px |
| Single pawn art diameter | 27.20 px | 23.04 px | 22.2545 px |
| Base-zone radius | — | 68.40 px | 62.1818 px |

The route counts, home lengths and player counts remain unchanged. The new tile sizes only change the painted cell footprint and clearance, not route-centre coordinates or engine step counts.

## CLASSIC checks

- 52 unique route centres.
- 48 orthogonal route links and four explicit diagonal corner connectors. Each link is exactly one grid pitch or √2 grid pitches; no unexpected jump length is accepted.
- Each player home entry connects to the correct final outer cell; each five-cell home lane is continuous.
- All 20 home cells are unique and do not reuse outer-route cells or another player's home lane.
- The 38 px track/home tile rectangles are checked pairwise at their rendered coordinates.
- All base and finish pawn circles use the same 27.20 px art diameter and are checked against every track/home tile, against each other, and against canvas bounds.

## HEXA checks

- 72 unique route centres; every consecutive pair, including the closing link, is exactly 36 px apart.
- Six 12-cell sectors, six 6-cell home lanes, start/star safe cells and home-entry indices are validated.
- All 72 outer-tile squares are checked pairwise by the separating-axis theorem (SAT).
- All 36 home-tile squares are checked pairwise and against every outer-tile square by SAT.
- All six base-zone circles, 24 base pawn wells and 24 finish sockets are checked for overlap with route/home tiles, with one another where applicable, and against canvas bounds.
- Tile size is 29.52 px (82% of pitch). Single pawn diameter is 23.04 px. Four-pawn stack art is 12.60 px with 7.92 px offsets; total 2×2 stack span is 28.44 px, within the 29.52 px tile.
- The inner bridge's coordinate rotation is independent from its tile orientation. Its tile orientation bisects the neighbouring rail angles; this removes the previously detected bridge-square collisions.

## ROYAL checks

- 68 unique route centres; every consecutive pair, including the closing link, is exactly 32.7273 px apart.
- Four 17-cell perimeter sectors, four 7-cell home lanes, and the three-safe-cell-per-player contract are validated.
- All route/home rectangular footprints are checked pairwise and cross-checked by SAT.
- All four base-zone circles, 16 base pawn wells and 16 finish sockets are checked against route/home footprints and each other where applicable.
- Tile size is 26.8364 px (82% of pitch). Single pawn diameter is 22.2545 px. Four-pawn stack art is 11.4545 px with 7.20 px offsets; total stack span is 25.8545 px, within the 26.8364 px tile.
- The first home tile retains the inward-perimeter orientation; the lane's later cells keep the centreward orientation. The tile footprint was reduced so the turn does not cause overlap.

## SVG asset parity

All eight committed HEXA/ROYAL theme SVGs are checked against the logical geometry:
- exact count of track, home, base, finish and safe markers;
- each track/home rectangle's width and height match the geometry's `tileSize` within 0.015 px;
- runtime SVG generation is tested with the same footprint assertion.

The committed artwork was resized to the audited 82%-of-pitch footprint. `npm run build` regenerates Classic and all eight extended SVG assets from source.

## Collision algorithm

- Rotated cell rectangles use their full four-corner footprints and the separating-axis theorem; centre-distance-only checks are not used as a substitute.
- Pawn wells and finish sockets are circles. Circle-to-rotated-rectangle clearance is calculated in each cell's local axes using the nearest point on the rectangle.
- Circle-to-circle clearance checks compare the sum of radii.
- Tile polygon corners and circle bounds must remain inside the 720 × 720 canvas.

This is a geometric software audit, not a visual acceptance test on an Android device. Character-image alpha bounds, touch-target feel and final mobile appearance remain part of the later visual QA stage.
