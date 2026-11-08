import { MAIN_TRACK, PLAYER_CONFIG } from './geometry.js';
import { getStackLayout } from './stack-layout.js';
import { getPlayableGeometry, getPlayableStackLayout } from './game-geometries.js';
import { CLASSIC_PROGRESS_CONFIG, positionFromStepProgress, progressToHomeIndex, progressConfigForState } from './game-progress.js';

// Keep browser modules independent from the private backend source tree.
const LAST_TRACK_STEP = CLASSIC_PROGRESS_CONFIG.maxOuterSteps;
const FINISH_STEP = CLASSIC_PROGRESS_CONFIG.finishStep;
export const BOARD_IMAGE_SIZE=720, GRID_ORIGIN_X=55, GRID_ORIGIN_Y=55, GRID_CELL=43.57, PAWN_DIAMETER_RATIO=.68*128/2304;
export const BASE_SLOT_POINTS=Object.freeze({blue:[[132,132],[182,132],[132,182],[182,182]],red:[[538,132],[588,132],[538,182],[588,182]],yellow:[[538,538],[588,538],[538,588],[588,588]],green:[[132,538],[182,538],[132,588],[182,588]]});
export const FINISH_POINTS=Object.freeze([[336,336],[384,336],[336,384],[384,384]]);
export function gridToImage(col,row){if(!Number.isFinite(col)||!Number.isFinite(row))throw new TypeError('Grid coordinates must be finite numbers.');return{x:GRID_ORIGIN_X+col*GRID_CELL,y:GRID_ORIGIN_Y+row*GRID_CELL};}
export function tokenBoardPositions(state){
 if(!state?.tokens||!state?.players)return[];
 if(state.mode==='HEXA'||state.mode==='ROYAL')return extendedTokenBoardPositions(state);
 const tokens=Object.values(state.tokens),grouped=new Map(),base=new Map();
 const characters=new Map((state.players||[]).map(p=>[p.id,p.characterId||'optimist']));
 const progressConfig=progressConfigForState(state);
 for(const token of tokens){
  const{zone,step}=positionFromStepProgress(token.stepProgress,progressConfig);
  if(zone==='base'){const[x,y]=BASE_SLOT_POINTS[token.color]?.[token.index]??BASE_SLOT_POINTS.blue[0];base.set(token.id,{x,y,centerX:x,centerY:y,scale:1,diameter:BOARD_IMAGE_SIZE*PAWN_DIAMETER_RATIO,slot:token.index,stackKey:`base:${token.id}`,stackCount:1,visible:true,overflowCount:0});continue;}
  if(zone==='finished'){const[x,y]=FINISH_POINTS[token.index]??FINISH_POINTS[0];base.set(token.id,{x,y,centerX:x,centerY:y,scale:.8,diameter:BOARD_IMAGE_SIZE*PAWN_DIAMETER_RATIO,slot:token.index,stackKey:`finished:${token.id}`,stackCount:1,visible:true,overflowCount:0});continue;}
  let key,point;
  if(zone==='track'){const config=PLAYER_CONFIG[token.color],i=(config.start+step)%MAIN_TRACK.length,cell=MAIN_TRACK[i];key=`track:${i}`;point=gridToImage(cell.col,cell.row);}
  else if(zone==='home'){const i=progressToHomeIndex(token.stepProgress,progressConfig),cell=PLAYER_CONFIG[token.color]?.lane[i];if(!cell)throw new RangeError(`Invalid home lane step ${step} for ${token.color}.`);key=`home:${token.color}:${i}`;point=gridToImage(cell[0],cell[1]);}
  else throw new Error(`Unknown token zone: ${zone}`);
  const bucket=grouped.get(key)??{point,tokens:[]};bucket.tokens.push(token);grouped.set(key,bucket);
 }
 const positions=new Map(base);
 for(const[stackKey,{point,tokens:stack}]of grouped){
  const layout=getStackLayout(stack.length,GRID_CELL);
  stack.forEach((token,index)=>{const offset=layout.positions[index];positions.set(token.id,{x:point.x+offset.x,y:point.y+offset.y,centerX:point.x,centerY:point.y,scale:offset.scale,diameter:BOARD_IMAGE_SIZE*PAWN_DIAMETER_RATIO,slot:index,stackKey,stackCount:stack.length,visible:offset.visible!==false,overflowCount:layout.hiddenCount});});
 }
 return tokens.map(token=>{const p=positions.get(token.id);return{tokenId:token.id,owner:token.owner,characterId:characters.get(token.owner)||'optimist',color:token.color,index:token.index,zone:positionFromStepProgress(token.stepProgress,progressConfig).zone,x:p.x,y:p.y,left:p.x/720*100,top:p.y/720*100,centerX:p.centerX,centerY:p.centerY,centerLeft:p.centerX/720*100,centerTop:p.centerY/720*100,scale:p.scale,diameter:p.diameter,slot:p.slot,stackKey:p.stackKey,stackCount:p.stackCount,visible:p.visible!==false,overflowCount:p.overflowCount||0};});
}
export function extendedTokenBoardPositions(state) {
 const geometry=getPlayableGeometry(state.mode);
 const tokens=Object.values(state.tokens),grouped=new Map(),fixed=new Map();
 const players=new Map(state.players.map(player=>[player.id,player]));
 const characters=new Map(state.players.map(player=>[player.id,player.characterId||'optimist']));
 for(const token of tokens) {
  const player=players.get(token.owner),arm=geometry.arms[player?.armIndex];
  if(!player||!arm)throw new Error(`Missing extended board seat for token ${token.id}.`);
  const {zone,step}=positionFromStepProgress(token.stepProgress,progressConfigForState(state));
  if(zone==='base'||zone==='finished') {
   const point=zone==='base'?arm.baseSlots[token.index]:arm.finishSlots[token.index];
   if(!point)throw new RangeError(`Invalid ${zone} slot for token ${token.id}.`);
   fixed.set(token.id,{x:point.x,y:point.y,centerX:point.x,centerY:point.y,scale:zone==='base'?1:geometry.finishPawnScale,diameter:geometry.pawnDiameter,slot:token.index,
    stackKey:`${zone}:${token.id}`,stackCount:1,visible:true,overflowCount:0});
   continue;
  }
  let key,point;
  if(zone==='track') {
   const global=(player.startIndex+step)%geometry.trackLength;
   const cell=geometry.track[global];
   if(!cell)throw new RangeError(`Invalid outer track cell ${global}.`);
   key=`track:${global}`;point={x:cell.x,y:cell.y};
  } else if(zone==='home') {
   const index=progressToHomeIndex(token.stepProgress,progressConfigForState(state)),cell=arm.homeLane[index];
   if(!cell)throw new RangeError(`Invalid home lane step ${step} for ${token.color}.`);
   key=`home:${player.id}:${index}`;point={x:cell.x,y:cell.y};
  } else throw new Error(`Unknown token zone: ${zone}`);
  const bucket=grouped.get(key)??{point,tokens:[]};bucket.tokens.push(token);grouped.set(key,bucket);
 }
 const positions=new Map(fixed);
 for(const [stackKey,{point,tokens:stack}] of grouped) {
  const layout=getPlayableStackLayout(state.mode,stack.length);
  stack.forEach((token,index)=>{
   const offset=layout.tokens[index];
   positions.set(token.id,{x:point.x+offset.x,y:point.y+offset.y,centerX:point.x,centerY:point.y,
    scale:offset.scale,diameter:geometry.pawnDiameter,slot:index,stackKey,stackCount:stack.length,visible:offset.visible!==false,
    overflowCount:layout.hiddenCount});
  });
 }
 return tokens.map(token=>{
  const p=positions.get(token.id);
  if(!p)throw new Error(`Missing board coordinates for token ${token.id}.`);
  return{tokenId:token.id,owner:token.owner,characterId:characters.get(token.owner)||'optimist',color:token.color,index:token.index,
   zone:positionFromStepProgress(token.stepProgress,progressConfigForState(state)).zone,x:p.x,y:p.y,left:p.x/720*100,top:p.y/720*100,
   centerX:p.centerX,centerY:p.centerY,centerLeft:p.centerX/720*100,centerTop:p.centerY/720*100,
   scale:p.scale,diameter:p.diameter,slot:p.slot,stackKey:p.stackKey,stackCount:p.stackCount,visible:p.visible!==false,overflowCount:p.overflowCount||0};
 });
}


export function tokenMovementPath(state, playerId, from, to, tokenIndex) {
 if(!state||!from||!to)return[];
 const player=state.players?.find(item=>item.id===playerId);
 if(!player)return[];
 const extended=state.mode==='HEXA'||state.mode==='ROYAL';
 const geometry=extended?getPlayableGeometry(state.mode):null;
 const config=extended?null:PLAYER_CONFIG[player.color];
 const trackLength=extended?geometry.trackLength:MAIN_TRACK.length;
 const maxOuterSteps=extended?geometry.maxOuterSteps:LAST_TRACK_STEP;
 const homeStart=maxOuterSteps+1;
 const finishStep=extended?geometry.finishStep:FINISH_STEP;
 const pointForStep=step=>{
  if(step<=maxOuterSteps){
   const global=extended?(player.startIndex+step)%trackLength:(config.start+step)%trackLength;
   const cell=extended?geometry.track[global]:MAIN_TRACK[global];
   return extended?{x:cell.x,y:cell.y}:gridToImage(cell.col,cell.row);
  }
  if(step<finishStep){
   const index=step-homeStart;
   if(extended){const point=geometry.arms[player.armIndex]?.homeLane[index];return point?{x:point.x,y:point.y}:null;}
   const point=config.lane[index];return point?gridToImage(point[0],point[1]):null;
  }
  if(step===finishStep){
   if(extended){const point=geometry.arms[player.armIndex]?.finishSlots[tokenIndex];return point?{x:point.x,y:point.y}:null;}
   const point=FINISH_POINTS[tokenIndex];return point?{x:point[0],y:point[1]}:null;
  }
  return null;
 };
 const firstStep=from.zone==='base'?0:from.step+1;
 const points=[];
 for(let step=firstStep;step<=to.step;step+=1){
  const point=pointForStep(step);
  if(!point)return[];
  points.push(point);
 }
 return points;
}
