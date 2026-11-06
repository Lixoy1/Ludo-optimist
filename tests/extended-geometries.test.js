import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXTENDED_GEOMETRIES, EXTENDED_THEMES, assertExtendedGeometry, distance, pointInTriangle, getExtendedStackLayout, renderExtendedBoardSvg } from '../src/extended-geometries.js';

const ids=['penta','hex'];
const themes=['classic','neon','elite','marble'];
const asset=(id,theme)=>readFileSync(resolve('assets/boards','optimist-ludo-'+id+'-'+theme+'.svg'),'utf8');

test('PENTA and HEX have the selected classic route lengths and player counts',()=>{
  assert.deepEqual([EXTENDED_GEOMETRIES.penta.sides,EXTENDED_GEOMETRIES.penta.trackLength],[5,65]);
  assert.deepEqual([EXTENDED_GEOMETRIES.hex.sides,EXTENDED_GEOMETRIES.hex.trackLength],[6,78]);
  for(const id of ids) assert.equal(assertExtendedGeometry(EXTENDED_GEOMETRIES[id]),true);
});

test('each arm is a classic 3-column x 6-row construction',()=>{
  for(const id of ids) {
    const g=EXTENDED_GEOMETRIES[id];
    assert.equal(g.gridColumns,3); assert.equal(g.gridRows,6);
    for(const arm of g.arms) {
      const cells=g.track.filter(cell=>cell.arm===arm.index);
      assert.equal(cells.length,13);
      assert.equal(cells.filter(cell=>cell.column===-1).length,6);
      assert.equal(cells.filter(cell=>cell.column===1).length,6);
      assert.equal(cells.filter(cell=>cell.column===0).length,1);
      assert.equal(arm.homeLane.length,5);
    }
  }
});

test('the shared route is one continuous loop with exact cell-pitch spacing',()=>{
  for(const id of ids) {
    const g=EXTENDED_GEOMETRIES[id];
    for(let i=0;i<g.track.length;i++) {
      const current=g.track[i],next=g.track[(i+1)%g.track.length];
      assert.ok(Math.abs(distance(current,next)-g.cellPitch)<.02,id+' route gap at '+i);
    }
  }
});

test('starts, home entries, and safe stars line up with the same arm',()=>{
  for(const id of ids) {
    const g=EXTENDED_GEOMETRIES[id];
    for(const arm of g.arms) {
      const start=g.track[arm.startIndex],entry=g.track[arm.homeEntryIndex],firstHome=arm.homeLane[0];
      assert.equal(start.arm,arm.index);
      assert.equal(start.column,-1); assert.equal(start.row,0);
      assert.equal(entry.index,(arm.startIndex-1+g.trackLength)%g.trackLength);
      assert.ok(Math.abs(distance(entry,firstHome)-g.cellPitch)<.02);
      assert.equal(arm.starIndex,(arm.startIndex+8)%g.trackLength);
    }
  }
});

test('each triangular yard contains four token wells and each finish wedge has four sockets',()=>{
  for(const id of ids) {
    const g=EXTENDED_GEOMETRIES[id];
    for(const arm of g.arms) {
      assert.equal(arm.baseSlots.length,4);
      assert.ok(arm.baseSlots.every(p=>pointInTriangle(p,arm.triangle)));
      assert.equal(arm.finishSlots.length,4);
      assert.equal(arm.homeLane.length,5);
    }
  }
});

test('all board coordinates and interactive pawn dimensions are mobile-safe',()=>{
  for(const id of ids) {
    const g=EXTENDED_GEOMETRIES[id];
    for(const p of [...g.track,...g.arms.flatMap(a=>[...a.baseSlots,...a.homeLane,...a.finishSlots])]) {
      assert.ok(p.x>0&&p.x<720&&p.y>0&&p.y<720);
    }
    const single=getExtendedStackLayout(id,1).tokens[0];
    const four=getExtendedStackLayout(id,4).tokens;
    assert.ok(single.diameter<g.tileSize);
    assert.equal(four.length,4);
    const bounds=four.reduce((m,p)=>({minX:Math.min(m.minX,p.x-p.diameter/2),maxX:Math.max(m.maxX,p.x+p.diameter/2),minY:Math.min(m.minY,p.y-p.diameter/2),maxY:Math.max(m.maxY,p.y+p.diameter/2)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
    assert.ok(bounds.maxX-bounds.minX<g.tileSize);
    assert.ok(bounds.maxY-bounds.minY<g.tileSize);
    assert.equal(g.touchTargetCssPx,48);
  }
});

test('all eight SVG boards share the same coordinate markers and required zones',()=>{
  for(const id of ids) for(const theme of themes) {
    const svg=asset(id,theme),g=EXTENDED_GEOMETRIES[id];
    assert.match(svg,/width="720" height="720" viewBox="0 0 720 720"/);
    assert.equal((svg.match(/data-track-cell=/g)||[]).length,g.trackLength);
    assert.equal((svg.match(/data-home-cell=/g)||[]).length,g.sides*5);
    assert.equal((svg.match(/data-base-slot=/g)||[]).length,g.sides*4);
    assert.equal((svg.match(/data-finish-slot=/g)||[]).length,g.sides*4);
    assert.equal((svg.match(/data-safe-cell=/g)||[]).length,g.sides);
  }
});

test('all four material themes render from the shared geometry without changing route counts',()=>{
  for(const id of ids) for(const theme of themes) {
    const svg=renderExtendedBoardSvg(EXTENDED_GEOMETRIES[id],theme);
    assert.equal((svg.match(/data-track-cell=/g)||[]).length,EXTENDED_GEOMETRIES[id].trackLength);
  }
  assert.equal(Object.keys(EXTENDED_THEMES).length,4);
});


test('PENTA and HEX pawn art and base sockets are sized from their own cell pitch',()=>{
  const expected={penta:{pitch:35.98,tile:31.30,pawn:29.50,stack:18.00,span:30.23},hex:{pitch:33.63,tile:29.25,pawn:27.57,stack:16.82,span:28.25}};
  for(const id of ids){
    const g=EXTENDED_GEOMETRIES[id],e=expected[id];
    assert.ok(Math.abs(g.cellPitch-e.pitch)<.02);
    assert.ok(Math.abs(g.tileSize-e.tile)<.02);
    assert.ok(Math.abs(g.cellPitch*g.pawnDiameterRatio-e.pawn)<.02);
    const four=getExtendedStackLayout(id,4).tokens;
    assert.ok(Math.abs(four[0].diameter-e.stack)<.02);
    const span=Math.max(...four.map(t=>t.x+t.diameter/2))-Math.min(...four.map(t=>t.x-t.diameter/2));
    assert.ok(Math.abs(span-e.span)<.03);
    assert.ok(span<g.tileSize);
    assert.ok(g.arms.every(a=>a.baseSlots.length===4));
  }
});


test('the four base wells form a true 2x2 layout with enough separation for pawn art',()=>{
  for(const id of ids){
    const g=EXTENDED_GEOMETRIES[id],diameter=g.cellPitch*g.pawnDiameterRatio;
    for(const arm of g.arms){
      const points=arm.baseSlots;
      for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)
        assert.ok(distance(points[a],points[b])>diameter,'base pawn silhouettes must not overlap');
    }
  }
});
