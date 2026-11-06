/**
 * Classic radial Ludo geometries for OPTIMIST LUDO.
 * Each arm is the classic 3-column x 6-row construction:
 * 12 flank squares + 1 outer connector = 13 shared route cells;
 * the centre column's remaining five cells form the private home lane.
 * Original geometry and artwork; only the high-level game topology follows public Ludo rules.
 */
export const EXTENDED_THEMES = Object.freeze({
  classic: { bg:'#090912', outer:'#60412a', board:'#9b7045', cell:'#f7ecd7', tile2:'#ead8b8', edge:'#a67a47', gold:'#e7c47a', shadow:'#09080b', ink:'#392517', accent:'#f2dba8', glow:'#f1c96d', baseBg:'#6f4428' },
  neon: { bg:'#080a13', outer:'#0f1123', board:'#151a30', cell:'#f4efe4', tile2:'#d9d0c0', edge:'#b79b70', gold:'#edc879', shadow:'#04050b', ink:'#281c16', accent:'#f9e5b3', glow:'#65d8ff', baseBg:'#0e1328' },
  elite: { bg:'#080708', outer:'#21120d', board:'#382116', cell:'#efe0c1', tile2:'#d5bd92', edge:'#956c3d', gold:'#e6c276', shadow:'#080504', ink:'#3a2415', accent:'#ffebbd', glow:'#d9a74c', baseBg:'#32180f' },
  marble: { bg:'#09111a', outer:'#1e3340', board:'#2d4350', cell:'#f6fbfd', tile2:'#d7e4ea', edge:'#91aab7', gold:'#c2dce7', shadow:'#050a10', ink:'#263f4d', accent:'#edfaff', glow:'#92d9ef', baseBg:'#203746' },
});
export const EXTENDED_PLAYER_COLORS = Object.freeze({
  penta: [
    { id:'blue', label:'BLUE', color:'#19a8ea', dark:'#075a8e' },
    { id:'red', label:'RED', color:'#f0445b', dark:'#851a2b' },
    { id:'yellow', label:'YELLOW', color:'#f5bb35', dark:'#8c5a09' },
    { id:'green', label:'GREEN', color:'#39b86b', dark:'#12623b' },
    { id:'purple', label:'PURPLE', color:'#a16de9', dark:'#51268d' },
  ],
  hex: [
    { id:'blue', label:'BLUE', color:'#19a8ea', dark:'#075a8e' },
    { id:'red', label:'RED', color:'#f0445b', dark:'#851a2b' },
    { id:'yellow', label:'YELLOW', color:'#f5bb35', dark:'#8c5a09' },
    { id:'green', label:'GREEN', color:'#39b86b', dark:'#12623b' },
    { id:'purple', label:'PURPLE', color:'#a16de9', dark:'#51268d' },
    { id:'orange', label:'ORANGE', color:'#f18440', dark:'#883e17' },
  ],
});
const TAU = Math.PI * 2;
const CENTER = Object.freeze({ x:360, y:360 });
const point = (x,y) => ({ x:Number(x.toFixed(3)), y:Number(y.toFixed(3)) });
const unit = (x,y) => { const length=Math.hypot(x,y)||1; return { x:x/length, y:y/length }; };
const add = (a,b,scale=1) => point(a.x+b.x*scale, a.y+b.y*scale);
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
function regularVertices(sides,radius,offset=-Math.PI/2) {
  return Array.from({length:sides},(_,i)=>{
    const angle=offset+i*TAU/sides;
    return point(CENTER.x+Math.cos(angle)*radius,CENTER.y+Math.sin(angle)*radius);
  });
}
function makeGeometry(id,sides) {
  const h=Math.PI/sides;
  const routeToInnerRatio=(Math.cos(h)+.5)/Math.sin(h);
  const boardRadius=260;
  const cellPitch=boardRadius/(5+routeToInnerRatio);
  const innerRadius=routeToInnerRatio*cellPitch;
  const frameRadius=348;
  const baseAngles=Array.from({length:sides},(_,i)=>-Math.PI/2+i*TAU/sides);
  const armAngles=Array.from({length:sides},(_,i)=>-Math.PI/2+(i+.5)*TAU/sides);
  const track=[];
  const arms=[];
  const colors=EXTENDED_PLAYER_COLORS[id];
  for(let armIndex=0;armIndex<sides;armIndex+=1) {
    const angle=armAngles[armIndex];
    const outward={x:Math.cos(angle),y:Math.sin(angle)};
    const tangent={x:-Math.sin(angle),y:Math.cos(angle)};
    const sideCells=new Map();
    const centerCells=new Map();
    for(let row=0;row<6;row+=1) {
      const radial=boardRadius-row*cellPitch;
      for(const column of [-1,1]) {
        sideCells.set(column+':'+row,point(
          CENTER.x+outward.x*radial+tangent.x*column*cellPitch,
          CENTER.y+outward.y*radial+tangent.y*column*cellPitch
        ));
      }
      centerCells.set(row,point(CENTER.x+outward.x*radial,CENTER.y+outward.y*radial));
    }
    const armTrackStart=track.length;
    for(let row=5;row>=0;row-=1) {
      const p=sideCells.get('-1:'+row);
      track.push({index:track.length,arm:armIndex,column:-1,row,x:p.x,y:p.y,kind:'flank'});
    }
    const connector=centerCells.get(0);
    track.push({index:track.length,arm:armIndex,column:0,row:0,x:connector.x,y:connector.y,kind:'connector'});
    for(let row=0;row<6;row+=1) {
      const p=sideCells.get('1:'+row);
      track.push({index:track.length,arm:armIndex,column:1,row,x:p.x,y:p.y,kind:'flank'});
    }
    const startIndex=armTrackStart+5;
    const starIndex=(startIndex+8)%(sides*13);
    const homeLane=Array.from({length:5},(_,index)=>centerCells.get(index+1));
    const baseAngle=baseAngles[armIndex];
    const baseOutward={x:Math.cos(baseAngle),y:Math.sin(baseAngle)};
    const baseTangent={x:-Math.sin(baseAngle),y:Math.cos(baseAngle)};
    const baseApothem=frameRadius*Math.cos(h);
    const cornerOffset=frameRadius*Math.sin(h);
    const apexRadius=sides===5?162:178;
    const apex=add(CENTER,baseOutward,apexRadius);
    const left=point(CENTER.x+baseOutward.x*baseApothem-baseTangent.x*cornerOffset,
                     CENTER.y+baseOutward.y*baseApothem-baseTangent.y*cornerOffset);
    const right=point(CENTER.x+baseOutward.x*baseApothem+baseTangent.x*cornerOffset,
                      CENTER.y+baseOutward.y*baseApothem+baseTangent.y*cornerOffset);
    const rowOneRadius=apexRadius+(baseApothem-apexRadius)*.45;
    const rowTwoRadius=apexRadius+(baseApothem-apexRadius)*.76;
    const baseSlots=[
      add(CENTER,baseOutward,rowOneRadius),
      add(add(CENTER,baseOutward,rowOneRadius),baseTangent,-16),
      add(add(CENTER,baseOutward,rowOneRadius),baseTangent,16),
      add(CENTER,baseOutward,rowTwoRadius),
    ];
    const finishSlots=[];
    for(const radius of [31,53]) {
      finishSlots.push(add(add(CENTER,outward,radius),tangent,-9));
      finishSlots.push(add(add(CENTER,outward,radius),tangent,9));
    }
    arms.push({
      index:armIndex,
      player:colors[armIndex],
      angle,
      outward,
      tangent,
      baseAngle,
      triangle:[apex,left,right],
      baseSlots,
      startIndex,
      homeEntryIndex:(startIndex-1)%(sides*13),
      starIndex,
      homeLane,
      finishSlots,
      cellPitch,
      tileSize:cellPitch*.87,
      pawnDiameter:cellPitch*.82,
    });
  }
  const safeIndices=[...new Set(arms.flatMap(arm=>[arm.startIndex,arm.starIndex]))].sort((a,b)=>a-b);
  const allPoints=[
    ...track.map(cell=>({x:cell.x,y:cell.y})),
    ...arms.flatMap(arm=>[...arm.baseSlots,...arm.homeLane,...arm.finishSlots]),
    ...arms.flatMap(arm=>arm.triangle),
  ];
  const hubRadius=(innerRadius-cellPitch*.5)/Math.cos(h);
  return {
    id,
    sides,
    maxPlayers:sides,
    tokensPerPlayer:4,
    cellsPerArm:13,
    gridColumns:3,
    gridRows:6,
    homeCells:5,
    trackLength:sides*13,
    boardRadius,
    frameRadius,
    cellPitch,
    tileSize:cellPitch*.87,
    innerRadius,
    hubRadius,
    center:CENTER,
    baseAngles,
    armAngles,
    players:arms,
    arms,
    track,
    safeIndices,
    homeVertices:regularVertices(sides,hubRadius),
    pawnDiameterRatio:.82,
    stackLayout:{
      1:{scale:1,offsets:[[0,0]]},
      2:{scale:.68,offsets:[[-.15,0],[.15,0]]},
      3:{scale:.64,offsets:[[0,-.16],[-.16,.16],[.16,.16]]},
      4:{scale:.61,offsets:[[-.17,-.17],[.17,-.17],[-.17,.17],[.17,.17]]},
    },
    touchTargetCssPx:48,
    bounds:{
      minX:Math.min(...allPoints.map(p=>p.x)),
      maxX:Math.max(...allPoints.map(p=>p.x)),
      minY:Math.min(...allPoints.map(p=>p.y)),
      maxY:Math.max(...allPoints.map(p=>p.y)),
    },
  };
}
export const EXTENDED_GEOMETRIES=Object.freeze({
  penta:makeGeometry('penta',5),
  hex:makeGeometry('hex',6),
});
export const EXTENDED_GEOMETRY_IDS=Object.freeze(['penta','hex']);
export function getExtendedGeometry(id) {
  const geometry=EXTENDED_GEOMETRIES[String(id||'').toLowerCase()];
  if(!geometry) throw new RangeError('Unknown extended board geometry.');
  return geometry;
}
export function distance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }
export function pointInTriangle(p,triangle,epsilon=.001) {
  const [a,b,c]=triangle;
  const v0={x:b.x-a.x,y:b.y-a.y},v1={x:c.x-a.x,y:c.y-a.y},v2={x:p.x-a.x,y:p.y-a.y};
  const den=v0.x*v1.y-v1.x*v0.y;
  const u=(v2.x*v1.y-v1.x*v2.y)/den;
  const v=(v0.x*v2.y-v0.y*v2.x)/den;
  const w=1-u-v;
  return u>=-epsilon&&v>=-epsilon&&w>=-epsilon;
}
export function getExtendedStackLayout(geometryId,count) {
  const geometry=getExtendedGeometry(geometryId);
  if(!Number.isInteger(count)||count<0) throw new RangeError('Token count must be a non-negative integer.');
  if(count===0) return {tokens:[],hiddenCount:0};
  const visible=Math.min(count,4);
  const config=geometry.stackLayout[visible];
  return {
    hiddenCount:Math.max(0,count-visible),
    tokens:config.offsets.map((offset,index)=>({
      index,
      x:offset[0]*geometry.cellPitch,
      y:offset[1]*geometry.cellPitch,
      scale:config.scale,
      diameter:geometry.pawnDiameter*config.scale,
    })),
  };
}
export function assertExtendedGeometry(geometry) {
  if(!geometry||![5,6].includes(geometry.sides)) throw new TypeError('Only PENTA and HEX are supported.');
  if(geometry.track.length!==geometry.sides*13) throw new Error('Shared track must have 13 cells per arm.');
  if(geometry.arms.length!==geometry.sides) throw new Error('Every player must have one classic three-column arm.');
  if(geometry.safeIndices.length!==geometry.sides*2) throw new Error('Every player must have two safe squares.');
  const keys=new Set(geometry.track.map(cell=>cell.x.toFixed(3)+','+cell.y.toFixed(3)));
  if(keys.size!==geometry.trackLength) throw new Error('Route cell centers must be unique.');
  const pitch=geometry.cellPitch;
  for(let i=0;i<geometry.track.length;i+=1) {
    const next=geometry.track[(i+1)%geometry.track.length];
    if(Math.abs(distance(geometry.track[i],next)-pitch)>.02) throw new Error('Shared route has a broken cell-to-cell connection.');
  }
  for(const arm of geometry.arms) {
    if(arm.homeLane.length!==5||arm.baseSlots.length!==4||arm.finishSlots.length!==4) throw new Error('Every player must have 4 base slots, 5 home cells and 4 finish slots.');
    if(arm.starIndex!==(arm.startIndex+8)%geometry.trackLength) throw new Error('Star safety position must be eight route steps after start.');
    if(!arm.baseSlots.every(p=>pointInTriangle(p,arm.triangle))) throw new Error('A pawn well lies outside its triangular base.');
    if(arm.baseSlots.some(p=>p.x<0||p.y<0||p.x>720||p.y>720)) throw new Error('Base slot outside board art.');
  }
  return true;
}
function poly(points) {
  return points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ')+' Z';
}
function starPoints(x,y,r) {
  return Array.from({length:10},(_,i)=>{
    const angle=-Math.PI/2+i*Math.PI/5;
    const radius=i%2?r*.42:r;
    return (x+Math.cos(angle)*radius).toFixed(2)+','+(y+Math.sin(angle)*radius).toFixed(2);
  }).join(' ');
}
export function renderExtendedBoardSvg(geometry,theme='neon') {
  if(!EXTENDED_THEMES[theme]) throw new RangeError('Unknown board theme.');
  if(!geometry||![5,6].includes(geometry.sides)) throw new TypeError('Expected PENTA or HEX geometry.');
  const s=EXTENDED_THEMES[theme],n=geometry.sides,parts=[],safeStarIndices=new Set(geometry.arms.map(arm=>arm.starIndex));
  const fmt=v=>Number(v).toFixed(2);
  const polygon=pts=>poly(pts);
  const square=(x,y,size,fill,stroke,extra='')=>{
    const half=size/2;
    return '<g '+extra+'><rect x="'+fmt(x-half+1.8)+'" y="'+fmt(y-half+3)+'" width="'+fmt(size)+'" height="'+fmt(size)+'" rx="3.5" fill="'+s.shadow+'" opacity=".52"/>'+
      '<rect x="'+fmt(x-half)+'" y="'+fmt(y-half)+'" width="'+fmt(size)+'" height="'+fmt(size)+'" rx="3.5" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.7"/>'+
      '<rect x="'+fmt(x-half+2.2)+'" y="'+fmt(y-half+2.2)+'" width="'+fmt(size-4.4)+'" height="'+fmt(size-4.4)+'" rx="2.2" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width=".8"/>'+
      '<path d="M'+fmt(x-half+4)+' '+fmt(y-half+3)+'h'+fmt(size-8)+'" stroke="#fff" stroke-opacity=".28" stroke-width="1.2"/></g>';
  };
  const frame=regularVertices(n,348),inner=regularVertices(n,337);
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" role="img" aria-label="OPTIMIST LUDO '+n+' players '+theme+'"><title>OPTIMIST LUDO — '+(n===5?'PENTA':'HEX')+' — '+theme.toUpperCase()+'</title><defs>');
  parts.push('<linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+s.glow+'"/><stop offset=".2" stop-color="'+s.gold+'"/><stop offset=".52" stop-color="'+s.outer+'"/><stop offset=".8" stop-color="'+s.gold+'"/><stop offset="1" stop-color="'+s.shadow+'"/></linearGradient>');
  parts.push('<linearGradient id="surface" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+s.board+'"/><stop offset=".52" stop-color="'+s.bg+'"/><stop offset="1" stop-color="'+s.outer+'"/></linearGradient>');
  parts.push('<linearGradient id="tile" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#fff"/><stop offset=".55" stop-color="'+s.cell+'"/><stop offset="1" stop-color="'+s.tile2+'"/></linearGradient>');
  parts.push('<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4cf"/><stop offset=".48" stop-color="'+s.gold+'"/><stop offset="1" stop-color="#76502b"/></linearGradient>');
  parts.push('<radialGradient id="well" cx=".28" cy=".2" r=".95"><stop stop-color="#8793a5"/><stop offset=".25" stop-color="'+s.baseBg+'"/><stop offset="1" stop-color="#03050a"/></radialGradient>');
  parts.push('<filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter>');
  parts.push('<pattern id="grain" width="66" height="66" patternUnits="userSpaceOnUse"><path d="M-4 14Q22 4 70 18M-8 43Q24 32 74 46M5 63Q32 54 72 64" fill="none" stroke="'+s.accent+'" stroke-opacity=".085" stroke-width="2"/></pattern>');
  parts.push('<pattern id="marble" width="124" height="124" patternUnits="userSpaceOnUse"><path d="M-12 32Q25 1 59 34T137 26M-10 91Q27 65 62 96T138 85" fill="none" stroke="'+s.accent+'" stroke-opacity=".16" stroke-width="3"/><path d="M-12 36Q25 5 59 38T137 30" fill="none" stroke="'+s.glow+'" stroke-opacity=".11" stroke-width="1"/></pattern>');
  parts.push('</defs>');
  parts.push('<rect width="720" height="720" rx="34" fill="'+s.bg+'"/><path d="'+polygon(frame)+'" fill="url(#frame)" stroke="'+s.gold+'" stroke-width="2.2"/><path d="'+polygon(inner)+'" fill="url(#surface)" stroke="'+s.shadow+'" stroke-width="5"/>');
  if(theme==='classic') parts.push('<path d="'+polygon(inner)+'" fill="url(#grain)" opacity=".8"/>');
  if(theme==='marble') parts.push('<path d="'+polygon(inner)+'" fill="url(#marble)" opacity=".9"/>');
  if(theme==='neon') parts.push('<g opacity=".24" filter="url(#softShadow)" fill="none" stroke-linecap="round"><path d="M55 100Q125 42 188 76T280 50M442 62Q540 20 665 105M52 602Q140 668 232 626M488 648Q585 690 672 590" stroke="#a64dff" stroke-width="8"/><path d="M48 150Q105 105 164 138M558 132Q624 88 674 150" stroke="#32d8ff" stroke-width="5"/></g>');
  parts.push('<path d="'+polygon(frame)+'" fill="none" stroke="'+s.accent+'" stroke-opacity=".35" stroke-width="1.2"/>');

  // The whole 3×6 arm plate is visible: two shared-track columns and the five-cell private home column.
  for(const arm of geometry.arms) {
    const o=arm.outward,t=arm.tangent,p=geometry.cellPitch;
    const corners=[
      {x:360+o.x*(geometry.boardRadius+p*.55)+t.x*(-1.5*p),y:360+o.y*(geometry.boardRadius+p*.55)+t.y*(-1.5*p)},
      {x:360+o.x*(geometry.boardRadius+p*.55)+t.x*(1.5*p),y:360+o.y*(geometry.boardRadius+p*.55)+t.y*(1.5*p)},
      {x:360+o.x*(geometry.boardRadius-5.5*p)+t.x*(1.5*p),y:360+o.y*(geometry.boardRadius-5.5*p)+t.y*(1.5*p)},
      {x:360+o.x*(geometry.boardRadius-5.5*p)+t.x*(-1.5*p),y:360+o.y*(geometry.boardRadius-5.5*p)+t.y*(-1.5*p)}
    ];
    parts.push('<path d="'+polygon(corners)+'" fill="'+s.outer+'" fill-opacity=".32" stroke="'+s.gold+'" stroke-opacity=".3" stroke-width="1.3"/>');
  }

  // Triangular yards sit between the radial arms, not in square corner boxes.
  for(const arm of geometry.arms) {
    const color=arm.player.color,tri=arm.triangle;
    parts.push('<path d="'+polygon(tri)+'" fill="'+color+'" fill-opacity=".32" stroke="url(#gold)" stroke-width="4" stroke-linejoin="round"/>');
    const [apex,left,right]=tri;
    const inset=[{x:apex.x*.91+(left.x+right.x)*.045,y:apex.y*.91+(left.y+right.y)*.045},
      {x:left.x*.91+apex.x*.09,y:left.y*.91+apex.y*.09},
      {x:right.x*.91+apex.x*.09,y:right.y*.91+apex.y*.09}];
    parts.push('<path d="'+polygon(inset)+'" fill="none" stroke="'+color+'" stroke-width="2.2" stroke-opacity=".95"/>');
    const mid={x:(left.x+right.x)/2,y:(left.y+right.y)/2};
    parts.push('<text x="'+fmt(mid.x)+'" y="'+fmt(mid.y-5)+'" text-anchor="middle" fill="#fff4d8" font-family="Arial,sans-serif" font-size="10" font-weight="900" letter-spacing="1.5">'+arm.player.label+'</text>');
    arm.baseSlots.forEach((q,i)=>{
      parts.push('<circle data-base-slot="'+arm.index+':'+i+'" cx="'+fmt(q.x)+'" cy="'+fmt(q.y)+'" r="'+fmt(p*.32)+'" fill="url(#gold)" stroke="'+s.shadow+'" stroke-width="1.2"/>');
      parts.push('<circle cx="'+fmt(q.x)+'" cy="'+fmt(q.y)+'" r="'+fmt(p*.265)+'" fill="url(#well)" stroke="'+color+'" stroke-width="1.8"/>');
      parts.push('<circle cx="'+fmt(q.x-p*.07)+'" cy="'+fmt(q.y-p*.07)+'" r="'+fmt(p*.045)+'" fill="#fff" fill-opacity=".35"/>');
    });
  }

  // Shared loop cells: 13 per arm. The 3-column grid is retained exactly.
  for(const cell of geometry.track) {
    const arm=geometry.arms[cell.arm],isStart=cell.index===arm.startIndex,isStar=safeStarIndices.has(cell.index);
    const size=geometry.tileSize,rot=arm.angle*180/Math.PI,fill=isStart?arm.player.color:'url(#tile)',stroke=isStart?'url(#gold)':s.edge;
    parts.push(square(cell.x,cell.y,size,fill,stroke,'data-track-cell="'+cell.index+'" transform="rotate('+fmt(rot)+' '+fmt(cell.x)+' '+fmt(cell.y)+')"'));
    if(isStart) parts.push('<path d="M'+fmt(cell.x-4)+' '+fmt(cell.y+2)+'l4 -8 4 8h-2v5h-4v-5z" fill="#fff4d5" stroke="'+s.shadow+'" stroke-width=".65" transform="rotate('+fmt(rot)+' '+fmt(cell.x)+' '+fmt(cell.y)+')"/>');
    if(isStar) parts.push('<polygon data-safe-cell="'+cell.index+'" points="'+starPoints(cell.x,cell.y,size*.22)+'" fill="url(#gold)" stroke="'+s.shadow+'" stroke-width=".7"/>');
  }

  // Private five-cell home lane, in the centre column of each classic arm.
  for(const arm of geometry.arms) arm.homeLane.forEach((q,index)=>{
    const size=geometry.tileSize,rot=arm.angle*180/Math.PI,color=arm.player.color;
    parts.push(square(q.x,q.y,size,color,'url(#gold)','data-home-cell="'+arm.index+':'+index+'" transform="rotate('+fmt(rot)+' '+fmt(q.x)+' '+fmt(q.y)+')"'));
    parts.push('<circle cx="'+fmt(q.x)+'" cy="'+fmt(q.y)+'" r="'+fmt(size*.09)+'" fill="#fff4d0" fill-opacity=".58"/>');
  });

  // The finish is a true polygonal home divided into one coloured wedge per player.
  for(let i=0;i<n;i++) {
    const a=geometry.homeVertices[i],b=geometry.homeVertices[(i+1)%n],arm=geometry.arms[i],color=arm.player.color;
    parts.push('<path d="M360 360L'+fmt(a.x)+' '+fmt(a.y)+'L'+fmt(b.x)+' '+fmt(b.y)+'Z" fill="'+color+'" fill-opacity=".88" stroke="url(#gold)" stroke-width="2.2" stroke-linejoin="round"/>');
    arm.finishSlots.forEach((q,index)=>{
      parts.push('<circle data-finish-slot="'+arm.index+':'+index+'" cx="'+fmt(q.x)+'" cy="'+fmt(q.y)+'" r="'+fmt(geometry.cellPitch*.19)+'" fill="url(#gold)" stroke="'+s.shadow+'" stroke-width="1.1"/>');
      parts.push('<circle cx="'+fmt(q.x)+'" cy="'+fmt(q.y)+'" r="'+fmt(geometry.cellPitch*.125)+'" fill="url(#well)" stroke="'+s.accent+'" stroke-opacity=".8" stroke-width=".8"/>');
    });
  }
  const hub=n===5?17:19;
  parts.push('<circle cx="360" cy="360" r="'+(hub+5)+'" fill="url(#frame)" stroke="'+s.gold+'" stroke-width="1.8"/><circle cx="360" cy="360" r="'+hub+'" fill="'+s.bg+'" stroke="'+s.accent+'" stroke-opacity=".55" stroke-width="1"/>');
  parts.push('<path d="M348 362l3-9 6 5 3-12 4 12 6-5 3 9z" fill="url(#gold)" stroke="'+s.shadow+'" stroke-width=".8"/>');
  parts.push('<text x="360" y="379" text-anchor="middle" fill="'+s.accent+'" font-family="Arial,sans-serif" font-size="5.5" font-weight="900" letter-spacing=".8">OPTIMIST</text>');
  parts.push('<text x="360" y="31" text-anchor="middle" fill="'+s.accent+'" font-family="Arial,sans-serif" font-size="10" font-weight="900" letter-spacing="2.4">OPTIMIST LUDO · '+(n===5?'PENTA':'HEX')+'</text>');
  parts.push('<text x="360" y="692" text-anchor="middle" fill="'+s.accent+'" font-family="Arial,sans-serif" font-size="8" font-weight="800" letter-spacing="2">PLAY BRIGHT · MOVE SMART</text>');
  for(const [x,y] of [[31,31],[689,31],[31,689],[689,689]]) parts.push('<circle cx="'+x+'" cy="'+y+'" r="5.5" fill="url(#gold)" stroke="'+s.shadow+'" stroke-width="1"/>');
  parts.push('</svg>');
  return parts.join('');
}
