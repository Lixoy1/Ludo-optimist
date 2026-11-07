/** Canonical HEXA and ROYAL geometry. All logical routes are independent of SVG painting. */
export const BASE_CELL_SIZE=128;
export const BOARD_THEMES=Object.freeze({
 classic:{bg:'#10131b',outer:'#4c3828',board:'#80603e',cell:'#fff8e8',tile2:'#ead8b8',edge:'#98734c',gold:'#d9ae60',shadow:'#08090d',ink:'#302417',accent:'#f2dba8',glow:'#f1c96d',baseBg:'#34271d'},
 neon:{bg:'#070a14',outer:'#11182a',board:'#141c2f',cell:'#fff9ed',tile2:'#e7d9bf',edge:'#9e8a67',gold:'#f2c66f',shadow:'#03050b',ink:'#1e2430',accent:'#fff0c8',glow:'#64dfff',baseBg:'#11182a'},
 elite:{bg:'#090807',outer:'#29180f',board:'#3a2418',cell:'#f4e4c7',tile2:'#d8bf94',edge:'#997144',gold:'#e8c278',shadow:'#080504',ink:'#342317',accent:'#ffebbd',glow:'#d9a74c',baseBg:'#32180f'},
 marble:{bg:'#09111a',outer:'#1e3340',board:'#2d4350',cell:'#f8fcff',tile2:'#d7e4ea',edge:'#91aab7',gold:'#c2dce7',shadow:'#050a10',ink:'#263f4d',accent:'#edfaff',glow:'#92d9ef',baseBg:'#203746'}
});
export const BOARD_PLAYER_COLORS=Object.freeze({
 hexa:[
  {id:'blue',label:'BLUE',color:'#168BFF',dark:'#075A8E'},{id:'red',label:'RED',color:'#F02D3A',dark:'#851A2B'},
  {id:'yellow',label:'YELLOW',color:'#F5B51B',dark:'#8C5A09'},{id:'purple',label:'PURPLE',color:'#A52BEA',dark:'#51268D'},
  {id:'green',label:'GREEN',color:'#18B94B',dark:'#12623B'},{id:'cyan',label:'CYAN',color:'#13C9D8',dark:'#08727D'}
 ],
 royal:[
  {id:'blue',label:'BLUE',color:'#168BFF',dark:'#075A8E'},{id:'red',label:'RED',color:'#F02D3A',dark:'#851A2B'},
  {id:'yellow',label:'YELLOW',color:'#F5B51B',dark:'#8C5A09'},{id:'green',label:'GREEN',color:'#18B94B',dark:'#12623B'}
 ]
});
const VIEW=720,C=128,fmt=n=>Number(n.toFixed(3)),pt=(x,y)=>({x:fmt(x),y:fmt(y)});
function rotate(x,y,cx,cy,degrees){const a=degrees*Math.PI/180,co=Math.cos(a),si=Math.sin(a),dx=x-cx,dy=y-cy;return{x:cx+dx*co-dy*si,y:cy+dx*si+dy*co};}
function scaled(p,s){return pt(p.x*s,p.y*s);}
function polygon(sides,r,cx,cy,offset=-90){return Array.from({length:sides},(_,i)=>{const a=(offset+i*360/sides)*Math.PI/180;return pt(cx+Math.cos(a)*r,cy+Math.sin(a)*r);});}
function pawnSlots(center,angle,scale){const off=.8*C,a=angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a);return[[-off,-off],[off,-off],[-off,off],[off,off]].map(([x,y],slotIndex)=>({...scaled({x:center.x+x*co-y*si,y:center.y+x*si+y*co},scale),slotIndex}));}
function finishSlots(center,angle,scale){const a=angle*Math.PI/180,out=[];for(const r of [.58*C,1.12*C])for(const t of [-.22*C,.22*C])out.push({...scaled(rotate(center.x+t,center.y-r,center.x,center.y,angle),scale),slotIndex:out.length});return out;}
function makeHexa(){
 const nativeSize=2560,cx=1280,cy=1280,s=VIEW/nativeSize,R0=3.10*C,colors=BOARD_PLAYER_COLORS.hexa;
 const starts=Object.fromEntries(colors.map((p,i)=>[p.id,i*12]));
 const entries=Object.fromEntries(colors.map(p=>[p.id,(starts[p.id]+71)%72]));
 const safe=[...new Set([...colors.map(p=>starts[p.id]),...colors.map(p=>(starts[p.id]+6)%72)])].sort((a,b)=>a-b),track=[];
 // One route: six cells on the current ray's right rail, then six on the next ray's left rail.
 for(let sector=0;sector<6;sector++){
  for(let j=0;j<6;j++){const k=5-j,q=rotate(cx+C,cy-(R0+k*C),cx,cy,sector*60);track.push({index:track.length,sector,lane:'right',row:k,rotation:sector*60,nativeX:fmt(q.x),nativeY:fmt(q.y),x:fmt(q.x*s),y:fmt(q.y*s)});}
  for(let j=0;j<6;j++){const k=j,q=rotate(cx-C,cy-(R0+k*C),cx,cy,(sector+1)*60);track.push({index:track.length,sector,lane:'left-next',row:k,rotation:(sector+1)*60,nativeX:fmt(q.x),nativeY:fmt(q.y),x:fmt(q.x*s),y:fmt(q.y*s)});}
 }
 const arms=colors.map((player,index)=>{
  const angle=index*60,homeLane=Array.from({length:6},(_,h)=>{const q=rotate(cx,cy-(R0+(5-h)*C),cx,cy,angle);return{...scaled(q,s),nativeX:fmt(q.x),nativeY:fmt(q.y),homeIndex:h+1,rotation:angle};});
  const baseAngle=-30+index*60,base=rotate(cx,cy-7.2*C,cx,cy,baseAngle);
  return{index,player,angle,startIndex:starts[player.id],homeEntryIndex:entries[player.id],starIndex:(starts[player.id]+6)%72,homeLane,baseCenter:scaled(base,s),baseSlots:pawnSlots(base,baseAngle,s),baseRadius:2.1*C*s,baseRotation:baseAngle,finishSlots:finishSlots({x:cx,y:cy},angle,s)};
 });
 track.forEach(cell=>{cell.safe=safe.includes(cell.index);cell.startFor=colors.find(p=>starts[p.id]===cell.index)?.id||null;cell.entryFor=colors.find(p=>entries[p.id]===cell.index)?.id||null;});
 const outline=[];for(let i=0;i<6;i++){outline.push(scaled(rotate(cx,cy-9.55*C,cx,cy,i*60),s),scaled(rotate(cx,cy-5.35*C,cx,cy,i*60+30),s));}
 return{id:'hexa',boardId:'hexa',shape:'six-point-star',sides:6,maxPlayers:6,tokensPerPlayer:4,canvasSize:nativeSize,cellSize:C,artScale:s,trackLength:72,maxOuterSteps:71,homeCells:6,finishStep:78,startIndices:starts,homeEntryIndices:entries,safeIndices:safe,cellPitch:C*s,tileSize:.96*C*s,safeAreaSize:.8*C*s,pawnDiameter:.68*C*s,pawnMaxWidth:.82*C*s,center:scaled({x:cx,y:cy},s),track,arms,outline,finishVertices:polygon(6,1.732*C,cx,cy).map(p=>scaled(p,s)),routeLinkDistances:[...new Set(track.map((p,i)=>fmt(Math.hypot(track[(i+1)%72].x-p.x,track[(i+1)%72].y-p.y)/(C*s))))].sort((a,b)=>a-b)};
}
function makeRoyal(){
 const nativeSize=2816,cx=1408,cy=1408,s=VIEW/nativeSize,grid=19,L=8,mid=9,origin=(nativeSize-grid*C)/2,colors=BOARD_PLAYER_COLORS.royal;
 const starts={blue:0,red:17,yellow:34,green:51},entries=Object.fromEntries(colors.map(p=>[p.id,(starts[p.id]+66)%68]));
 const safe=[...new Set(colors.flatMap(p=>[starts[p.id],starts[p.id]+6,starts[p.id]+12]))].sort((a,b)=>a-b);
 const sectorPath=[];for(let row=1;row<L;row++)sectorPath.push([mid+1,row]);for(let col=mid+2;col<grid;col++)sectorPath.push([col,mid-1]);sectorPath.push([grid-1,mid],[grid-1,mid+1]);
 const gridCenter=(col,row)=>({x:origin+(col+.5)*C,y:origin+(row+.5)*C}),track=[];
 for(let sector=0;sector<4;sector++)for(const[col,row]of sectorPath){const p=gridCenter(col,row),q=rotate(p.x,p.y,cx,cy,sector*90);track.push({index:track.length,sector,col,row,rotation:sector*90,nativeX:fmt(q.x),nativeY:fmt(q.y),x:fmt(q.x*s),y:fmt(q.y*s)});}
 const arms=colors.map((player,index)=>{
  const angle=index*90,base=rotate(origin+(L/2)*C,origin+(L/2)*C,cx,cy,angle),homeLane=Array.from({length:7},(_,h)=>{const q=rotate(...Object.values(gridCenter(mid,h+1)),cx,cy,angle);return{...scaled(q,s),nativeX:fmt(q.x),nativeY:fmt(q.y),homeIndex:h+1,rotation:angle};});
  return{index,player,angle,startIndex:starts[player.id],homeEntryIndex:entries[player.id],smallStarIndex:starts[player.id]+6,royalSafeIndex:starts[player.id]+12,homeLane,baseCenter:scaled(base,s),baseSlots:pawnSlots(base,angle,s),baseRadius:3.9*C*s,baseRotation:angle,finishSlots:finishSlots({x:cx,y:cy},angle,s)};
 });
 track.forEach(cell=>{cell.safe=safe.includes(cell.index);cell.startFor=colors.find(p=>starts[p.id]===cell.index)?.id||null;cell.entryFor=colors.find(p=>entries[p.id]===cell.index)?.id||null;});
 return{id:'royal',boardId:'royal',shape:'royal-octagon',sides:4,maxPlayers:4,tokensPerPlayer:4,canvasSize:nativeSize,cellSize:C,artScale:s,trackLength:68,maxOuterSteps:66,homeCells:7,finishStep:74,startIndices:starts,homeEntryIndices:entries,safeIndices:safe,cellPitch:C*s,tileSize:.96*C*s,safeAreaSize:.8*C*s,pawnDiameter:.68*C*s,pawnMaxWidth:.82*C*s,center:scaled({x:cx,y:cy},s),track,arms,outline:polygon(8,10.7*C,cx,cy).map(p=>scaled(p,s)),finishVertices:polygon(4,1.5*C,cx,cy,-45).map(p=>scaled(p,s)),routeLinkDistances:[...new Set(track.map((p,i)=>fmt(Math.hypot(track[(i+1)%68].x-p.x,track[(i+1)%68].y-p.y)/(C*s))))].sort((a,b)=>a-b)};
}
export const EXTENDED_GEOMETRIES=Object.freeze({hexa:makeHexa(),royal:makeRoyal()});
export const EXTENDED_GEOMETRY_IDS=Object.freeze(['hexa','royal']);
export function getExtendedGeometry(id){const g=EXTENDED_GEOMETRIES[String(id||'').toLowerCase()];if(!g)throw new RangeError('Unknown HEXA/ROYAL geometry.');return g;}
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function tileCorners(p,size,rotation){const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),h=size/2;return[[-h,-h],[h,-h],[h,h],[-h,h]].map(([x,y])=>({x:p.x+x*c-y*s,y:p.y+x*s+y*c}));}
function overlap(a,b){for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],axis={x:-(q.y-p.y),y:q.x-p.x},proj=v=>v.map(x=>x.x*axis.x+x.y*axis.y),pa=proj(a),pb=proj(b);if(Math.max(...pa)<=Math.min(...pb)+1e-5||Math.max(...pb)<=Math.min(...pa)+1e-5)return false;}return true;}
export function assertExtendedGeometry(g){
 if(!g||!['hexa','royal'].includes(g.id))throw new TypeError('Expected HEXA or ROYAL geometry.');
 const n=g.id==='hexa'?6:4,per=g.id==='hexa'?12:17;
 if(g.track.length!==n*per||g.trackLength!==n*per||g.arms.length!==n)throw new Error('Track/sector counts are invalid.');
 if(g.safeIndices.length!==12||new Set(g.track.map(p=>p.index)).size!==g.trackLength||new Set(g.track.map(p=>p.nativeX+','+p.nativeY)).size!==g.trackLength)throw new Error('Indices, safe cells or route centres are invalid.');
 for(const arm of g.arms){if(arm.homeLane.length!==g.homeCells||arm.baseSlots.length!==4||arm.finishSlots.length!==4)throw new Error('Incomplete player geometry.');if(arm.homeEntryIndex!==(arm.startIndex+g.maxOuterSteps)%g.trackLength)throw new Error('Home-entry index mismatch.');}
 const cells=g.track.map(p=>tileCorners(p,g.tileSize,p.rotation));
 for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++)if(distance(g.track[i],g.track[j])<g.tileSize*1.03&&overlap(cells[i],cells[j]))throw new Error('Overlapping route tiles '+i+' / '+j);
 return true;
}
export function getExtendedStackLayout(id,count){
 const g=getExtendedGeometry(id);if(!Number.isInteger(count)||count<0)throw new RangeError('Stack count must be non-negative.');
 if(!count)return{tokens:[],hiddenCount:0,badge:null};
 if(count===1)return{tokens:[{index:0,x:0,y:0,scale:1,diameter:g.pawnDiameter,visible:true}],hiddenCount:0,badge:null};
 if(count===2){const d=.42*C*g.artScale,dx=.18*C*g.artScale,dy=.10*C*g.artScale;return{tokens:[{index:0,x:-dx,y:-dy,scale:d/g.pawnDiameter,diameter:d,visible:true},{index:1,x:dx,y:dy,scale:d/g.pawnDiameter,diameter:d,visible:true}],hiddenCount:0,badge:null};}
 return{tokens:[{index:0,x:0,y:0,scale:1,diameter:g.pawnDiameter,visible:true},...Array.from({length:count-1},(_,i)=>({index:i+1,x:0,y:0,scale:0,diameter:0,visible:false}))],hiddenCount:count-1,badge:'×'+count};
}
const star=(x,y,r)=>Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,v=i%2?r*.42:r;return(x+Math.cos(a)*v).toFixed(2)+','+(y+Math.sin(a)*v).toFixed(2)}).join(' ');
const path=ps=>ps.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ')+' Z';
export function renderExtendedBoardSvg(g,theme='neon'){
 if(!BOARD_THEMES[theme])throw new RangeError('Unknown theme.');assertExtendedGeometry(g);
 const t=BOARD_THEMES[theme],parts=[],colors=g.arms.map(a=>a.player.color),title=g.id.toUpperCase();
 parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" role="img" aria-label="OPTIMIST LUDO '+title+'"><title>OPTIMIST LUDO — '+title+' — '+theme.toUpperCase()+'</title><defs><linearGradient id="frame" x2="1" y2="1"><stop stop-color="'+t.glow+'"/><stop offset=".35" stop-color="'+t.gold+'"/><stop offset="1" stop-color="'+t.shadow+'"/></linearGradient><linearGradient id="tile" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".55" stop-color="'+t.cell+'"/><stop offset="1" stop-color="'+t.tile2+'"/></linearGradient><radialGradient id="well"><stop stop-color="'+t.baseBg+'"/><stop offset="1" stop-color="#03050a"/></radialGradient></defs>');
 parts.push('<rect width="720" height="720" rx="32" fill="'+t.bg+'"/><path d="'+path(g.outline)+'" fill="url(#frame)" stroke="'+t.gold+'" stroke-width="4"/>');
 const inner=g.outline.map(p=>({x:360+(p.x-360)*.96,y:360+(p.y-360)*.96}));parts.push('<path d="'+path(inner)+'" fill="'+t.board+'" stroke="'+t.shadow+'" stroke-width="5"/>');
 g.arms.forEach(a=>{const c=a.player.color,b=a.baseCenter,r=a.baseRadius;parts.push('<g data-base="'+a.player.id+'"><circle cx="'+b.x+'" cy="'+b.y+'" r="'+r+'" fill="'+t.shadow+'" fill-opacity=".7" stroke="url(#frame)" stroke-width="5"/><circle cx="'+b.x+'" cy="'+b.y+'" r="'+r*.9+'" fill="'+c+'" fill-opacity=".25" stroke="'+c+'" stroke-width="3"/>');a.baseSlots.forEach((p,i)=>parts.push('<circle data-base-slot="'+a.index+':'+i+'" cx="'+p.x+'" cy="'+p.y+'" r="'+g.pawnDiameter*.53+'" fill="url(#well)" stroke="'+t.gold+'" stroke-width="2"/>'));parts.push('</g>');});
 g.track.forEach(cell=>{const size=g.tileSize,fill=cell.startFor?g.arms.find(a=>a.player.id===cell.startFor).player.color:'url(#tile)';parts.push('<g data-track-cell="'+cell.index+'" data-center="'+cell.x+','+cell.y+'" transform="rotate('+cell.rotation+' '+cell.x+' '+cell.y+')"><rect x="'+(cell.x-size/2+1.5)+'" y="'+(cell.y-size/2+2.5)+'" width="'+size+'" height="'+size+'" rx="'+size*.08+'" fill="'+t.shadow+'" opacity=".5"/><rect x="'+(cell.x-size/2)+'" y="'+(cell.y-size/2)+'" width="'+size+'" height="'+size+'" rx="'+size*.08+'" fill="'+fill+'" stroke="'+t.edge+'" stroke-width="1.5"/></g>');if(cell.safe)parts.push('<polygon data-safe-cell="'+cell.index+'" points="'+star(cell.x,cell.y,size*.22)+'" fill="'+t.gold+'" stroke="'+t.ink+'" stroke-width=".7"/>');if(cell.startFor)parts.push('<path d="M'+(cell.x-4)+' '+(cell.y+4)+'l4 -9 4 9h-3v5h-2v-5z" fill="#fff5d8" stroke="'+t.ink+'" stroke-width=".7"/>');});
 g.arms.forEach(a=>a.homeLane.forEach((p,i)=>{const size=g.tileSize,c=a.player.color;parts.push('<g data-home-cell="'+a.index+':'+i+'" transform="rotate('+p.rotation+' '+p.x+' '+p.y+')"><rect x="'+(p.x-size/2)+'" y="'+(p.y-size/2)+'" width="'+size+'" height="'+size+'" rx="'+size*.08+'" fill="'+c+'" stroke="'+t.gold+'" stroke-width="2"/><text x="'+p.x+'" y="'+(p.y+3)+'" fill="#fff" text-anchor="middle" font-family="Arial" font-size="9">H'+(i+1)+'</text></g>');}));
 for(let i=0;i<g.arms.length;i++){const a=g.finishVertices[i],b=g.finishVertices[(i+1)%g.finishVertices.length];parts.push('<path d="M360 360L'+a.x+' '+a.y+'L'+b.x+' '+b.y+'Z" fill="'+colors[i]+'" stroke="'+t.gold+'" stroke-width="2"/>');}
 g.arms.forEach(a=>a.finishSlots.forEach((p,i)=>parts.push('<circle data-finish-slot="'+a.index+':'+i+'" cx="'+p.x+'" cy="'+p.y+'" r="'+g.pawnDiameter*.2+'" fill="url(#well)" stroke="'+t.gold+'" stroke-width="1"/>')));
 parts.push('<circle cx="360" cy="360" r="14" fill="url(#frame)" stroke="'+t.gold+'" stroke-width="2"/><path d="M352 360l3-7 5 4 4-9 4 9 5-4 3 7z" fill="'+t.accent+'"/><text x="360" y="24" fill="'+t.accent+'" font-family="Arial" text-anchor="middle" font-size="10" font-weight="900" letter-spacing="2">OPTIMIST LUDO · '+title+'</text></svg>');
 return parts.join('');
}
