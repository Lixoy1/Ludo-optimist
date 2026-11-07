import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EXTENDED_GEOMETRIES, BOARD_THEMES, assertExtendedGeometry, distance,
  getExtendedStackLayout, renderExtendedBoardSvg,
} from '../src/extended-geometries.js';

const expected = {
  hexa: { sides:6, track:72, maxOuter:71, home:6, finish:78, safe:12 },
  royal: { sides:4, track:68, maxOuter:66, home:7, finish:74, safe:12 },
};
const themes = Object.keys(BOARD_THEMES);
const asset = (id,theme) => readFileSync(
  resolve('assets/boards','optimist-ludo-'+id+'-'+theme+'.svg'),'utf8'
);

for (const [id,contract] of Object.entries(expected)) {
  test(id.toUpperCase()+' geometry matches the canonical 2.0 board contract',()=>{
    const geometry=EXTENDED_GEOMETRIES[id];
    assert.deepEqual({
      sides:geometry.sides, track:geometry.trackLength,
      maxOuter:geometry.maxOuterSteps, home:geometry.homeCells,
      finish:geometry.finishStep, safe:geometry.safeIndices.length,
    },contract);
    assert.equal(geometry.arms.length,contract.sides);
    assert.equal(geometry.track.length,contract.track);
    assert.equal(assertExtendedGeometry(geometry),true);
  });

  test(id.toUpperCase()+' outer loop is continuous with exactly one cell pitch per move',()=>{
    const geometry=EXTENDED_GEOMETRIES[id];
    assert.equal(new Set(geometry.track.map(cell=>cell.index)).size,contract.track);
    assert.equal(new Set(geometry.track.map(cell=>cell.nativeX+','+cell.nativeY)).size,contract.track);
    for(let index=0;index<geometry.track.length;index++) {
      const current=geometry.track[index],next=geometry.track[(index+1)%geometry.track.length];
      assert.ok(Math.abs(distance(current,next)-geometry.cellPitch)<.03,
        id+' route link '+index+' -> '+((index+1)%geometry.track.length));
    }
  });

  test(id.toUpperCase()+' starts, home entries, and home lanes are connected for every seat',()=>{
    const geometry=EXTENDED_GEOMETRIES[id];
    for(const arm of geometry.arms) {
      assert.equal(arm.homeEntryIndex,(arm.startIndex+geometry.maxOuterSteps)%geometry.trackLength);
      assert.equal(geometry.safeIndices.includes(arm.startIndex),true);
      assert.equal(geometry.safeIndices.includes(arm.starIndex),true);
      const entry=geometry.track[arm.homeEntryIndex];
      assert.ok(Math.abs(distance(entry,arm.homeLane[0])-geometry.cellPitch)<.03);
      for(let index=0;index<arm.homeLane.length-1;index++) {
        assert.ok(Math.abs(distance(arm.homeLane[index],arm.homeLane[index+1])-geometry.cellPitch)<.03);
      }
    }
  });

  test(id.toUpperCase()+' has four non-overlapping base wells and four finish sockets per player',()=>{
    const geometry=EXTENDED_GEOMETRIES[id];
    for(const arm of geometry.arms) {
      assert.equal(arm.baseSlots.length,4);
      assert.equal(arm.finishSlots.length,4);
      for(let a=0;a<4;a++) for(let b=a+1;b<4;b++) {
        assert.ok(distance(arm.baseSlots[a],arm.baseSlots[b])>geometry.pawnDiameter*.98);
        assert.ok(distance(arm.finishSlots[a],arm.finishSlots[b])>
          geometry.pawnDiameter*geometry.finishPawnScale*.98);
      }
    }
  });

  test(id.toUpperCase()+' coordinates stay inside the 720px canvas and do not overlap',()=>{
    const geometry=EXTENDED_GEOMETRIES[id];
    const all=[
      ...geometry.track,
      ...geometry.arms.flatMap(arm=>[...arm.homeLane,...arm.baseSlots,...arm.finishSlots]),
    ];
    for(const point of all) {
      assert.ok(point.x>0&&point.x<720&&point.y>0&&point.y<720,
        id+' coordinate outside canvas: '+point.x+','+point.y);
    }
    assert.equal(assertExtendedGeometry(geometry),true);
  });

  test(id.toUpperCase()+' stack layout preserves all token identities and reports crowding',()=>{
    const geometry=EXTENDED_GEOMETRIES[id];
    assert.equal(getExtendedStackLayout(id,0).tokens.length,0);
    assert.equal(getExtendedStackLayout(id,1).tokens.length,1);
    assert.equal(getExtendedStackLayout(id,2).tokens.filter(token=>token.visible).length,2);
    const crowded=getExtendedStackLayout(id,4);
    assert.equal(crowded.tokens.length,4);
    assert.equal(crowded.tokens.filter(token=>token.visible).length,1);
    assert.equal(crowded.hiddenCount,3);
    assert.equal(crowded.badge,'×4');
    assert.ok(crowded.tokens[0].diameter<geometry.tileSize);
  });
}

test('all eight generated HEXA and ROYAL theme assets match the logical geometry',()=>{
  for(const [id,contract] of Object.entries(expected)) for(const theme of themes) {
    const svg=asset(id,theme);
    assert.match(svg,/width="720" height="720" viewBox="0 0 720 720"/);
    assert.match(svg,new RegExp('OPTIMIST LUDO '+id.toUpperCase()+' board'));
    assert.equal((svg.match(/data-track-cell=/g)||[]).length,contract.track);
    assert.equal((svg.match(/data-home-cell=/g)||[]).length,contract.sides*contract.home);
    assert.equal((svg.match(/data-base-slot=/g)||[]).length,contract.sides*4);
    assert.equal((svg.match(/data-finish-slot=/g)||[]).length,contract.sides*4);
    assert.equal((svg.match(/data-safe-cell=/g)||[]).length,contract.safe);
  }
});

test('runtime SVG generation reproduces all four themes without changing coordinates',()=>{
  for(const [id,contract] of Object.entries(expected)) for(const theme of themes) {
    const svg=renderExtendedBoardSvg(EXTENDED_GEOMETRIES[id],theme);
    assert.equal((svg.match(/data-track-cell=/g)||[]).length,contract.track);
    assert.equal((svg.match(/data-home-cell=/g)||[]).length,contract.sides*contract.home);
  }
  assert.equal(themes.length,4);
});
