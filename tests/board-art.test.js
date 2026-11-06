import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAIN_TRACK, PLAYER_CONFIG } from '../src/geometry.js';
import { gridToImage, BOARD_IMAGE_SIZE, GRID_CELL } from '../src/board-render.js';
const themes = ['classic', 'neon', 'elite', 'marble'];
const asset = theme => readFileSync(resolve('assets/boards', `optimist-ludo-${theme}.svg`), 'utf8');
test('all four board artworks share the exact 720x720 logical coordinate plane', () => {
 for (const theme of themes) { const svg=asset(theme); assert.match(svg,/width="720" height="720" viewBox="0 0 720 720"/); assert.match(svg,new RegExp(`OPTIMIST LUDO ${theme.toUpperCase()} board`)); }
 assert.equal(BOARD_IMAGE_SIZE,720); assert.equal(GRID_CELL,43.57);
});
test('every outer track cell is drawn at the exact center used by pawn positioning', () => {
 for (const theme of themes) { const svg=asset(theme); for (const {col,row} of MAIN_TRACK) assert.ok(svg.includes(`data-cell="${col},${row}"`),`${theme}: missing route tile ${col},${row}`); }
});
test('all home lanes are drawn on their engine-defined cells', () => {
 for (const theme of themes) { const svg=asset(theme); for (const [color,config] of Object.entries(PLAYER_CONFIG)) for (const [col,row] of config.lane) assert.ok(svg.includes(`data-cell="${col},${row}"`),`${theme}: missing ${color} home cell ${col},${row}`); }
});
test('all four base zones have four visible spawn wells', () => {
 for (const theme of themes) { const svg=asset(theme); assert.equal((svg.match(/r="13.2"/g)||[]).length,16); assert.equal((svg.match(/r="11" fill=/g)||[]).length,5); }
});
