# OPTIMIST LUDO board assets

The active release has exactly three board geometries and four visual themes:

| Geometry | Classic | Neon | Elite | Marble |
|---|---|---|---|---|
| CLASSIC | `optimist-ludo-classic.svg` | `optimist-ludo-neon.svg` | `optimist-ludo-elite.svg` | `optimist-ludo-marble.svg` |
| HEXA | `optimist-ludo-hexa-classic.svg` | `optimist-ludo-hexa-neon.svg` | `optimist-ludo-hexa-elite.svg` | `optimist-ludo-hexa-marble.svg` |
| ROYAL | `optimist-ludo-royal-classic.svg` | `optimist-ludo-royal-neon.svg` | `optimist-ludo-royal-elite.svg` | `optimist-ludo-royal-marble.svg` |

All SVGs use a 720 × 720 viewBox. The logical cell IDs and positions are part of the playable interface: artwork must preserve them exactly.

- CLASSIC artwork is authored vector art. `npm run validate:classic-boards` checks its cells, pawn anchors, finish anchors and safe markers without rewriting the files.
- HEXA and ROYAL artwork is generated from the canonical geometry in `src/extended-geometries.js` by `npm run build:extended-boards`.
- `npm run build` validates CLASSIC, regenerates HEXA/ROYAL, then exports `Coordinates_Map.json`.
- Do not bring back old PENTA, HEX or DIAMOND board assets. The active product contract is CLASSIC / HEXA / ROYAL.
- These are the current functional vector themes, not a final approval of the next premium art pass. Any redesign must keep geometry, hit targets, token anchors and route IDs unchanged.
