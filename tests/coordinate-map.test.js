import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CELL_COUNT, COLORS, MAIN_TRACK, PLAYER_CONFIG, SAFE_TRACK_INDICES,
} from '../src/geometry.js';
import { BOARD_IMAGE_SIZE, GRID_CELL, PAWN_DIAMETER_RATIO, BASE_SLOT_POINTS, FINISH_POINTS, gridToImage } from '../src/board-render.js';
import { EXTENDED_GEOMETRIES } from '../src/extended-geometries.js';

const exporter = fileURLToPath(new URL('../scripts/export-coordinate-map.mjs', import.meta.url));
const mapPath = new URL('../Coordinates_Map.json', import.meta.url);

function readGeneratedMap() {
  const result = spawnSync(process.execPath, [exporter], { encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(readFileSync(mapPath, 'utf8'));
}

test('Coordinates_Map exports exactly the three approved modes and their progress ranges', () => {
  const map = readGeneratedMap();
  assert.equal(map.schemaVersion, '2.0.0');
  assert.deepEqual(Object.keys(map.boards).sort(), ['classic','hexa','royal']);
  assert.equal(map.progressModel, 'stepProgress is the sole stored token progress; zone/step are derived');
  assert.deepEqual(
    Object.fromEntries(Object.entries(map.boards).map(([id,board])=>[id,[board.trackLength,board.homeCells,board.progress.finished]])),
    { classic:[52,5,56], hexa:[72,6,78], royal:[68,7,74] },
  );
});

test('CLASSIC map matches the canonical 52-cell grid route, home lanes and pawn slots', () => {
  const map = readGeneratedMap().boards.classic;
  assert.equal(map.track.length, CELL_COUNT);
  assert.equal(new Set(map.track.map(cell=>cell.grid.col+','+cell.grid.row)).size, CELL_COUNT);
  assert.deepEqual(map.safeIndices, [...SAFE_TRACK_INDICES].sort((a,b)=>a-b));
  for (const cell of MAIN_TRACK) {
    const mapped=map.track[cell.index];
    const point=gridToImage(cell.col,cell.row);
    assert.deepEqual(mapped.grid,{col:cell.col,row:cell.row});
    assert.ok(Math.abs(mapped.x-point.x)<1e-6);
    assert.ok(Math.abs(mapped.y-point.y)<1e-6);
    assert.equal(mapped.safe,SAFE_TRACK_INDICES.has(cell.index));
  }
  for (const color of COLORS) {
    const arm=map.arms.find(item=>item.playerId===color);
    const config=PLAYER_CONFIG[color];
    assert.equal(arm.startIndex,config.start);
    assert.equal(arm.homeEntryIndex,config.homeEntry);
    assert.equal(arm.homeLane.length,5);
    arm.homeLane.forEach((cell,index)=>{
      const [col,row]=config.lane[index];
      assert.deepEqual(cell.grid,{col,row});
      assert.equal(cell.stepProgress,51+index);
    });
    assert.deepEqual(arm.baseSlots.map(slot=>[slot.x,slot.y]),BASE_SLOT_POINTS[color]);
  }
  assert.deepEqual(map.arms[0].finishSlots.map(slot=>[slot.x,slot.y]),FINISH_POINTS);
  assert.equal(map.pawnDiameter,BOARD_IMAGE_SIZE*PAWN_DIAMETER_RATIO);
  assert.equal(map.cellPitch,GRID_CELL);
});

for (const [id, geometry] of Object.entries(EXTENDED_GEOMETRIES)) {
  test(id.toUpperCase()+' map matches all generated route, home, base and finish coordinates', () => {
    const map=readGeneratedMap().boards[id];
    assert.equal(map.track.length,geometry.trackLength);
    assert.equal(map.arms.length,geometry.maxPlayers);
    assert.deepEqual(map.safeIndices,geometry.safeIndices);
    geometry.track.forEach((cell,index)=>{
      const mapped=map.track[index];
      assert.equal(mapped.index,index);
      assert.ok(Math.abs(mapped.x-cell.x)<1e-4);
      assert.ok(Math.abs(mapped.y-cell.y)<1e-4);
      assert.equal(mapped.rotation,Number(cell.rotation.toFixed(4)));
      assert.equal(mapped.safe,Boolean(cell.safe));
    });
    geometry.arms.forEach((arm,index)=>{
      const mapped=map.arms[index];
      assert.equal(mapped.playerId,arm.player.id);
      assert.equal(mapped.startIndex,arm.startIndex);
      assert.equal(mapped.homeEntryIndex,arm.homeEntryIndex);
      assert.equal(mapped.homeLane.length,geometry.homeCells);
      arm.homeLane.forEach((cell,laneIndex)=>{
        assert.equal(mapped.homeLane[laneIndex].stepProgress,geometry.maxOuterSteps+cell.homeIndex);
        assert.ok(Math.abs(mapped.homeLane[laneIndex].x-cell.x)<1e-4);
        assert.ok(Math.abs(mapped.homeLane[laneIndex].y-cell.y)<1e-4);
      });
      arm.baseSlots.forEach((slot,slotIndex)=>{
        assert.ok(Math.abs(mapped.baseSlots[slotIndex].x-slot.x)<1e-4);
        assert.ok(Math.abs(mapped.baseSlots[slotIndex].y-slot.y)<1e-4);
      });
      arm.finishSlots.forEach((slot,slotIndex)=>{
        assert.ok(Math.abs(mapped.finishSlots[slotIndex].x-slot.x)<1e-4);
        assert.ok(Math.abs(mapped.finishSlots[slotIndex].y-slot.y)<1e-4);
      });
    });
  });
}
