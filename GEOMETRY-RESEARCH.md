# Open-source research — classic 5/6-player Ludo

## Public references consulted
- PlayLudo, “Ludo for 5 and 6 Players: How Bigger Games Work”: https://play-ludo.com/blog/ludo-for-5-and-6-players
  - Describes one arm per player; each arm has three columns of squares and a central home column.
  - Describes triangular yards, five-player pentagon, six-player hexagon, and route counts 65/78 with five home cells and two safe cells per arm.
- PlayLudo, “Ludo Safe Squares (Stars) Explained”: https://play-ludo.com/blog/ludo-safe-squares-explained
  - Confirms two safe positions per arm: start and star; its standard star position is eight squares after the start.
- Mas Que Puzzles, Parchís para 5 jugadores: https://masquepuzzles.com/parchis/59-parchis-5.html
  - Used only as a visual cross-check for the pentagon outline, triangular home yards, square track tiles, and central coloured finish. No image, texture, or source artwork copied.
- Small Foot, Ludo for 6 Players instructions: https://b2b.small-foot.de/media/articles/pdf/1800_Ludo_fuer_6_Spieler.pdf
  - Used as a second six-player layout/rules cross-check. No PDF artwork copied.

## Chosen ruleset
Some commercial Ludo variants use shorter 55/66-cell laps and four-cell home lanes. OPTIMIST LUDO intentionally chooses the 65/78-cell, five-home-cell ruleset above. These variants are not mixed.

## Implementation status
The chosen 65/78 route model is implemented in the PENTA and HEX server-authoritative modes and is connected to the room API, lobby capacity selection, SVG theme switching, and pawn rendering. The exact house rules are documented in `RULES.md`. DIAMOND remains a showcase illustration and is not a network mode.

## Original work
All coordinates, SVG illustrations, materials, colours, cell bevels, triangular yards, pawn wells, and finish sockets in this repository are newly authored for OPTIMIST LUDO. Third-party references are used only for general board topology and public rule descriptions.
