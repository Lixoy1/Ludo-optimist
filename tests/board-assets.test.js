import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MAIN_TRACK, PLAYER_CONFIG, SAFE_TRACK_INDICES } from '../src/geometry.js';
import { GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_CELL, BOARD_IMAGE_SIZE, BASE_SLOT_POINTS, FINISH_POINTS } from '../src/board-render.js';

const THEMES = ['classic', 'neon', 'elite', 'marble'];
const readBoard = (theme) => readFile(resolve('assets/boards', \`optimist-ludo-\${theme}.svg\`), 'utf8');
const fmt = (value) => Number(value.toFixed(2));

test('all four vector themes share the same 720px high-DPI coordinate contract', async () => {
  const svgs = await Promise.all(THEMES.map(readBoard));
  assert.equal(BOARD_IMAGE_SIZE, 720);
  for (const [index, svg] of svgs.entries()) {
    assert.match(svg, /width="1440" height="1440" viewBox="0 0 720 720"/);
    assert.match(svg, new RegExp(\`data-theme="\${THEMES[index]}"\`));
    assert.equal((svg.match(/data-track-index=/g) || []).length, 52);
    assert.equal((svg.match(/data-home-color=/g) || []).length, 20);
    assert.equal((svg.match(/data-base=/g) || []).length, 4);
    assert.equal((svg.match(/data-finish-slot=/g) || []).length, 4);
  }
  const signature = (svg) => [...svg.matchAll(/data-(?:track-index|home-color|finish-slot|base)="[^"]*"[^>]*?(?:data-grid="[^"]*")?(?:data-center="[^"]*")?/g)].map((match) => match[0]);
  for (const svg of svgs.slice(1)) assert.deepEqual(signature(svg), signature(svgs[0]));
});

test('SVG track and home-lane centers match canonical game geometry', async () => {
  const svg = await readBoard('neon');
  for (const cell of MAIN_TRACK) {
    const x = fmt(GRID_ORIGIN_X + cell.col * GRID_CELL);
    const y = fmt(GRID_ORIGIN_Y + cell.row * GRID_CELL);
    assert.match(svg, new RegExp(\`data-track-index="\${cell.index}" data-grid="\${cell.col},\${cell.row}" data-center="\${x},\${y}"\`));
  }
  for (const [color, config] of Object.entries(PLAYER_CONFIG)) {
    for (const [index, [col, row]] of config.lane.entries()) {
      const x = fmt(GRID_ORIGIN_X + col * GRID_CELL);
      const y = fmt(GRID_ORIGIN_Y + row * GRID_CELL);
      assert.match(svg, new RegExp(\`data-home-color="\${color}" data-home-index="\${index}" data-grid="\${col},\${row}" data-center="\${x},\${y}"\`));
    }
  }
  assert.equal(SAFE_TRACK_INDICES.size, 8);
  for (const [color, centers] of Object.entries(BASE_SLOT_POINTS)) {
    for (const [x, y] of centers) assert.match(svg, new RegExp(\`circle cx="\${x}" cy="\${y}" r="22.5"\`));
  }
  for (const [x, y] of FINISH_POINTS) assert.match(svg, new RegExp(\`data-finish-slot="\${x},\${y}"\`));
});
