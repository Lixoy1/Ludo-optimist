# Open-source research — classic 5/6-player Ludo

## Public references consulted
- PlayLudo, “Ludo for 5 and 6 Players: How Bigger Games Work”: https://play-ludo.com/blog/ludo-for-5-and-6-players
  - Describes one arm per player; each arm has three columns of squares and a central home column.
  - Describes several commercial multi-player board topologies. These sources are background references only; the OPTIMIST LUDO 2.0 HEXA and ROYAL layouts are custom topologies with their own route counts.
- PlayLudo, “Ludo Safe Squares (Stars) Explained”: https://play-ludo.com/blog/ludo-safe-squares-explained
  - Confirms common Ludo safe-square conventions. OPTIMIST LUDO uses its own documented safe-index contract per board.
- Mas Que Puzzles, Parchís para 5 jugadores: https://masquepuzzles.com/parchis/59-parchis-5.html
  - Used only as a visual cross-check for the pentagon outline, triangular home yards, square track tiles, and central coloured finish. No image, texture, or source artwork copied.
- Small Foot, Ludo for 6 Players instructions: https://b2b.small-foot.de/media/articles/pdf/1800_Ludo_fuer_6_Spieler.pdf
  - Used as a second six-player layout/rules cross-check. No PDF artwork copied.

## Chosen ruleset
Commercial Ludo variants differ in route length, safe-square rules and home-lane length. OPTIMIST LUDO 2.0 defines its own explicit contracts: CLASSIC 52/5, HEXA 72/6 and ROYAL 68/7 (outer route / home cells). These variants are not mixed.

## Implementation status
The 2.0 board family is CLASSIC, HEXA and ROYAL. HEXA and ROYAL use separate 72- and 68-cell outer routes with six- and seven-cell home lanes. Their server, room API, lobby, renderer, geometry generator and SVG themes share the same board contracts; all visual themes must preserve their logical geometry.

## Original work
All coordinates, SVG illustrations, materials, colours, cell bevels, triangular yards, pawn wells, and finish sockets in this repository are newly authored for OPTIMIST LUDO. Third-party references are used only for general board topology and public rule descriptions.
