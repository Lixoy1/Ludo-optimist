/** One pawn, two compact pawns, or one pawn with a count badge for 3+. */
export function getStackLayout(count,cellSize=40){
 if(!Number.isInteger(count)||count<0)throw new RangeError('Stack count must be a non-negative integer.');
 if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('Cell size must be positive.');
 if(count===0)return{positions:[],hiddenCount:0,badge:null};
 if(count===1)return{positions:[{x:0,y:0,scale:1,visible:true}],hiddenCount:0,badge:null};
 if(count===2){const dx=.18*cellSize,dy=.10*cellSize,scale=.42/.68;return{positions:[{x:-dx,y:-dy,scale,visible:true},{x:dx,y:dy,scale,visible:true}],hiddenCount:0,badge:null};}
 return{positions:Array.from({length:count},(_,i)=>({x:0,y:0,scale:i===0?1:0,visible:i===0})),hiddenCount:count-1,badge:'×'+count};
}
