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

function assertSvgCellFootprints(svg,expectedSize,label) {
  const groups=[
    ...svg.matchAll(/<g data-track-cell="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g),
    ...svg.matchAll(/<g data-home-cell="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g),
  ];
  assert.ok(groups.length>0,label+' must contain cell groups');
  for(const [,id,body] of groups) {
    const rects=[...body.matchAll(/<rect\b[^>]*width="([0-9.]+)" height="([0-9.]+)"/g)];
    assert.ok(rects.length>0,label+' cell '+id+' must have a rectangle');
    for(const [,width,height] of rects) {
      assert.ok(Math.abs(Number(width)-expectedSize)<.015,label+' cell '+id+' width mismatch');
      assert.ok(Math.abs(Number(height)-expectedSize)<.015,label+' cell '+id+' height mismatch');
    }
  }
}

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

  test(id.toUpperCase()+' outline and finish polygons stay inside the 720x720 SVG plane',()=>{
    const geometry=EXTENDED_GEOMETRIES[id];
    assert.equal(geometry.outline.length,id==='hexa'?6:8);
    assert.equal(geometry.finishVertices.length,id==='hexa'?6:4);
    for(const [label,polygon] of [['outline',geometry.outline],['finish',geometry.finishVertices]]) {
      for(const point of polygon) {
        assert.ok(point.x>=0&&point.x<=720&&point.y>=0&&point.y<=720,
          id+' '+label+' polygon escaped viewBox at '+point.x+','+point.y);
      }
      const centroid={
        x:polygon.reduce((sum,point)=>sum+point.x,0)/polygon.length,
        y:polygon.reduce((sum,point)=>sum+point.y,0)/polygon.length,
      };
      assert.ok(Math.abs(centroid.x-geometry.center.x)<.02,id+' '+label+' polygon X centre mismatch');
      assert.ok(Math.abs(centroid.y-geometry.center.y)<.02,id+' '+label+' polygon Y centre mismatch');
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
    const four=getExtendedStackLayout(id,4);
    assert.equal(four.tokens.length,4);
    assert.equal(four.tokens.filter(token=>token.visible).length,4);
    assert.equal(four.hiddenCount,0);
    assert.equal(four.badge,null);
    const five=getExtendedStackLayout(id,5);
    assert.equal(five.tokens.length,5);
    assert.equal(five.tokens.filter(token=>token.visible).length,4);
    assert.equal(five.hiddenCount,1);
    assert.equal(five.badge,'×5');
    const visible=four.tokens;
    const spanX=Math.max(...visible.map(token=>token.x+token.diameter/2))-Math.min(...visible.map(token=>token.x-token.diameter/2));
    const spanY=Math.max(...visible.map(token=>token.y+token.diameter/2))-Math.min(...visible.map(token=>token.y-token.diameter/2));
    assert.ok(spanX<geometry.tileSize&&spanY<geometry.tileSize);
    for(let a=0;a<visible.length;a++)for(let b=a+1;b<visible.length;b++)
      assert.ok(distance(visible[a],visible[b])>four.tokens[0].diameter);
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
    assertSvgCellFootprints(svg,EXTENDED_GEOMETRIES[id].tileSize,id+' '+theme);
    assert.match(svg,/data:image\/webp;base64,/,'board artwork must embed its avatar assets');
    assert.match(svg,/data-avatar="optimist"/,'board artwork must include OPTIMIST character art');
    assert.doesNotMatch(svg,/href="characters\//,'board artwork must not depend on external avatar files');
    const trackCenters=[...svg.matchAll(/<g data-track-cell="(\d+)" data-center="([0-9.]+),([0-9.]+)"/g)];
    assert.equal(trackCenters.length,contract.track);
    for(const [,index,x,y] of trackCenters) {
      const cell=EXTENDED_GEOMETRIES[id].track[Number(index)];
      assert.equal(Number(x),cell.x, id+' track '+index+' x anchor changed');
      assert.equal(Number(y),cell.y, id+' track '+index+' y anchor changed');
    }
    const homeCenters=[...svg.matchAll(/<g data-home-cell="(\d+):(\d+)" data-center="([0-9.]+),([0-9.]+)"/g)];
    assert.equal(homeCenters.length,contract.sides*contract.home);
    for(const [,armIndex,homeIndex,x,y] of homeCenters) {
      const cell=EXTENDED_GEOMETRIES[id].arms[Number(armIndex)].homeLane[Number(homeIndex)];
      assert.equal(Number(x),cell.x,id+' home '+armIndex+':'+homeIndex+' x anchor changed');
      assert.equal(Number(y),cell.y,id+' home '+armIndex+':'+homeIndex+' y anchor changed');
    }
  }
});

test('runtime SVG generation reproduces all four themes without changing coordinates',()=>{
  for(const [id,contract] of Object.entries(expected)) for(const theme of themes) {
    const svg=renderExtendedBoardSvg(EXTENDED_GEOMETRIES[id],theme);
    assert.equal((svg.match(/data-track-cell=/g)||[]).length,contract.track);
    assert.equal((svg.match(/data-home-cell=/g)||[]).length,contract.sides*contract.home);
    assertSvgCellFootprints(svg,EXTENDED_GEOMETRIES[id].tileSize,id+' runtime '+theme);
  }
  assert.equal(themes.length,4);
});
