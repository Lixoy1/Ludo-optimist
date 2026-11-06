import { MAIN_TRACK, PLAYER_CONFIG } from './geometry.js';
import { getStackLayout } from './stack-layout.js';
export const BOARD_IMAGE_SIZE=720, GRID_ORIGIN_X=55, GRID_ORIGIN_Y=55, GRID_CELL=43.57, PAWN_DIAMETER_RATIO=.062;
export const BASE_SLOT_POINTS=Object.freeze({blue:[[132,132],[182,132],[132,182],[182,182]],red:[[538,132],[588,132],[538,182],[588,182]],green:[[132,538],[182,538],[132,588],[182,588]],yellow:[[538,538],[588,538],[538,588],[588,588]]});
export const FINISH_POINTS=Object.freeze([[336,336],[384,336],[336,384],[384,384]]);
export function gridToImage(col,row){if(!Number.isFinite(col)||!Number.isFinite(row))throw new TypeError('Grid coordinates must be finite numbers.');return{x:GRID_ORIGIN_X+col*GRID_CELL,y:GRID_ORIGIN_Y+row*GRID_CELL};}
export function tokenBoardPositions(state){
 if(!state?.tokens||!state?.players)return[];
 const tokens=Object.values(state.tokens),grouped=new Map(),base=new Map();
 const characters=new Map((state.players||[]).map(p=>[p.id,p.characterId||'optimist']));
 for(const token of tokens){
  const{zone,step}=token.position;
  if(zone==='base'){const[x,y]=BASE_SLOT_POINTS[token.color]?.[token.index]??BASE_SLOT_POINTS.blue[0];base.set(token.id,{x,y,centerX:x,centerY:y,scale:1,slot:token.index,stackKey:`base:${token.id}`,stackCount:1,visible:true,overflowCount:0});continue;}
  if(zone==='finished'){const[x,y]=FINISH_POINTS[token.index]??FINISH_POINTS[0];base.set(token.id,{x,y,centerX:x,centerY:y,scale:.8,slot:token.index,stackKey:`finished:${token.id}`,stackCount:1,visible:true,overflowCount:0});continue;}
  let key,point;
  if(zone==='track'){const config=PLAYER_CONFIG[token.color],i=(config.start+step)%MAIN_TRACK.length,cell=MAIN_TRACK[i];key=`track:${i}`;point=gridToImage(cell.col,cell.row);}
  else if(zone==='home'){const i=step-52,cell=PLAYER_CONFIG[token.color]?.lane[i];if(!cell)throw new RangeError(`Invalid home lane step ${step} for ${token.color}.`);key=`home:${token.color}:${i}`;point=gridToImage(cell[0],cell[1]);}
  else throw new Error(`Unknown token zone: ${zone}`);
  const bucket=grouped.get(key)??{point,tokens:[]};bucket.tokens.push(token);grouped.set(key,bucket);
 }
 const positions=new Map(base);
 for(const[stackKey,{point,tokens:stack}]of grouped){
  const layout=getStackLayout(stack.length,GRID_CELL);
  stack.forEach((token,index)=>{const offset=layout.positions[index];positions.set(token.id,{x:point.x+offset.x,y:point.y+offset.y,centerX:point.x,centerY:point.y,scale:offset.scale,slot:index,stackKey,stackCount:stack.length,visible:offset.visible!==false,overflowCount:layout.hiddenCount});});
 }
 return tokens.map(token=>{const p=positions.get(token.id);return{tokenId:token.id,owner:token.owner,characterId:characters.get(token.owner)||'optimist',color:token.color,index:token.index,zone:token.position.zone,x:p.x,y:p.y,left:p.x/720*100,top:p.y/720*100,centerX:p.centerX,centerY:p.centerY,centerLeft:p.centerX/720*100,centerTop:p.centerY/720*100,scale:p.scale,slot:p.slot,stackKey:p.stackKey,stackCount:p.stackCount,visible:p.visible!==false,overflowCount:p.overflowCount||0};});
}