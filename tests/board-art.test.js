import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAIN_TRACK, PLAYER_CONFIG } from '../src/geometry.js';
import { gridToImage, BOARD_IMAGE_SIZE, GRID_CELL, BASE_SLOT_POINTS, FINISH_POINTS } from '../src/board-render.js';
const themes=['classic','neon','elite','marble'];
const asset=theme=>readFileSync(resolve('assets/boards',`optimist-ludo-${theme}.svg`),'utf8');
const tileMarkup=(svg,col,row)=>svg.match(new RegExp(`<rect data-cell="${col},${row}" x="([^"]+)" y="([^"]+)" width="38.4" height="38.4"`));
test('all four board artworks share the exact 720x720 logical coordinate plane',()=>{
 for(const theme of themes){const svg=asset(theme);assert.match(svg,/width="720" height="720" viewBox="0 0 720 720"/);assert.match(svg,new RegExp(`OPTIMIST LUDO ${theme.toUpperCase()} board`));}
 assert.equal(BOARD_IMAGE_SIZE,720);assert.equal(GRID_CELL,43.57);
});
test('all 52 route tiles match the renderer coordinates exactly',()=>{
 for(const theme of themes){const svg=asset(theme);for(const {col,row} of MAIN_TRACK){const tile=tileMarkup(svg,col,row);assert.ok(tile,`${theme}: missing track cell ${col},${row}`);const {x,y}=gridToImage(col,row);assert.equal(tile[1],(x-19.2).toFixed(2));assert.equal(tile[2],(y-19.2).toFixed(2));}}
});
test('all 20 home-lane tiles match engine coordinates exactly',()=>{
 for(const theme of themes){const svg=asset(theme);for(const [color,config] of Object.entries(PLAYER_CONFIG))for(const [col,row] of config.lane){const tile=tileMarkup(svg,col,row);assert.ok(tile,`${theme}: missing ${color} lane cell ${col},${row}`);const {x,y}=gridToImage(col,row);assert.equal(tile[1],(x-19.2).toFixed(2));assert.equal(tile[2],(y-19.2).toFixed(2));}}
});
test('all 16 base wells align with the token spawn points',()=>{
 for(const theme of themes){const svg=asset(theme);for(const [color,points] of Object.entries(BASE_SLOT_POINTS))for(const [x,y] of points)assert.ok(svg.includes(`<circle cx="${x}" cy="${y}" r="18.5"`),`${theme}: misaligned ${color} base well ${x},${y}`);}
});
test('four finish wells align with FINISH_POINTS and four safe stars are marked',()=>{
 for(const theme of themes){const svg=asset(theme);for(const [x,y] of FINISH_POINTS)assert.ok(svg.includes(`<circle cx="${x}" cy="${y}" r="18.5"`));assert.equal((svg.match(/data-safe-index=/g)||[]).length,4);}
});
