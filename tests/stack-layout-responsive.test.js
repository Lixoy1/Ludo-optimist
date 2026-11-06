import test from 'node:test';
import assert from 'node:assert/strict';
import { getStackLayout } from '../src/stack-layout.js';
test('four pawns form a compact 2x2 group inside one logical tile',()=>{const cell=43.57,layout=getStackLayout(4,cell);assert.equal(layout.positions.length,4);assert.equal(layout.hiddenCount,0);assert.equal(layout.scale,.56);const diameter=cell*.875*layout.scale;assert.ok(diameter<cell*.55);for(const p of layout.positions){assert.ok(Math.abs(p.x)+diameter/2<cell/2);assert.ok(Math.abs(p.y)+diameter/2<cell/2);}});
test('overflow remains explicitly represented',()=>{const layout=getStackLayout(6,43.57);assert.equal(layout.positions.filter(p=>p.visible).length,4);assert.equal(layout.hiddenCount,2);});
