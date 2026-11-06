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
  const style=EXTENDED_THEMES[theme];
  const n=geometry.sides;
  const frame=regularVertices(n,348),inset=regularVertices(n,338);
  const parts=[];
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" role="img" aria-label="OPTIMIST LUDO '+n+' players '+theme+'">');
  parts.push('<title>OPTIMIST LUDO — '+n+' PLAYERS — '+theme.toUpperCase()+'</title><defs>');
  parts.push('<linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+style.glow+'"/><stop offset=".22" stop-color="'+style.gold+'"/><stop offset=".52" stop-color="'+style.outer+'"/><stop offset=".78" stop-color="'+style.gold+'"/><stop offset="1" stop-color="'+style.shadow+'"/></linearGradient>');
  parts.push('<linearGradient id="surface" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+style.board+'"/><stop offset=".5" stop-color="'+style.bg+'"/><stop offset="1" stop-color="'+style.outer+'"/></linearGradient>');
  parts.push('<linearGradient id="ivory" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fffefb"/><stop offset=".52" stop-color="'+style.cell+'"/><stop offset="1" stop-color="'+style.tile2+'"/></linearGradient>');
  parts.push('<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1bc"/><stop offset=".45" stop-color="'+style.gold+'"/><stop offset="1" stop-color="#8d5f2a"/></linearGradient>');
  parts.push('<radialGradient id="well" cx=".3" cy=".22" r=".9"><stop stop-color="#67778a"/><stop offset=".26" stop-color="'+style.baseBg+'"/><stop offset="1" stop-color="#05070d"/></radialGradient>');
  parts.push('<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
  parts.push('<pattern id="grain" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M0 13Q19 5 66 17M-8 39Q24 30 72 43M4 59Q28 51 70 61" fill="none" stroke="'+style.accent+'" stroke-opacity=".07" stroke-width="2"/></pattern>');
  parts.push('<pattern id="marble" width="112" height="112" patternUnits="userSpaceOnUse"><path d="M-10 30Q24 2 55 30T128 24M-10 85Q28 62 58 89T128 82" fill="none" stroke="'+style.accent+'" stroke-opacity=".14" stroke-width="3"/><path d="M-10 33Q24 5 55 33T128 27" fill="none" stroke="'+style.glow+'" stroke-opacity=".1" stroke-width="1"/></pattern></defs>');
  parts.push('<rect width="720" height="720" rx="30" fill="'+style.bg+'"/>');
  parts.push('<rect x="8" y="8" width="704" height="704" rx="30" fill="url(#frame)" stroke="'+style.gold+'" stroke-width="1.6"/>');
  parts.push('<rect x="16" y="16" width="688" height="688" rx="25" fill="url(#surface)" stroke="'+style.shadow+'" stroke-width="5"/>');
  if(theme==='classic') parts.push('<rect x="20" y="20" width="680" height="680" rx="22" fill="url(#grain)" opacity=".75"/>');
  if(theme==='marble') parts.push('<rect x="20" y="20" width="680" height="680" rx="22" fill="url(#marble)" opacity=".7"/>');
  if(theme==='neon') parts.push('<g opacity=".18" filter="url(#glow)"><path d="M42 95Q95 42 146 78T208 54M512 72Q582 30 660 98M40 590Q110 650 190 624M532 642Q606 684 678 598" fill="none" stroke="#a64dff" stroke-width="7"/><path d="M55 138Q100 96 145 125M580 126Q625 92 667 142M46 548Q100 510 136 550" fill="none" stroke="#32d8ff" stroke-width="5"/></g>');
  parts.push('<path d="'+poly(frame)+'" fill="none" stroke="'+style.gold+'" stroke-width="5"/>');
  parts.push('<path d="'+poly(inset)+'" fill="none" stroke="'+style.accent+'" stroke-opacity=".28" stroke-width="1.4"/>');
  for(const arm of geometry.arms) {
    const color=arm.player.color,triangle=arm.triangle;
    parts.push('<path d="'+poly(triangle)+'" fill="'+color+'" fill-opacity=".30" stroke="url(#gold)" stroke-width="3.2"/>');
    const apex=triangle[0],left=triangle[1],right=triangle[2];
    const insetTriangle=[
      {x:apex.x*.9+(left.x+right.x)*.05,y:apex.y*.9+(left.y+right.y)*.05},
      {x:left.x*.9+apex.x*.1,y:left.y*.9+apex.y*.1},
      {x:right.x*.9+apex.x*.1,y:right.y*.9+apex.y*.1},
    ];
    parts.push('<path d="'+poly(insetTriangle)+'" fill="none" stroke="'+color+'" stroke-opacity=".9" stroke-width="2"/>');
    arm.baseSlots.forEach((p,index)=>{
      parts.push('<circle data-base-slot="'+arm.index+':'+index+'" cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="16.2" fill="url(#gold)" stroke="'+style.gold+'" stroke-width="1.3"/>');
      parts.push('<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="13.5" fill="url(#well)" stroke="'+color+'" stroke-opacity=".95" stroke-width="1.5"/>');
      parts.push('<circle cx="'+(p.x-4).toFixed(2)+'" cy="'+(p.y-4).toFixed(2)+'" r="2.3" fill="#fff9e8" fill-opacity=".30"/>');
    });
  }
  for(const cell of geometry.track) {
    const arm=geometry.arms[cell.arm],angle=arm.angle*180/Math.PI;
    const isStart=cell.index===arm.startIndex,isSafe=cell.index===arm.starIndex;
    const size=geometry.tileSize,x=cell.x,y=cell.y;
    const fill=isStart?arm.player.color:'url(#ivory)';
    const stroke=isStart?style.gold:style.edge;
    parts.push('<rect x="'+(x-size/2+1.5).toFixed(2)+'" y="'+(y-size/2+2.5).toFixed(2)+'" width="'+size.toFixed(2)+'" height="'+size.toFixed(2)+'" rx="3" fill="'+style.shadow+'" opacity=".65" transform="rotate('+angle.toFixed(2)+' '+x.toFixed(2)+' '+y.toFixed(2)+')"/>');
    parts.push('<rect data-track-cell="'+cell.index+'" x="'+(x-size/2).toFixed(2)+'" y="'+(y-size/2).toFixed(2)+'" width="'+size.toFixed(2)+'" height="'+size.toFixed(2)+'" rx="2.6" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.5" transform="rotate('+angle.toFixed(2)+' '+x.toFixed(2)+' '+y.toFixed(2)+')"/>');
    parts.push('<rect x="'+(x-size/2+2).toFixed(2)+'" y="'+(y-size/2+2).toFixed(2)+'" width="'+(size-4).toFixed(2)+'" height="'+(size-4).toFixed(2)+'" rx="2" fill="none" stroke="#ffffff" stroke-opacity=".32" stroke-width=".7" transform="rotate('+angle.toFixed(2)+' '+x.toFixed(2)+' '+y.toFixed(2)+')"/>');
    if(isStart) {
      parts.push('<path d="M '+(x-4).toFixed(2)+' '+(y+2).toFixed(2)+' l 4 -7 4 7 h -2 v 5 h -4 v -5 z" fill="#fff6dd" stroke="'+style.shadow+'" stroke-width=".5" transform="rotate('+angle.toFixed(2)+' '+x.toFixed(2)+' '+y.toFixed(2)+')"/>');
    } else if(isSafe) {
      parts.push('<polygon data-safe-cell="'+cell.index+'" points="'+starPoints(x,y,7)+'" fill="url(#gold)" stroke="'+style.shadow+'" stroke-width=".6"/>');
    }
  }
  for(const arm of geometry.arms) {
    arm.homeLane.forEach((p,index)=>{
      const size=geometry.tileSize,angle=arm.angle*180/Math.PI,color=arm.player.color;
      parts.push('<rect data-home-cell="'+arm.index+':'+index+'" x="'+(p.x-size/2).toFixed(2)+'" y="'+(p.y-size/2).toFixed(2)+'" width="'+size.toFixed(2)+'" height="'+size.toFixed(2)+'" rx="2.8" fill="'+color+'" stroke="'+style.gold+'" stroke-width="1.5" transform="rotate('+angle.toFixed(2)+' '+p.x.toFixed(2)+' '+p.y.toFixed(2)+')"/>');
      parts.push('<rect x="'+(p.x-size/2+3).toFixed(2)+'" y="'+(p.y-size/2+3).toFixed(2)+'" width="'+(size-6).toFixed(2)+'" height="'+(size-6).toFixed(2)+'" rx="2" fill="none" stroke="'+style.accent+'" stroke-opacity=".42" stroke-width=".8" transform="rotate('+angle.toFixed(2)+' '+p.x.toFixed(2)+' '+p.y.toFixed(2)+')"/>');
      parts.push('<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="2.2" fill="'+style.accent+'" fill-opacity=".65"/>');
    });
  }
  for(let i=0;i<n;i++) {
    const v1=geometry.homeVertices[i],v2=geometry.homeVertices[(i+1)%n],arm=geometry.arms[i],color=arm.player.color;
    parts.push('<path d="M 360,360 L '+v1.x.toFixed(2)+','+v1.y.toFixed(2)+' L '+v2.x.toFixed(2)+','+v2.y.toFixed(2)+' Z" fill="'+color+'" fill-opacity=".90" stroke="url(#gold)" stroke-width="1.6"/>');
    arm.finishSlots.forEach((p,index)=>{
      parts.push('<circle data-finish-slot="'+arm.index+':'+index+'" cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="6.4" fill="url(#gold)" stroke="'+style.shadow+'" stroke-width=".8"/>');
      parts.push('<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="4.6" fill="'+style.shadow+'" fill-opacity=".70" stroke="'+style.accent+'" stroke-opacity=".55" stroke-width=".6"/>');
    });
  }
  parts.push('<circle cx="360" cy="360" r="10.5" fill="url(#frame)" stroke="'+style.gold+'" stroke-width="1.4"/>');
  parts.push('<path d="M 352,363 L 354,356 L 357,359 L 360,351 L 363,359 L 366,356 L 368,363 Z" fill="'+style.accent+'" stroke="'+style.shadow+'" stroke-width=".8"/>');
  parts.push('<text x="360" y="32" text-anchor="middle" fill="'+style.accent+'" font-family="Arial,sans-serif" font-size="10" font-weight="800" letter-spacing="2.6">OPTIMIST LUDO · '+n+' PLAYERS</text>');
  parts.push('<text x="360" y="693" text-anchor="middle" fill="'+style.accent+'" font-family="Arial,sans-serif" font-size="8" font-weight="700" letter-spacing="2.2">PLAY BRIGHT · MOVE SMART</text>');
  for(const [x,y] of [[32,32],[688,32],[32,688],[688,688]]) {
    parts.push('<circle cx="'+x+'" cy="'+y+'" r="6" fill="url(#frame)" stroke="'+style.gold+'" stroke-width="1"/><circle cx="'+x+'" cy="'+y+'" r="2" fill="'+style.shadow+'"/>');
  }
  parts.push('</svg>');
  return parts.join('');
}
