import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MAIN_TRACK, PLAYER_CONFIG, SAFE_TRACK_INDICES, assertBoardGeometry } from '../src/geometry.js';
import {
  gridToImage, BASE_SLOT_POINTS, FINISH_POINTS, BOARD_IMAGE_SIZE, GRID_CELL,
} from '../src/board-render.js';

const THEMES = ['classic', 'neon'];
const readBoard = (theme) => readFile(resolve('assets/boards', `optimist-ludo-${theme}.svg`), 'utf8');
const tileMarkup = (svg, col, row) => svg.match(
  new RegExp(`<rect data-cell="${col},${row}" x="([^"]+)" y="([^"]+)" width="38.4" height="38.4"`),
);

assertBoardGeometry();
assert.equal(BOARD_IMAGE_SIZE, 720);
assert.equal(GRID_CELL, 43.57);

for (const theme of THEMES) {
  const svg = await readBoard(theme);
  assert.match(svg, /width="720" height="720" viewBox="0 0 720 720"/, `${theme}: invalid SVG viewBox`);
  assert.match(svg, new RegExp(`OPTIMIST LUDO ${theme.toUpperCase()} board`), `${theme}: missing board title`);

  const cellIds = [...svg.matchAll(/data-cell="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(cellIds.length, 72, `${theme}: expected 52 track and 20 home cells`);
  assert.equal(new Set(cellIds).size, 72, `${theme}: duplicate logical cell`);

  for (const { col, row } of MAIN_TRACK) {
    const tile = tileMarkup(svg, col, row);
    assert.ok(tile, `${theme}: missing track cell ${col},${row}`);
    const point = gridToImage(col, row);
    assert.equal(tile[1], (point.x - 19.2).toFixed(2));
    assert.equal(tile[2], (point.y - 19.2).toFixed(2));
  }

  for (const config of Object.values(PLAYER_CONFIG)) {
    for (const [col, row] of config.lane) {
      const tile = tileMarkup(svg, col, row);
      assert.ok(tile, `${theme}: missing home cell ${col},${row}`);
      const point = gridToImage(col, row);
      assert.equal(tile[1], (point.x - 19.2).toFixed(2));
      assert.equal(tile[2], (point.y - 19.2).toFixed(2));
    }
  }

  for (const points of Object.values(BASE_SLOT_POINTS)) {
    for (const [x, y] of points) assert.ok(svg.includes(`<circle cx="${x}" cy="${y}" r="18.5"`));
  }
  for (const [x, y] of FINISH_POINTS) assert.ok(svg.includes(`<circle cx="${x}" cy="${y}" r="18.5"`));
  assert.equal((svg.match(/data-safe-index=/g) || []).length, 4);
}

process.stdout.write('Validated 4 authored CLASSIC themes: 52 track, 20 home, 16 base and 4 finish anchors each.\n');
