import { COLORS,PLAYER_CONFIG,SAFE_TRACK_INDICES,CELL_COUNT } from '../../src/geometry.js';
export const TOKENS_PER_PLAYER=4;
export const LAST_TRACK_STEP=50;
export const LAST_HOME_STEP=55;
export const FINISH_STEP=56;
const HOME_START_STEP=LAST_TRACK_STEP+1;
function assertRoster(roster){
 if(!Array.isArray(roster)||roster.length<2||roster.length>4)throw new RangeError('Classic Ludo requires 2–4 players.');
 const ids=roster.map(p=>p?.id),colors=roster.map(p=>p?.color);
 if(ids.some(id=>typeof id!=='string'||!id.trim())||new Set(ids).size!==ids.length)throw new TypeError('Player IDs must be non-empty and unique.');
 if(colors.some(c=>!COLORS.includes(c))||new Set(colors).size!==colors.length)throw new TypeError('Player colors must be unique board colors.');
 return roster.map(p=>({id:p.id,color:p.color,username:String(p.username??p.id).slice(0,40),characterId:String(p.characterId||'optimist'),status:'playing',finishedAt:null}));
}
export function createClassicState(roster){
 const players=assertRoster(roster),tokens={};
 for(const p of players)for(let index=0;index<TOKENS_PER_PLAYER;index++){const id=p.id+':'+index;tokens[id]={id,owner:p.id,color:p.color,index,position:{zone:'base',step:-1}};}
 return{mode:'CLASSIC',phase:'playing',players,tokens,currentPlayer:players[0].id,dice:null,consecutiveSixes:0,winner:null,revision:0,lastAction:null};
}
export function globalTrackIndex(color,step){const c=PLAYER_CONFIG[color];if(!c||!Number.isInteger(step)||step<0||step>LAST_TRACK_STEP)throw new RangeError('Invalid outer-track position.');return(c.start+step)%CELL_COUNT;}
const playerById=(s,id)=>s.players.find(p=>p.id===id)||null;
function destination(token,dice){
 if(token.position.zone==='base')return dice===6?{zone:'track',step:0}:null;
 if(token.position.zone==='finished')return null;
 const next=token.position.step+dice;
 if(next<=LAST_TRACK_STEP)return{zone:'track',step:next};
 if(next<=LAST_HOME_STEP)return{zone:'home',step:next};
 if(next===FINISH_STEP)return{zone:'finished',step:FINISH_STEP};
 return null;
}
function tokensAt(state,index,except=null){return Object.values(state.tokens).filter(t=>t.id!==except&&t.position.zone==='track'&&globalTrackIndex(t.color,t.position.step)===index);}
function blocked(state,index,except=null){const counts=new Map();for(const t of tokensAt(state,index,except))counts.set(t.owner,(counts.get(t.owner)||0)+1);return[...counts.values()].some(n=>n>=2);}
function pathClear(state,token,d){if(token.position.zone!=='track')return true;for(let step=token.position.step+1;step<=Math.min(d.step,LAST_TRACK_STEP);step++)if(blocked(state,globalTrackIndex(token.color,step),token.id))return false;return true;}
function canLand(state,token,d){return d.zone!=='track'||!blocked(state,globalTrackIndex(token.color,d.step),token.id);}
export function buildOccupancy(state){const o={track:{},home:{},base:{},finished:{}};for(const t of Object.values(state.tokens)){const{zone,step}=t.position,key=zone==='track'?String(globalTrackIndex(t.color,step)):zone==='home'?t.color+':'+(step-HOME_START_STEP):t.owner;(o[zone][key]??=[]).push(t.id);}return o;}
export function legalMoves(state,playerId,dice=state.dice){if(state.phase!=='playing'||state.currentPlayer!==playerId||!playerById(state,playerId)||!Number.isInteger(dice)||dice<1||dice>6)return[];return Object.values(state.tokens).filter(t=>t.owner===playerId).filter(t=>{const d=destination(t,dice);return Boolean(d&&pathClear(state,t,d)&&canLand(state,t,d));}).map(t=>t.id);}
function nextPlayer(state,id){const i=state.players.findIndex(p=>p.id===id);for(let n=1;n<=state.players.length;n++){const p=state.players[(i+n)%state.players.length];if(p.status!=='finished')return p.id;}return id;}
const clone=s=>structuredClone(s);
export function rollClassicDice(state,playerId,dice){
 if(state.phase!=='playing'||state.currentPlayer!==playerId||state.dice!==null)throw new Error('Dice cannot be rolled now.');
 if(!Number.isInteger(dice)||dice<1||dice>6)throw new RangeError('Dice must be 1..6.');
 const next=clone(state);next.consecutiveSixes=dice===6?next.consecutiveSixes+1:0;next.lastAction={type:'ROLL',playerId,dice};next.revision++;
 if(next.consecutiveSixes===3){next.consecutiveSixes=0;next.currentPlayer=nextPlayer(next,playerId);next.lastAction.skipped=true;return{state:next,legalTokenIds:[],skipped:true,bonusRoll:false,turnAdvanced:true};}
 next.dice=dice;const moves=legalMoves(next,playerId,dice);
 if(!moves.length){next.dice=null;const bonusRoll=dice===6;if(!bonusRoll)next.currentPlayer=nextPlayer(next,playerId);return{state:next,legalTokenIds:[],skipped:false,bonusRoll,turnAdvanced:!bonusRoll};}
 return{state:next,legalTokenIds:moves,skipped:false,bonusRoll:false,turnAdvanced:false};
}
export function applyClassicMove(state,playerId,tokenId){
 if(state.phase!=='playing'||state.currentPlayer!==playerId||state.dice===null)throw new Error('There is no pending move.');
 if(!legalMoves(state,playerId,state.dice).includes(tokenId))throw new Error('Illegal move.');
 const next=clone(state),token=next.tokens[tokenId],dice=next.dice,from=clone(token.position),d=destination(token,dice);token.position=d;const captured=[];
 if(d.zone==='track'){const index=globalTrackIndex(token.color,d.step);if(!SAFE_TRACK_INDICES.has(index))for(const enemy of Object.values(next.tokens))if(enemy.owner!==playerId&&enemy.position.zone==='track'&&globalTrackIndex(enemy.color,enemy.position.step)===index){enemy.position={zone:'base',step:-1};captured.push(enemy.id);}}
 const finished=Object.values(next.tokens).filter(t=>t.owner===playerId&&t.position.zone==='finished').length,justFinished=d.zone==='finished';
 if(finished===TOKENS_PER_PLAYER){const p=playerById(next,playerId);p.status='finished';p.finishedAt=next.revision+1;next.phase='finished';next.winner=playerId;}
 const bonusRoll=next.phase!=='finished'&&(dice===6||captured.length>0||justFinished);next.dice=null;if(next.phase!=='finished'&&!bonusRoll)next.currentPlayer=nextPlayer(next,playerId);
 next.lastAction={type:'MOVE',playerId,tokenId,dice,from,to:clone(d),captured,bonusRoll};next.revision++;return{state:next,captured,bonusRoll,turnAdvanced:!bonusRoll&&next.phase!=='finished'};
}
export function assertClassicState(state){
 if(!state||state.mode!=='CLASSIC'||!Array.isArray(state.players)||!state.tokens)throw new TypeError('Malformed Classic Ludo state.');
 if(state.players.length<2||state.players.length>4)throw new RangeError('Classic requires 2–4 players.');
 for(const p of state.players){const owned=Object.values(state.tokens).filter(t=>t.owner===p.id);if(owned.length!==4)throw new Error('Each Classic player must own four tokens.');for(const t of owned){const{zone,step}=t.position;if(zone==='base'&&step!==-1)throw new Error('Invalid base step.');if(zone==='track'&&(!Number.isInteger(step)||step<0||step>LAST_TRACK_STEP))throw new Error('Invalid track step.');if(zone==='home'&&(!Number.isInteger(step)||step<HOME_START_STEP||step>LAST_HOME_STEP))throw new Error('Invalid home step.');if(zone==='finished'&&step!==FINISH_STEP)throw new Error('Invalid finish step.');if(!['base','track','home','finished'].includes(zone))throw new Error('Invalid token zone.');}}
 if(!state.players.some(p=>p.id===state.currentPlayer))throw new Error('Current player missing.');return true;
}
