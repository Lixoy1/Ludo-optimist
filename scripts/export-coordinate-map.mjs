import { writeFile } from 'node:fs/promises';
import {
  CELL_COUNT, COLORS, MAIN_TRACK, PLAYER_CONFIG, SAFE_TRACK_INDICES, assertBoardGeometry,
} from '../src/geometry.js';
import {
  BOARD_IMAGE_SIZE, GRID_CELL, PAWN_DIAMETER_RATIO, BASE_SLOT_POINTS, FINISH_POINTS, gridToImage,
} from '../src/board-render.js';
import { EXTENDED_GEOMETRIES, assertExtendedGeometry } from '../src/extended-geometries.js';

const round = (value) => Number(value.toFixed(4));
const point = (value) => ({ x:round(value.x), y:round(value.y) });

function buildClassic() {
  const arms = COLORS.map((color, index) => {
    const config = PLAYER_CONFIG[color];
    const baseSlots = BASE_SLOT_POINTS[color].map(([x,y],slotIndex) => ({ slotIndex, ...point({x,y}) }));
    const baseCenter = point({
      x:baseSlots.reduce((sum,slot)=>sum+slot.x,0)/baseSlots.length,
      y:baseSlots.reduce((sum,slot)=>sum+slot.y,0)/baseSlots.length,
    });
    const homeLane = config.lane.map(([col,row],homeIndex)=>({
      homeIndex,
      stepProgress:51+homeIndex,
      grid:{col,row},
      ...point(gridToImage(col,row)),
      rotation:0,
    }));
    return {
      seat:index,
      playerId:color,
      label:config.label,
      startIndex:config.start,
      homeEntryIndex:config.homeEntry,
      starIndex:null,
      baseCenter,
      baseSlots,
      homeLane,
      finishSlots:FINISH_POINTS.map(([x,y],slotIndex)=>({slotIndex,...point({x,y})})),
      baseRotation:0,
    };
  });
  return {
    id:'CLASSIC',
    shape:'cross',
    canvas:{width:BOARD_IMAGE_SIZE,height:BOARD_IMAGE_SIZE,viewBox:[0,0,BOARD_IMAGE_SIZE,BOARD_IMAGE_SIZE]},
    players:4,
    piecesPerPlayer:4,
    trackLength:CELL_COUNT,
    maxOuterSteps:50,
    homeCells:5,
    finishStep:56,
    cellPitch:GRID_CELL,
    tileSize:38,
    pawnDiameter:BOARD_IMAGE_SIZE*PAWN_DIAMETER_RATIO,
    safeIndices:[...SAFE_TRACK_INDICES].sort((a,b)=>a-b),
    starts:Object.fromEntries(arms.map(arm=>[arm.playerId,arm.startIndex])),
    homeEntries:Object.fromEntries(arms.map(arm=>[arm.playerId,arm.homeEntryIndex])),
    track:MAIN_TRACK.map(cell=>({
      index:cell.index,
      grid:{col:cell.col,row:cell.row},
      ...point(gridToImage(cell.col,cell.row)),
      safe:SAFE_TRACK_INDICES.has(cell.index),
      rotation:0,
    })),
    arms,
    progress:{
      base:-1,
      outer:[0,50],
      home:[51,55],
      finished:56,
    },
  };
}

function buildExtended(geometry) {
  assertExtendedGeometry(geometry);
  const arms=geometry.arms.map(arm=>({
    seat:arm.index,
    playerId:arm.player.id,
    label:arm.player.label,
    startIndex:arm.startIndex,
    homeEntryIndex:arm.homeEntryIndex,
    starIndex:arm.starIndex,
    baseCenter:point(arm.baseCenter),
    baseRadius:round(arm.baseRadius),
    baseRotation:round(arm.baseRotation),
    baseSlots:arm.baseSlots.map(slot=>({
      slotIndex:slot.slotIndex,
      ...point(slot),
    })),
    homeLane:arm.homeLane.map(cell=>({
      homeIndex:cell.homeIndex,
      stepProgress:geometry.maxOuterSteps+cell.homeIndex,
      ...point(cell),
      rotation:round(cell.rotation),
    })),
    finishSlots:arm.finishSlots.map(slot=>({
      slotIndex:slot.slotIndex,
      ...point(slot),
    })),
  }));
  return {
    id:geometry.id.toUpperCase(),
    shape:geometry.shape,
    canvas:{
      width:720,height:720,viewBox:[0,0,720,720],
      nativeWidth:geometry.canvasSize,nativeHeight:geometry.canvasSize,
    },
    players:geometry.maxPlayers,
    piecesPerPlayer:geometry.tokensPerPlayer,
    trackLength:geometry.trackLength,
    maxOuterSteps:geometry.maxOuterSteps,
    homeCells:geometry.homeCells,
    finishStep:geometry.finishStep,
    cellPitch:round(geometry.cellPitch),
    tileSize:round(geometry.tileSize),
    safeAreaSize:round(geometry.safeAreaSize),
    pawnDiameter:round(geometry.pawnDiameter),
    pawnMaxWidth:round(geometry.pawnMaxWidth),
    finishPawnScale:geometry.finishPawnScale,
    safeIndices:[...geometry.safeIndices],
    starts:{...geometry.startIndices},
    homeEntries:{...geometry.homeEntryIndices},
    track:geometry.track.map(cell=>({
      index:cell.index,
      sector:cell.sector,
      lane:cell.lane,
      row:cell.row,
      ...point(cell),
      rotation:round(cell.rotation),
      safe:Boolean(cell.safe),
      startFor:cell.startFor,
      entryFor:cell.entryFor,
    })),
    arms,
    center:point(geometry.center),
    outline:geometry.outline.map(point),
    finishVertices:geometry.finishVertices.map(point),
    routeLinkDistances:geometry.routeLinkDistances,
    progress:{
      base:-1,
      outer:[0,geometry.maxOuterSteps],
      home:[geometry.maxOuterSteps+1,geometry.maxOuterSteps+geometry.homeCells],
      finished:geometry.finishStep,
    },
  };
}

assertBoardGeometry();
const boards={
  classic:buildClassic(),
  hexa:buildExtended(EXTENDED_GEOMETRIES.hexa),
  royal:buildExtended(EXTENDED_GEOMETRIES.royal),
};
const payload={
  schemaVersion:'2.0.0',
  generatedBy:'scripts/export-coordinate-map.mjs',
  coordinateSpace:'SVG viewBox units; top-left origin; positive X right; positive Y down',
  progressModel:'stepProgress is the sole stored token progress; zone/step are derived',
  boards,
};
await writeFile(new URL('../Coordinates_Map.json',import.meta.url),JSON.stringify(payload,null,2)+'\n','utf8');
process.stdout.write('Wrote Coordinates_Map.json for CLASSIC, HEXA and ROYAL.\n');
