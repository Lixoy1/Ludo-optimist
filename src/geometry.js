/** Canonical Classic Ludo route. Coordinates are [column,row] on a 15x15 grid. */
export const GRID_SIZE=15;
export const CELL_COUNT=52;
export const COLORS=Object.freeze(['blue','red','yellow','green']);
const RAW_TRACK=[
 [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
 [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
 [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
 [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]
];
// Re-index at the Blue start (physical cell formerly at raw index 13).
export const MAIN_TRACK=Array.from({length:CELL_COUNT},(_,index)=>{
 const [col,row]=RAW_TRACK[(index+13)%CELL_COUNT];
 return{index,col,row,key:'track-'+index};
});
export const PLAYER_CONFIG=Object.freeze({
 blue:{label:'BLUE',start:0,homeEntry:50,base:{col:0,row:0},lane:[[7,1],[7,2],[7,3],[7,4],[7,5]],finishTriangle:'top'},
 red:{label:'RED',start:13,homeEntry:11,base:{col:9,row:0},lane:[[13,7],[12,7],[11,7],[10,7],[9,7]],finishTriangle:'right'},
 yellow:{label:'YELLOW',start:26,homeEntry:24,base:{col:9,row:9},lane:[[7,13],[7,12],[7,11],[7,10],[7,9]],finishTriangle:'bottom'},
 green:{label:'GREEN',start:39,homeEntry:37,base:{col:0,row:9},lane:[[1,7],[2,7],[3,7],[4,7],[5,7]],finishTriangle:'left'}
});
export const SAFE_TRACK_INDICES=new Set([0,8,13,21,26,34,39,47]);
export const HOME_SLOTS=Object.freeze([{x:-.8,y:-.8},{x:.8,y:-.8},{x:-.8,y:.8},{x:.8,y:.8}]);
export const FINISH_SLOTS=Object.freeze([{x:-.55,y:-.55},{x:.55,y:-.55},{x:-.55,y:.55},{x:.55,y:.55}]);
export const CENTER=Object.freeze({col:7,row:7});
export function getTrackCell(index){if(!Number.isInteger(index)||index<0||index>=CELL_COUNT)throw new RangeError('Track index out of range.');return MAIN_TRACK[index];}
export function getHomeLane(color){const c=PLAYER_CONFIG[color];if(!c)throw new Error('Unknown player color: '+color);return c.lane.map(([col,row],index)=>({col,row,index,key:color+'-home-'+index}));}
export function isSafeTrackIndex(index){return SAFE_TRACK_INDICES.has(((index%CELL_COUNT)+CELL_COUNT)%CELL_COUNT);}
export function getBaseSlots(color){const c=PLAYER_CONFIG[color];if(!c)throw new Error('Unknown player color: '+color);return HOME_SLOTS.map((s,index)=>({id:color+'-base-'+index,slotIndex:index,x:c.base.col+3+s.x,y:c.base.row+3+s.y}));}
export function assertBoardGeometry(){
 if(MAIN_TRACK.length!==52||new Set(MAIN_TRACK.map(p=>p.col+','+p.row)).size!==52)throw new Error('Classic route must have 52 unique cells.');
 for(const c of COLORS){const p=PLAYER_CONFIG[c];if(p.lane.length!==5)throw new Error(c+' home lane must contain five cells.');if((p.start+50)%52!==p.homeEntry)throw new Error(c+' home entry index mismatch.');}
 const keys=new Set(MAIN_TRACK.map(p=>p.col+','+p.row));
 for(const c of COLORS)for(const [col,row] of PLAYER_CONFIG[c].lane){if(keys.has(col+','+row))throw new Error('Classic home lane overlaps outer route.');}
 return true;
}
