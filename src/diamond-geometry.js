// Geometry extracted from the authored OPTIMIST LUDO DIAMOND SVG asset.
// The asset uses indexed circle IDs t0..t51, h{color}0..4,
// b{color}0..3 and f{color}0..3. Coordinates are kept in 720x720 SVG space.
const track = [{"x":370.692,"y":92.692},{"x":392.077,"y":114.077},{"x":413.462,"y":135.462},{"x":434.846,"y":156.846},{"x":456.231,"y":178.231},{"x":477.615,"y":199.615},{"x":499,"y":221},{"x":520.385,"y":242.385},{"x":541.769,"y":263.769},{"x":563.154,"y":285.154},{"x":584.538,"y":306.538},{"x":605.923,"y":327.923},{"x":627.308,"y":349.308},{"x":627.308,"y":370.692},{"x":605.923,"y":392.077},{"x":584.538,"y":413.462},{"x":563.154,"y":434.846},{"x":541.769,"y":456.231},{"x":520.385,"y":477.615},{"x":499,"y":499},{"x":477.615,"y":520.385},{"x":456.231,"y":541.769},{"x":434.846,"y":563.154},{"x":413.462,"y":584.538},{"x":392.077,"y":605.923},{"x":370.692,"y":627.308},{"x":349.308,"y":627.308},{"x":327.923,"y":605.923},{"x":306.538,"y":584.538},{"x":285.154,"y":563.154},{"x":263.769,"y":541.769},{"x":242.385,"y":520.385},{"x":221,"y":499},{"x":199.615,"y":477.615},{"x":178.231,"y":456.231},{"x":156.846,"y":434.846},{"x":135.462,"y":413.462},{"x":114.077,"y":392.077},{"x":92.692,"y":370.692},{"x":92.692,"y":349.308},{"x":114.077,"y":327.923},{"x":135.462,"y":306.538},{"x":156.846,"y":285.154},{"x":178.231,"y":263.769},{"x":199.615,"y":242.385},{"x":221,"y":221},{"x":242.385,"y":199.615},{"x":263.769,"y":178.231},{"x":285.154,"y":156.846},{"x":306.538,"y":135.462},{"x":327.923,"y":114.077},{"x":349.308,"y":92.692}].map((point,index)=>({ ...point,index }));
const armData = [{"index":0,"color":"green","startIndex":45,"starIndex":39,"homeEntryIndex":44,"baseSlots":[{"x":186.352,"y":205.02},{"x":205.02,"y":186.352},{"x":167.684,"y":186.352},{"x":186.352,"y":167.684}],"homeLane":[{"x":212.906,"y":252.131},{"x":226.196,"y":261.878},{"x":239.487,"y":271.624},{"x":252.778,"y":281.371},{"x":266.069,"y":291.117}],"finishSlots":[{"x":289.289,"y":301.309},{"x":301.309,"y":289.289},{"x":277.269,"y":289.289},{"x":289.289,"y":277.269}]},{"index":1,"color":"red","startIndex":6,"starIndex":0,"homeEntryIndex":5,"baseSlots":[{"x":514.98,"y":186.352},{"x":533.648,"y":205.02},{"x":533.648,"y":167.684},{"x":552.316,"y":186.352}],"homeLane":[{"x":467.869,"y":212.906},{"x":458.122,"y":226.196},{"x":448.376,"y":239.487},{"x":438.629,"y":252.778},{"x":428.883,"y":266.069}],"finishSlots":[{"x":418.691,"y":289.289},{"x":430.711,"y":301.309},{"x":430.711,"y":277.269},{"x":442.731,"y":289.289}]},{"index":2,"color":"blue","startIndex":19,"starIndex":13,"homeEntryIndex":18,"baseSlots":[{"x":533.648,"y":514.98},{"x":514.98,"y":533.648},{"x":552.316,"y":533.648},{"x":533.648,"y":552.316}],"homeLane":[{"x":507.094,"y":467.869},{"x":493.804,"y":458.122},{"x":480.513,"y":448.376},{"x":467.222,"y":438.629},{"x":453.931,"y":428.883}],"finishSlots":[{"x":430.711,"y":418.691},{"x":418.691,"y":430.711},{"x":442.731,"y":430.711},{"x":430.711,"y":442.731}]},{"index":3,"color":"yellow","startIndex":32,"starIndex":26,"homeEntryIndex":31,"baseSlots":[{"x":205.02,"y":533.648},{"x":186.352,"y":514.98},{"x":186.352,"y":552.316},{"x":167.684,"y":533.648}],"homeLane":[{"x":252.131,"y":507.094},{"x":261.878,"y":493.804},{"x":271.624,"y":480.513},{"x":281.371,"y":467.222},{"x":291.117,"y":453.931}],"finishSlots":[{"x":301.309,"y":430.711},{"x":289.289,"y":418.691},{"x":289.289,"y":442.731},{"x":277.269,"y":430.711}]}];
export const DIAMOND_GEOMETRY = Object.freeze({
  id:'DIAMOND',
  sides:4,
  maxPlayers:4,
  trackLength:52,
  homeCells:5,
  cellPitch:21.385,
  minTrackPitch:21.385,
  maxTrackPitch:30.243,
  tileSize:23.42,
  pawnDiameter:15.5,
  pawnDiameterRatio:15.5/21.385,
  safeIndices:Object.freeze([0,6,13,19,26,32,39,45]),
  track:Object.freeze(track),
  arms:Object.freeze(armData.map((arm)=>Object.freeze({
    index:arm.index,
    player:Object.freeze({id:arm.color,label:arm.color.toUpperCase()}),
    startIndex:arm.startIndex,
    starIndex:arm.starIndex,
    homeEntryIndex:arm.homeEntryIndex,
    baseSlots:Object.freeze(arm.baseSlots),
    homeLane:Object.freeze(arm.homeLane),
    finishSlots:Object.freeze(arm.finishSlots),
  }))),
});
const patterns = {
  1:[[0,0]],
  2:[[-.18,0],[.18,0]],
  3:[[0,-.17],[-.17,.17],[.17,.17]],
  4:[[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]],
};
const scales = {1:1,2:.54,3:.50,4:.46};
export function getDiamondGeometry(){ return DIAMOND_GEOMETRY; }
export function getDiamondStackLayout(count){
  if(!Number.isInteger(count)||count<0)throw new RangeError('Token count must be a non-negative integer.');
  const visible=Math.min(count,4),offsets=patterns[visible]||[];
  return {
    hiddenCount:Math.max(0,count-visible),
    tokens:Array.from({length:count},(_,index)=>{
      if(index>=visible)return{index,x:0,y:0,scale:0,diameter:DIAMOND_GEOMETRY.pawnDiameter,visible:false};
      const [x,y]=offsets[index],scale=scales[visible];
      return{index,x:x*DIAMOND_GEOMETRY.cellPitch,y:y*DIAMOND_GEOMETRY.cellPitch,scale,diameter:DIAMOND_GEOMETRY.pawnDiameter,visible:true};
    }),
  };
}
export function assertDiamondGeometry(){
  const g=DIAMOND_GEOMETRY;
  if(g.track.length!==52||g.arms.length!==4||g.safeIndices.length!==8)throw new Error('Diamond board counts are invalid.');
  const ids=new Set(g.track.map(p=>p.index));
  if(ids.size!==52)throw new Error('Diamond route indices must be unique.');
  for(const arm of g.arms){
    if(arm.homeLane.length!==5||arm.baseSlots.length!==4||arm.finishSlots.length!==4)throw new Error('Diamond player geometry is incomplete.');
    if(g.track[arm.startIndex].index!==arm.startIndex)throw new Error('Diamond start index is invalid.');
  }
  return true;
}
