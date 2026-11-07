# OPTIMIST LUDO 2.0 — HEXA / ROYAL geometry specification

This document is the source-of-truth contract for the two non-Classic boards. Logical route coordinates are independent of SVG painting and are exported from `src/extended-geometries.js`.

## Board contracts

| Detail | HEXA | ROYAL |
|---|---:|---:|
| Seats | 6 | 4 |
| Outer route cells | 72 | 68 |
| Maximum outer step | 71 | 66 |
| Cells per sector | 12 | 17 |
| Private home lane | 6 | 7 |
| Safe cells | 12 | 12 |
| Safe cells per seat | 2 | 3 |
| Pawn wells per seat | 4 | 4 |
| Finish sockets per seat | 4 | 4 |
| Total pawns | 24 | 16 |
| Native canvas | 2560 × 2560 | 2816 × 2816 |
| SVG viewBox | 720 × 720 | 720 × 720 |
| Native cell pitch | 128 | 128 |
| SVG cell pitch | 36.00 | 32.7273 |

Classic remains a separate 52-cell, four-colour route with five home cells. Its canonical coordinates are in `src/geometry.js`.

## HEXA topology

HEXA is a six-arm radial board. The 72-cell loop consists of six 12-cell sectors. Each sector is a U-shaped rail: five cells on the right rail, one inner bridge, five cells on the next arm's left rail, and one outer bridge. Both bridges are part of the playable loop. Every consecutive pair of route centres, including sector joins and the closing link, is exactly one native cell pitch apart.

Seat starts are at route indices 0, 12, 24, 36, 48 and 60. Each seat has a star six steps after its start. The home-entry index is `(startIndex + 71) % 72`; the six home cells continue one pitch at a time toward the centre. Finishing requires landing on step 78 exactly.

## ROYAL topology

ROYAL has a four-sided perimeter loop with 17 cells per side. Its 68 unique route centres are separated by exactly one native cell pitch, including the four side joins and the closing link.

Seat starts are at indices 0, 17, 34 and 51. Each seat has safe cells at its start, six steps after its start, and twelve steps after its start. The home-entry index is `(startIndex + 66) % 68`. The seven-cell home lane begins with an inward turn from the perimeter and continues at one-pitch intervals toward the central finish. Finishing requires landing on step 74 exactly.

## Coordinate and movement invariants

- One native grid pitch is 128 units for all three boards.
- Each outer route index is unique and each route centre is unique.
- The home-entry cell is the last outer cell for that seat; the first home cell is exactly one pitch beyond it.
- All later home cells are also one pitch apart.
- Home lanes may not overlap one another or the shared outer route.
- Base wells and finish sockets must be separated by at least the pawn-art diameter.
- Every track, home, base and finish anchor remains inside the 720 × 720 artwork.
- The server's `maxOuterSteps`, `homeCellCount` and `finishStep` are the authoritative movement boundaries. Renderer indices are derived from `maxOuterSteps + 1`, not from route length.

## Pawn art and stack layout

Single pawns use the board-specific diameter derived from local cell pitch. Two to four pawns on one route cell use a compact 2×2 cluster with all four visible. Overflow beyond four is represented by a count badge; hidden overflow pawns keep their logical token identities and remain addressable through the token chooser. Hit targets remain a separate UI layer and are not scaled with the artwork.

## Themes and assets

Each board supports CLASSIC, NEON, ELITE and MARBLE material themes. Theme changes must not change route centres, home lanes, bases, safe indices or finish anchors. The eight generated files are:

- `optimist-ludo-hexa-{classic,neon,elite,marble}.svg`
- `optimist-ludo-royal-{classic,neon,elite,marble}.svg`

All boards use a 720 × 720 viewBox. Rebuild vector assets with `npm run build:extended-boards`; `npm run build` regenerates Classic and extended board assets together.

## Validation contract

`assertExtendedGeometry` and `tests/extended-geometries.test.js` validate board counts, unique route indices/centres, one-pitch continuity for every outer and home link, safe cells, player seat alignment, non-overlapping home lanes, base and finish clearances, SVG bounds and all theme asset markers. Server movement and token rendering are tested separately against the same geometry.
