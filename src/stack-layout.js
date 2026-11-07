/** Compact, deterministic pawn positions: four stay visible, overflow gets a badge. */
export function getStackLayout(count,cellSize=40){
 if(!Number.isInteger(count)||count<0)throw new RangeError('Stack count must be a non-negative integer.');
 if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('Cell size must be positive.');
 if(count===0)return{positions:[],hiddenCount:0,badge:null};
 if(count===1)return{positions:[{x:0,y:0,scale:1,visible:true}],hiddenCount:0,badge:null,scale:1};
 if(count===2){
  const scale=.48,dx=.24*cellSize,dy=.21*cellSize;
  return{positions:[{x:-dx,y:-dy,scale,visible:true},{x:dx,y:dy,scale,visible:true}],hiddenCount:0,badge:null,scale};
 }
 const scale=.44,offset=.23*cellSize;
 const slots=[[-offset,-offset],[offset,-offset],[-offset,offset],[offset,offset]];
 const visibleCount=Math.min(count,4);
 const positions=Array.from({length:count},(_,index)=>{
  if(index>=visibleCount)return{x:0,y:0,scale:0,visible:false};
  const [x,y]=slots[index];
  return{x,y,scale,visible:true};
 });
 const hiddenCount=count-visibleCount;
 return{positions,hiddenCount,badge:hiddenCount?'×'+count:null,scale};
}
