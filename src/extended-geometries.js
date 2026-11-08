/** Canonical six-player HEXA geometry. Logical routes are independent of SVG painting. */
export const BASE_CELL_SIZE = 128;
export const BOARD_THEMES = Object.freeze({
  classic: { bg:'#10131b', outer:'#4c3828', board:'#80603e', cell:'#fff8e8', tile2:'#ead8b8', edge:'#98734c', gold:'#d9ae60', shadow:'#08090d', ink:'#302417', accent:'#f2dba8', glow:'#f1c96d', baseBg:'#34271d' },
  neon: { bg:'#070a14', outer:'#11182a', board:'#141c2f', cell:'#fff9ed', tile2:'#e7d9bf', edge:'#9e8a67', gold:'#f2c66f', shadow:'#03050b', ink:'#1e2430', accent:'#fff0c8', glow:'#64dfff', baseBg:'#11182a' },


});
export const BOARD_PLAYER_COLORS = Object.freeze({
  hexa: [
    { id:'blue', label:'BLUE', color:'#168BFF', dark:'#075A8E' },
    { id:'red', label:'RED', color:'#F02D3A', dark:'#851A2B' },
    { id:'yellow', label:'YELLOW', color:'#F5B51B', dark:'#8C5A09' },
    { id:'purple', label:'PURPLE', color:'#A52BEA', dark:'#51268D' },
    { id:'green', label:'GREEN', color:'#18B94B', dark:'#12623B' },
    { id:'cyan', label:'CYAN', color:'#13C9D8', dark:'#08727D' }
  ]
});

const VIEW = 720;
const C = BASE_CELL_SIZE;
const fmt = (n) => Number(n.toFixed(4));
const point = (x, y) => ({ x:fmt(x), y:fmt(y) });
const nativePoint = (x, y, cx, cy) => ({ x:cx+x, y:cy+y });

function rotate(x, y, cx, cy, degrees) {
  const a = degrees * Math.PI / 180;
  const co = Math.cos(a);
  const si = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return { x:cx + dx*co - dy*si, y:cy + dx*si + dy*co };
}
function scaled(p, scale) {
  return point(p.x * scale, p.y * scale);
}
function polygon(sides, radius, cx, cy, offset = -90) {
  return Array.from({ length:sides }, (_, index) => {
    const angle = (offset + index * 360 / sides) * Math.PI / 180;
    return point(cx + Math.cos(angle)*radius, cy + Math.sin(angle)*radius);
  });
}
function pawnSlots(center, angle, scale) {
  const offset = .8 * C;
  const a = angle * Math.PI / 180;
  const co = Math.cos(a);
  const si = Math.sin(a);
  return [[-offset,-offset],[offset,-offset],[-offset,offset],[offset,offset]].map(([x,y], slotIndex) => ({
    ...scaled({ x:center.x + x*co - y*si, y:center.y + x*si + y*co }, scale),
    slotIndex
  }));
}
function makeFinishSlots(center, direction, scale, mode) {
  const tangent = { x:-direction.y, y:direction.x };
  if (mode === 'hexa') {
    const offsets = [-.27, -.09, .09, .27];
    return offsets.map((offset, slotIndex) => ({
      ...scaled({
        x:center.x + direction.x*C + tangent.x*offset*C,
        y:center.y + direction.y*C + tangent.y*offset*C
      }, scale),
      slotIndex
    }));
  }
  const result = [];
  for (const radial of [-.28, .28]) {
    for (const lateral of [-.28, .28]) {
      result.push({
        ...scaled({
          x:center.x + direction.x*C + direction.x*radial*C + tangent.x*lateral*C,
          y:center.y + direction.y*C + direction.y*radial*C + tangent.y*lateral*C
        }, scale),
        slotIndex:result.length
      });
    }
  }
  return result;
}
function unitTowardCenter(p, cx, cy) {
  const dx = cx - p.x;
  const dy = cy - p.y;
  const length = Math.hypot(dx, dy);
  if (!length) throw new Error('Cannot create a home lane from the board center.');
  return { x:dx/length, y:dy/length };
}
function rotateVector(vector, degrees) {
  const a = degrees * Math.PI / 180;
  return { x:vector.x*Math.cos(a)-vector.y*Math.sin(a), y:vector.x*Math.sin(a)+vector.y*Math.cos(a) };
}
function distance(a, b) {
  return Math.hypot(a.x-b.x, a.y-b.y);
}

function makeHexa() {
  const nativeSize = 2560;
  const cx = nativeSize/2;
  const cy = nativeSize/2;
  const scale = VIEW/nativeSize;
  const colors = BOARD_PLAYER_COLORS.hexa;
  const track = [];
  const starts = Object.fromEntries(colors.map((player, index) => [player.id, index*12]));
  const entries = Object.fromEntries(colors.map((player) => [player.id, (starts[player.id]+71)%72]));
  const safe = [...new Set(colors.flatMap((player) => [starts[player.id], (starts[player.id]+6)%72]))].sort((a,b)=>a-b);

  // Each 60-degree sector is a 12-step U-shaped rail. Two bridge cells
  // replace the old diagonal/2-cell jumps, so every outer move is one pitch.
  const innerRadius = 2.5;
  const rightInner = { x:1, y:-(innerRadius+1) };
  const leftInner = rotate(-1, -(innerRadius+1), 0, 0, 60);
  const dx = leftInner.x-rightInner.x;
  const dy = leftInner.y-rightInner.y;
  const chord = Math.hypot(dx,dy);
  const midpoint = { x:(rightInner.x+leftInner.x)/2, y:(rightInner.y+leftInner.y)/2 };
  const height = Math.sqrt(1-(chord/2)**2);
  const perpendicular = { x:-dy/chord, y:dx/chord };
  const candidates = [
    { x:midpoint.x+perpendicular.x*height, y:midpoint.y+perpendicular.y*height },
    { x:midpoint.x-perpendicular.x*height, y:midpoint.y-perpendicular.y*height }
  ];
  // Choose the outer intersection: it keeps each square bridge tile separated
  // from both rail tiles in their local axes (the inner solution overlaps).
  const innerBridge = candidates.sort((a,b)=>Math.hypot(b.x,b.y)-Math.hypot(a.x,a.y))[0];

  const push = (xUnits, yUnits, positionRotation, sector, lane, row, tileRotation = positionRotation) => {
    const native = rotate(cx+xUnits*C, cy+yUnits*C, cx, cy, positionRotation);
    track.push({
      index:track.length, sector, lane, row, rotation:tileRotation,
      nativeX:fmt(native.x), nativeY:fmt(native.y),
      ...scaled(native, scale)
    });
  };

  for (let sector=0; sector<6; sector++) {
    const angle = sector*60;
    for (let row=5; row>=1; row--) push(1, -(innerRadius+row), angle, sector, 'right-rail', row);
    push(innerBridge.x, innerBridge.y, angle, sector, 'inner-bridge', 0, angle+30);
    for (let row=1; row<=5; row++) push(-1, -(innerRadius+row), angle+60, sector, 'left-rail', row);
    push(0, -(innerRadius+5), angle+60, sector, 'outer-bridge', 6);
  }

  track.forEach((cell) => {
    cell.safe = safe.includes(cell.index);
    cell.startFor = colors.find((player)=>starts[player.id]===cell.index)?.id || null;
    cell.entryFor = colors.find((player)=>entries[player.id]===cell.index)?.id || null;
  });

  const arms = colors.map((player, index) => {
    const startIndex = starts[player.id];
    const homeEntryIndex = entries[player.id];
    const entry = track[homeEntryIndex];
    const direction = unitTowardCenter({x:entry.nativeX,y:entry.nativeY},cx,cy);
    const homeLane = Array.from({length:6},(_,homeIndex)=>{
      const native = {
        x:entry.nativeX + direction.x*C*(homeIndex+1),
        y:entry.nativeY + direction.y*C*(homeIndex+1)
      };
      return {
        ...scaled(native,scale),
        nativeX:fmt(native.x), nativeY:fmt(native.y),
        homeIndex:homeIndex+1,
        rotation:Math.atan2(direction.y,direction.x)*180/Math.PI
      };
    });
    const baseAngle = -60 + index*60;
    const baseCenter = {
      x:cx + Math.cos(baseAngle*Math.PI/180)*7*C,
      y:cy + Math.sin(baseAngle*Math.PI/180)*7*C
    };
    return {
      index, player, angle:baseAngle, startIndex, homeEntryIndex,
      starIndex:(startIndex+6)%72,
      homeLane, baseCenter:scaled(baseCenter,scale),
      baseSlots:pawnSlots(baseCenter,baseAngle,scale),
      baseRadius:1.9*C*scale,
      baseRotation:baseAngle,
      finishSlots:makeFinishSlots({x:cx,y:cy},direction,scale,'hexa'),
      homeDirection:direction
    };
  });

  const outline = polygon(6,9.55*C,cx,cy).map((p)=>scaled(p,scale));
  const finishVertices = polygon(6,1.42*C,cx,cy).map((p)=>scaled(p,scale));
  const routeLinkDistances = track.map((cell,index)=>fmt(distance(cell,track[(index+1)%72])/ (C*scale)));
  return {
    id:'hexa', boardId:'hexa', shape:'six-rail-star', sides:6, maxPlayers:6, tokensPerPlayer:4,
    canvasSize:nativeSize, cellSize:C, artScale:scale,
    trackLength:72, maxOuterSteps:71, homeCells:6, finishStep:78,
    startIndices:starts, homeEntryIndices:entries, safeIndices:safe,
    cellPitch:C*scale, tileSize:.82*C*scale, safeAreaSize:.72*C*scale,
    pawnDiameter:.64*C*scale, pawnMaxWidth:.82*C*scale, pawnDiameterRatio:.64,
    finishPawnScale:.24, touchTargetCssPx:48,
    center:scaled({x:cx,y:cy},scale), track, arms, outline, finishVertices,
    routeLinkDistances:[...new Set(routeLinkDistances)].sort((a,b)=>a-b)
  };
}

export const EXTENDED_GEOMETRIES = Object.freeze({ hexa:makeHexa() });
export const EXTENDED_GEOMETRY_IDS = Object.freeze(['hexa']);
export function getExtendedGeometry(id) {
  const geometry=EXTENDED_GEOMETRIES[String(id||'').toLowerCase()];
  if(!geometry) throw new RangeError('Unknown HEXA geometry.');
  return geometry;
}
export { distance };

function tileCorners(cell,size) {
  const angle=(cell.rotation||0)*Math.PI/180;
  const co=Math.cos(angle),si=Math.sin(angle),half=size/2;
  return [[-half,-half],[half,-half],[half,half],[-half,half]].map(([x,y])=>({
    x:cell.x+x*co-y*si,y:cell.y+x*si+y*co
  }));
}
function circleOverlapsTile(center,radius,cell,size) {
  const angle=-(cell.rotation||0)*Math.PI/180;
  const dx=center.x-cell.x,dy=center.y-cell.y;
  const localX=dx*Math.cos(angle)-dy*Math.sin(angle);
  const localY=dx*Math.sin(angle)+dy*Math.cos(angle);
  const half=size/2;
  const nearestX=Math.max(-half,Math.min(half,localX));
  const nearestY=Math.max(-half,Math.min(half,localY));
  return Math.hypot(localX-nearestX,localY-nearestY)<radius-1e-5;
}
function circlesOverlap(a,radiusA,b,radiusB) {
  return distance(a,b)<radiusA+radiusB-1e-5;
}
function assertNoPolygonOverlaps(items,label) {
  for(let i=0;i<items.length;i++) {
    for(let j=i+1;j<items.length;j++) {
      if(polygonsOverlap(items[i].polygon,items[j].polygon)) {
        throw new Error(label+' overlap: '+items[i].id+' / '+items[j].id+'.');
      }
    }
  }
}
function assertCirclesOutsidePolygons(circles,polygons,label) {
  for(const circle of circles) for(const item of polygons) {
    if(circleOverlapsTile(circle.center,circle.radius,item.cell,item.size)) {
      throw new Error(label+' overlaps '+item.id+'.');
    }
  }
}
function assertCirclesDoNotOverlap(circles,label) {
  for(let i=0;i<circles.length;i++) for(let j=i+1;j<circles.length;j++) {
    if(circlesOverlap(circles[i].center,circles[i].radius,circles[j].center,circles[j].radius)) {
      throw new Error(label+' overlap: '+circles[i].id+' / '+circles[j].id+'.');
    }
  }
}
function assertPolygonInsideCanvas(polygon,label) {
  for(const p of polygon) {
    if(p.x<0||p.x>VIEW||p.y<0||p.y>VIEW) {
      throw new Error(label+' falls outside the 720x720 artwork.');
    }
  }
}

function polygonsOverlap(a,b) {
  for(const polygon of [a,b]) {
    for(let index=0;index<polygon.length;index++) {
      const p=polygon[index],q=polygon[(index+1)%polygon.length];
      const axis={x:-(q.y-p.y),y:q.x-p.x};
      const project=(points)=>points.map((item)=>item.x*axis.x+item.y*axis.y);
      const pa=project(a),pb=project(b);
      if(Math.max(...pa)<=Math.min(...pb)+1e-5 || Math.max(...pb)<=Math.min(...pa)+1e-5) return false;
    }
  }
  return true;
}

export function assertExtendedGeometry(geometry) {
  if(!geometry || geometry.id!=='hexa') throw new TypeError('Expected HEXA geometry.');
  const expected={ sides:6,track:72,outer:71,home:6,finish:78 };
  if(geometry.sides!==expected.sides || geometry.trackLength!==expected.track ||
     geometry.maxOuterSteps!==expected.outer || geometry.homeCells!==expected.home ||
     geometry.finishStep!==expected.finish || geometry.arms.length!==expected.sides ||
     geometry.track.length!==expected.track) {
    throw new Error('Track/seat/finish counts do not match the board specification.');
  }
  if(new Set(geometry.track.map((cell)=>cell.index)).size!==geometry.trackLength ||
     new Set(geometry.track.map((cell)=>cell.nativeX+','+cell.nativeY)).size!==geometry.trackLength) {
    throw new Error('Track indices or route centres are duplicated.');
  }
  if(geometry.safeIndices.length!==12 || new Set(geometry.safeIndices).size!==12) {
    throw new Error('Each board must expose exactly twelve unique safe cells.');
  }
  const expectedOutlineVertices=6;
  const expectedFinishVertices=6;
  if(geometry.outline.length!==expectedOutlineVertices ||
     geometry.finishVertices.length!==expectedFinishVertices) {
    throw new Error('Board outline or finish polygon has the wrong vertex count.');
  }
  assertPolygonInsideCanvas(geometry.outline,'Board outline');
  assertPolygonInsideCanvas(geometry.finishVertices,'Finish polygon');

  const pitch=geometry.cellPitch;
  for(let index=0;index<geometry.trackLength;index++) {
    const current=geometry.track[index],next=geometry.track[(index+1)%geometry.trackLength];
    if(Math.abs(distance(current,next)-pitch)>.03) {
      throw new Error('Outer route is discontinuous at '+index+' -> '+((index+1)%geometry.trackLength)+'.');
    }
  }

  const allHome=[];
  const allBase=[];
  const allFinish=[];
  for(const [armIndex,arm] of geometry.arms.entries()) {
    if(arm.index!==armIndex || arm.homeLane.length!==geometry.homeCells ||
       arm.baseSlots.length!==4 || arm.finishSlots.length!==4) {
      throw new Error('Incomplete player geometry for seat '+armIndex+'.');
    }
    if(arm.homeEntryIndex!==(arm.startIndex+geometry.maxOuterSteps)%geometry.trackLength) {
      throw new Error('Home-entry index mismatch for '+arm.player.id+'.');
    }
    if(!geometry.safeIndices.includes(arm.startIndex) || !geometry.safeIndices.includes(arm.starIndex)) {
      throw new Error('Start and star squares must both be safe for '+arm.player.id+'.');
    }
    const entry=geometry.track[arm.homeEntryIndex];
    const lane=[{x:entry.x,y:entry.y},...arm.homeLane];
    for(let index=0;index<lane.length-1;index++) {
      if(Math.abs(distance(lane[index],lane[index+1])-pitch)>.03) {
        throw new Error('Home lane is disconnected for '+arm.player.id+' at step '+(index+1)+'.');
      }
    }
    allHome.push(...arm.homeLane.map((cell)=>({ ...cell, armIndex })));
    allBase.push(...arm.baseSlots.map((cell)=>({ ...cell, armIndex })));
    allFinish.push(...arm.finishSlots.map((cell)=>({ ...cell, armIndex })));
  }

  // Check the actual rotated square footprints, not just distances between
  // their centres. SAT detects overlap even when two rotated cells are
  // diagonally offset and their centre distance exceeds one tile width.
  const trackTiles=geometry.track.map((cell)=>({
    id:'track '+cell.index,cell,size:geometry.tileSize,
    polygon:tileCorners(cell,geometry.tileSize)
  }));
  const homeTiles=allHome.map((cell)=>({
    id:'home '+cell.armIndex+':'+cell.homeIndex,cell,size:geometry.tileSize,
    polygon:tileCorners(cell,geometry.tileSize)
  }));
  assertNoPolygonOverlaps(trackTiles,'Outer route tiles');
  assertNoPolygonOverlaps(homeTiles,'Home-lane tiles');
  // Check every outer-route tile against every home-lane tile.
  for(const track of trackTiles) for(const home of homeTiles) {
    if(polygonsOverlap(track.polygon,home.polygon)) {
      throw new Error('Home-lane tile overlaps outer route: '+home.id+' / '+track.id+'.');
    }
  }

  const baseCircles=allBase.map((slot)=>({
    id:'base '+slot.armIndex+':'+slot.slotIndex,
    center:slot,radius:geometry.pawnDiameter*.54
  }));
  const finishRadius=geometry.pawnDiameter*geometry.finishPawnScale*.48;
  const finishCircles=allFinish.map((slot)=>({
    id:'finish '+slot.armIndex+':'+slot.slotIndex,
    center:slot,radius:finishRadius
  }));
  const baseZones=geometry.arms.map((arm)=>({
    id:'base zone '+arm.player.id,center:arm.baseCenter,radius:arm.baseRadius
  }));
  assertCirclesDoNotOverlap(baseZones,'Base zones');
  assertCirclesOutsidePolygons(baseZones,[...trackTiles,...homeTiles],'Base zone');
  assertCirclesDoNotOverlap(baseCircles,'Base pawn wells');
  assertCirclesDoNotOverlap(finishCircles,'Finish pawn sockets');
  assertCirclesOutsidePolygons(baseCircles,[...trackTiles,...homeTiles],'Base pawn well');
  assertCirclesOutsidePolygons(finishCircles,[...trackTiles,...homeTiles],'Finish pawn socket');
  for(const base of baseCircles) for(const finish of finishCircles) {
    if(circlesOverlap(base.center,base.radius,finish.center,finish.radius)) {
      throw new Error('Base pawn well overlaps finish socket: '+base.id+' / '+finish.id+'.');
    }
  }

  for(const item of [...trackTiles,...homeTiles]) assertPolygonInsideCanvas(item.polygon,item.id);
  for(const circle of [...baseCircles,...finishCircles]) {
    if(circle.center.x-circle.radius<0||circle.center.x+circle.radius>VIEW||
       circle.center.y-circle.radius<0||circle.center.y+circle.radius>VIEW) {
      throw new Error(circle.id+' falls outside the 720x720 artwork.');
    }
  }
  for(const arm of geometry.arms) {
    if(arm.baseCenter.x-arm.baseRadius<0||arm.baseCenter.x+arm.baseRadius>VIEW||
       arm.baseCenter.y-arm.baseRadius<0||arm.baseCenter.y+arm.baseRadius>VIEW) {
      throw new Error('Base zone '+arm.player.id+' falls outside the 720x720 artwork.');
    }
  }
  return true;
}

export function getExtendedStackLayout(id,count) {
  const geometry=getExtendedGeometry(id);
  if(!Number.isInteger(count)||count<0) throw new RangeError('Stack count must be non-negative.');
  if(!count) return { tokens:[],hiddenCount:0,badge:null };
  if(count===1) return {
    tokens:[{index:0,x:0,y:0,scale:1,diameter:geometry.pawnDiameter,visible:true}],
    hiddenCount:0,badge:null
  };

  // A four-token stack is laid out as a compact 2x2 group. This keeps all
  // four character portraits visible without letting them cross the tile.
  const diameter=.35*C*geometry.artScale;
  const offset=.22*C*geometry.artScale;
  const slots=[[-offset,-offset],[offset,-offset],[-offset,offset],[offset,offset]];
  const visibleCount=Math.min(count,4);
  const tokens=Array.from({length:count},(_,index)=>{
    if(index>=visibleCount) return {index,x:0,y:0,scale:0,diameter:0,visible:false};
    const [x,y]=slots[index];
    return {index,x,y,scale:diameter/geometry.pawnDiameter,diameter,visible:true};
  });
  const hiddenCount=count-visibleCount;
  return {tokens,hiddenCount,badge:hiddenCount? '×'+count:null};
}

const star=(x,y,r)=>Array.from({length:10},(_,index)=>{
  const angle=-Math.PI/2+index*Math.PI/5;
  const radius=index%2?r*.42:r;
  return (x+Math.cos(angle)*radius).toFixed(2)+','+(y+Math.sin(angle)*radius).toFixed(2);
}).join(' ');
const closedPath=(points)=>points.map((p,index)=>(index?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ')+' Z';

function hexPoints(points) {
  return points.map((p)=>Number(p.x.toFixed(2))+','+Number(p.y.toFixed(2))).join(' ');
}

function chevronPath(x,y,size,rotation=0) {
  const d=`M ${x-size*.22} ${y-size*.16} L ${x+size*.02} ${y} L ${x-size*.22} ${y+size*.16} M ${x+size*.02} ${y-size*.16} L ${x+size*.26} ${y} L ${x+size*.02} ${y+size*.16}`;
  return `<path d="${d}" transform="rotate(${rotation} ${x} ${y})" fill="none" stroke="#fff7d9" stroke-width="${Math.max(1,size*.055)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function crownMarkup(x,y,scale,fill='url(#gold)') {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}" stroke="#4a2d0b" stroke-width=".9" stroke-linejoin="round"><path d="M-12 5L-16-7L-7-2L0-12L7-2L16-7L12 5Z"/><path d="M-12 8H12L10 12H-10Z"/><circle cx="-16" cy="-7" r="2"/><circle cx="0" cy="-12" r="2"/><circle cx="16" cy="-7" r="2"/></g>`;
}

function renderTextureSpeckles(geometry) {
  const parts=[];
  geometry.arms.forEach((arm,index)=>{
    const color=arm.player.color;
    const cx=arm.baseCenter.x,cy=arm.baseCenter.y;
    const points=[[-1.55,-.2],[-1.18,-.92],[-.82,.98],[.86,-1.02],[1.48,.44],[.28,1.45],[-1.68,.78],[1.72,-.36],[-.42,-1.62],[.7,1.72]];
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${(arm.baseRadius*1.9).toFixed(2)}" fill="url(#splash-${arm.player.id})" opacity=".92"/>`);
    for(let i=0;i<points.length;i++){
      const [dx,dy]=points[i];
      const r=(i%4===0?5.2:i%3===0?3.6:2.15)+(index%2)*.3;
      const x=cx+dx*arm.baseRadius,y=cy+dy*arm.baseRadius;
      parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" fill="${color}" opacity="${i%3===0?'.34':'.23'}"/>`);
    }
    const sprayX=cx+(index%2?1:-1)*arm.baseRadius*1.42;
    const sprayY=cy+(index%3===0?-1:1)*arm.baseRadius*.96;
    parts.push(`<path d="M ${(sprayX-9).toFixed(2)} ${(sprayY+7).toFixed(2)} q 9 -12 18 -4 M ${(sprayX-5).toFixed(2)} ${(sprayY+14).toFixed(2)} q 8 -10 17 -8" stroke="${color}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".3"/>`);
  });
  return parts.join('');
}

function renderTrackCell(cell,geometry,palette) {
  const size=geometry.tileSize;
  const half=size/2;
  const radius=Math.max(2.3,size*.12);
  const player=cell.startFor?geometry.arms.find((arm)=>arm.player.id===cell.startFor):null;
  const fill=player?`url(#player-${player.player.id})`:'url(#marble)';
  const parts=[];
  parts.push(`<g data-track-cell="${cell.index}" data-center="${cell.x},${cell.y}" transform="rotate(${cell.rotation} ${cell.x} ${cell.y})">`);
  parts.push(`<rect x="${(cell.x-half+1.5).toFixed(3)}" y="${(cell.y-half+2.1).toFixed(3)}" width="${size}" height="${size}" rx="${radius}" fill="#02030a" opacity=".78"/>`);
  parts.push(`<rect x="${(cell.x-half).toFixed(3)}" y="${(cell.y-half).toFixed(3)}" width="${size}" height="${size}" rx="${radius}" fill="${fill}" stroke="${palette.gold}" stroke-width="1.35"/>`);
  parts.push(`<path d="M ${(cell.x-half+3).toFixed(3)} ${(cell.y-half+3).toFixed(3)} H ${(cell.x+half-3).toFixed(3)}" stroke="#ffffff" stroke-opacity=".72" stroke-width=".95" stroke-linecap="round"/>`);
  parts.push(`<path d="M ${(cell.x-half+3).toFixed(3)} ${(cell.y+half-3).toFixed(3)} H ${(cell.x+half-3).toFixed(3)}" stroke="${palette.ink}" stroke-opacity=".24" stroke-width=".9" stroke-linecap="round"/>`);
  parts.push(`<path d="M ${(cell.x-half*.55).toFixed(3)} ${(cell.y-half*.24).toFixed(3)} Q ${(cell.x-half*.06).toFixed(3)} ${(cell.y-half*.58).toFixed(3)} ${(cell.x+half*.22).toFixed(3)} ${(cell.y-half*.52).toFixed(3)}" stroke="#ffffff" stroke-opacity=".25" stroke-width=".72" fill="none"/>`);
  if(!player) {
    parts.push(`<path d="M ${(cell.x-half*.32).toFixed(3)} ${(cell.y+half*.42).toFixed(3)} Q ${(cell.x-half*.04).toFixed(3)} ${(cell.y+half*.08).toFixed(3)} ${(cell.x+half*.28).toFixed(3)} ${(cell.y+half*.18).toFixed(3)}" stroke="#8e8994" stroke-opacity=".34" stroke-width=".62" fill="none"/>`);
  }
  if(player) {
    parts.push(`<circle cx="${cell.x}" cy="${cell.y}" r="${size*.22}" fill="#080b17" fill-opacity=".55" stroke="${palette.gold}" stroke-width=".9"/>`);
    parts.push(crownMarkup(cell.x,cell.y+1,size*.027,'#fff0bd'));
  }
  if(cell.entryFor) {
    parts.push(`<circle cx="${cell.x}" cy="${cell.y}" r="${size*.31}" fill="#0b0d18" fill-opacity=".72" stroke="${palette.gold}" stroke-width=".8"/>`);
    parts.push(chevronPath(cell.x,cell.y,size*.52,cell.rotation));
  }
  parts.push('</g>');
  if(cell.safe) {
    const markerRadius=size*.22;
    parts.push(`<g data-safe-cell="${cell.index}" transform="translate(${cell.x} ${cell.y})">`);
    if(cell.startFor) {
      parts.push(`<circle r="${size*.29}" fill="#0a0c16" fill-opacity=".55" stroke="${palette.gold}" stroke-width=".75"/>`);
      parts.push(crownMarkup(0,1,size*.026,'url(#gold)'));
    } else {
      parts.push(`<polygon points="${star(0,0,markerRadius)}" fill="url(#gold)" stroke="#402609" stroke-width=".85"/>`);
      parts.push(`<circle r="${size*.045}" fill="#fff8db"/>`);
    }
    parts.push('</g>');
  }
  return parts.join('');
}

function renderHomeCell(cell,arm,index,geometry,palette) {
  const size=geometry.tileSize,half=size/2;
  const color=arm.player.color;
  const last=index===arm.homeLane.length-1;
  const id=`${arm.index}:${index}`;
  const parts=[];
  parts.push(`<g data-home-cell="${id}" data-center="${cell.x},${cell.y}" transform="rotate(${cell.rotation} ${cell.x} ${cell.y})">`);
  parts.push(`<rect x="${(cell.x-half+1.3).toFixed(3)}" y="${(cell.y-half+2).toFixed(3)}" width="${size}" height="${size}" rx="${size*.12}" fill="#02030a" opacity=".75"/>`);
  parts.push(`<rect x="${(cell.x-half).toFixed(3)}" y="${(cell.y-half).toFixed(3)}" width="${size}" height="${size}" rx="${size*.12}" fill="url(#player-${arm.player.id})" stroke="${palette.gold}" stroke-width="1.45"/>`);
  parts.push(`<path d="M ${(cell.x-half+3).toFixed(3)} ${(cell.y-half+3).toFixed(3)} H ${(cell.x+half-3).toFixed(3)}" stroke="#fff" stroke-opacity=".48" stroke-width=".85" stroke-linecap="round"/>`);
  parts.push(`<path d="M ${(cell.x-half*.52).toFixed(3)} ${(cell.y-half*.28).toFixed(3)} L ${(cell.x+half*.3).toFixed(3)} ${(cell.y-half*.52).toFixed(3)}" stroke="#fff" stroke-opacity=".18" stroke-width=".75"/>`);
  if(last) {
    parts.push(`<path d="M ${cell.x-half*.24} ${cell.y+half*.12} L ${cell.x} ${cell.y-half*.12} L ${cell.x+half*.24} ${cell.y+half*.12}" fill="none" stroke="#fff4c9" stroke-width="${Math.max(1,size*.065)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  } else {
    parts.push(`<circle cx="${cell.x}" cy="${cell.y}" r="${size*.055}" fill="#fff0bb" opacity=".82"/>`);
  }
  parts.push('</g>');
  return parts.join('');
}

export function renderExtendedBoardSvg(geometry,theme='neon') {
  if(!BOARD_THEMES[theme]) throw new RangeError('Unknown board theme.');
  assertExtendedGeometry(geometry);
  const palette=BOARD_THEMES[theme];
  const parts=[];
  const colors=geometry.arms.map((arm)=>arm.player.color);
  const title=geometry.id.toUpperCase();
  const view=VIEW;
  const outlinePath=closedPath(geometry.outline);
  const innerOutline=geometry.outline.map((p)=>({x:360+(p.x-360)*.972,y:360+(p.y-360)*.972}));
  const innerPath=closedPath(innerOutline);
  const tile=geometry.tileSize;

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="720" height="720" viewBox="0 0 720 720" role="img" aria-label="OPTIMIST LUDO ${title}"><title>OPTIMIST LUDO ${title} board</title><desc>${geometry.maxPlayers} players, ${geometry.trackLength} outer cells, ${geometry.homeCells} home cells per player. Coordinates are generated from the canonical geometry.</desc><defs>`);
  parts.push(`<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#030711"/><stop offset=".48" stop-color="${palette.bg}"/><stop offset="1" stop-color="#050610"/></linearGradient>`);
  parts.push(`<radialGradient id="bgGlow"><stop stop-color="${palette.glow}" stop-opacity=".24"/><stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/></radialGradient>`);
  parts.push(`<linearGradient id="plate" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#172239"/><stop offset=".48" stop-color="#080e1d"/><stop offset="1" stop-color="#1d2431"/></linearGradient>`);
  parts.push(`<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0b6"/><stop offset=".16" stop-color="${palette.gold}"/><stop offset=".42" stop-color="#73451b"/><stop offset=".62" stop-color="${palette.glow}"/><stop offset=".8" stop-color="#281b24"/><stop offset="1" stop-color="#fff0bc"/></linearGradient>`);
  parts.push(`<linearGradient id="gold" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="#fff7cc"/><stop offset=".25" stop-color="#ffe28a"/><stop offset=".56" stop-color="#cb8624"/><stop offset=".82" stop-color="#704015"/><stop offset="1" stop-color="#ffdf7c"/></linearGradient>`);
  parts.push(`<linearGradient id="marble" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fffef8"/><stop offset=".42" stop-color="${palette.cell}"/><stop offset=".8" stop-color="${palette.tile2}"/><stop offset="1" stop-color="#b4a69a"/></linearGradient>`);
  parts.push(`<radialGradient id="darkWell"><stop stop-color="#27324a"/><stop offset=".72" stop-color="#0d1426"/><stop offset="1" stop-color="#050711"/></radialGradient>`);
  parts.push(`<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  parts.push(`<clipPath id="boardClip"><path d="${outlinePath}"/></clipPath>`);
  geometry.arms.forEach((arm,index)=>{
    parts.push(`<linearGradient id="player-${arm.player.id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".32"/><stop offset=".22" stop-color="${arm.player.color}"/><stop offset=".7" stop-color="${arm.player.dark}"/><stop offset="1" stop-color="#080b16"/></linearGradient>`);
    parts.push(`<radialGradient id="splash-${arm.player.id}"><stop stop-color="${arm.player.color}" stop-opacity=".72"/><stop offset=".52" stop-color="${arm.player.color}" stop-opacity=".2"/><stop offset="1" stop-color="${arm.player.color}" stop-opacity="0"/></radialGradient>`);
    parts.push(`<radialGradient id="base-${arm.player.id}"><stop stop-color="${arm.player.dark}"/><stop offset=".72" stop-color="#11182a"/><stop offset="1" stop-color="#03050d"/></radialGradient>`);
  });
  parts.push('</defs>');

  // Dark, richly textured board plate and atmospheric paint splashes.
  parts.push(`<rect width="${view}" height="${view}" rx="34" fill="url(#bg)"/>`);
  parts.push(`<circle cx="360" cy="360" r="360" fill="url(#bgGlow)" opacity=".6"/>`);
  parts.push(`<path d="${outlinePath}" fill="url(#plate)" stroke="#05070c" stroke-width="15" stroke-linejoin="round"/>`);
  parts.push(`<path d="${outlinePath}" fill="none" stroke="${palette.glow}" stroke-opacity=".48" stroke-width="13" stroke-linejoin="round" filter="url(#glow)"/>`);
  parts.push(`<path d="${outlinePath}" fill="none" stroke="url(#metal)" stroke-width="8" stroke-linejoin="round"/>`);
  parts.push(`<path d="${outlinePath}" fill="none" stroke="#fff1bd" stroke-opacity=".62" stroke-width="1.6" stroke-linejoin="round"/>`);
  parts.push(`<path d="${innerPath}" fill="none" stroke="${palette.glow}" stroke-opacity=".48" stroke-width="1.8" stroke-linejoin="round"/>`);
  parts.push(`<g clip-path="url(#boardClip)">${renderTextureSpeckles(geometry)}</g>`);

  // Four empty illuminated pedestal wells. Live character art is layered above these anchors.
  geometry.arms.forEach((arm)=>{
    const color=arm.player.color,base=arm.baseCenter,radius=arm.baseRadius;
    parts.push(`<g data-base="${arm.player.id}">`);
    parts.push(`<circle cx="${base.x}" cy="${base.y}" r="${(radius+6).toFixed(2)}" fill="none" stroke="${color}" stroke-opacity=".48" stroke-width="8" filter="url(#glow)"/>`);
    parts.push(`<circle cx="${base.x}" cy="${base.y}" r="${radius.toFixed(2)}" fill="url(#base-${arm.player.id})" stroke="url(#metal)" stroke-width="4.2"/>`);
    parts.push(`<circle cx="${base.x}" cy="${base.y}" r="${(radius*.91).toFixed(2)}" fill="none" stroke="${color}" stroke-width="2.6"/>`);
    parts.push(`<circle cx="${base.x}" cy="${base.y}" r="${(radius*.82).toFixed(2)}" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="1.1"/>`);
    arm.baseSlots.forEach((slot,index)=>{
      const d=geometry.pawnDiameter;
      parts.push(`<g data-base-slot="${arm.index}:${index}">`);
      parts.push(`<circle cx="${slot.x}" cy="${slot.y}" r="${(d*.62).toFixed(3)}" fill="#02050d" stroke="url(#gold)" stroke-width="1.8"/>`);
      parts.push(`<circle cx="${slot.x}" cy="${slot.y}" r="${(d*.47).toFixed(3)}" fill="url(#darkWell)" stroke="${color}" stroke-opacity=".82" stroke-width=".95"/>`);
      parts.push(`<circle cx="${slot.x-d*.12}" cy="${slot.y-d*.13}" r="${(d*.055).toFixed(3)}" fill="#ffffff" fill-opacity=".36"/>`);
      parts.push('</g>');
    });
    parts.push('</g>');
  });

  // Full-footprint marble track tiles and their safe/start emblems.
  geometry.track.forEach((cell)=>parts.push(renderTrackCell(cell,geometry,palette)));

  // Home lanes inherit the exact canonical lane centres and cell pitch.
  geometry.arms.forEach((arm)=>arm.homeLane.forEach((cell,index)=>parts.push(renderHomeCell(cell,arm,index,geometry,palette))));

  // Colour-coded finish wedges and four exact pawn sockets per player.
  for(let index=0;index<geometry.arms.length;index++) {
    const a=geometry.finishVertices[index],b=geometry.finishVertices[(index+1)%geometry.finishVertices.length];
    const arm=geometry.arms[index];
    parts.push(`<path d="M ${geometry.center.x} ${geometry.center.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z" fill="url(#player-${arm.player.id})" fill-opacity=".9" stroke="url(#gold)" stroke-width="1.6"/>`);
  }
  parts.push(`<path d="${closedPath(geometry.finishVertices)}" fill="none" stroke="#fff0b0" stroke-opacity=".72" stroke-width="1.1"/>`);
  geometry.arms.forEach((arm)=>arm.finishSlots.forEach((slot,index)=>{
    const r=geometry.pawnDiameter*geometry.finishPawnScale*.48;
    parts.push(`<g data-finish-slot="${arm.index}:${index}"><circle cx="${slot.x}" cy="${slot.y}" r="${r.toFixed(3)}" fill="#070b15" stroke="url(#gold)" stroke-width=".9"/><circle cx="${slot.x}" cy="${slot.y}" r="${(r*.42).toFixed(3)}" fill="${arm.player.color}"/></g>`);
  }));
  const logoHex=polygon(6,25,geometry.center.x,geometry.center.y,-90);
  parts.push(`<path d="${closedPath(logoHex)}" fill="#07101e" stroke="url(#metal)" stroke-width="3.1" stroke-linejoin="round"/>`);
  parts.push(`<path d="${closedPath(polygon(6,20.8,geometry.center.x,geometry.center.y,-90))}" fill="none" stroke="${palette.glow}" stroke-opacity=".9" stroke-width="1.15"/>`);
  parts.push(crownMarkup(geometry.center.x,geometry.center.y-7,.38,'url(#gold)'));
  parts.push(`<text x="${geometry.center.x}" y="${geometry.center.y+6}" text-anchor="middle" font-family="Arial,sans-serif" font-size="7.1" font-weight="900" letter-spacing=".48" fill="#fff0c2">OPTIMIST</text>`);
  parts.push(`<text x="${geometry.center.x}" y="${geometry.center.y+14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.8" font-weight="900" letter-spacing="1.1" fill="#f5d18b">LUDO</text>`);

  // Small branding sits in the border band and never shifts a logical tile or anchor.
  parts.push(`<g text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" letter-spacing="2"><text x="360" y="24" font-size="9.5" fill="#080b15" stroke="#05070d" stroke-width="3.5" paint-order="stroke">OPTIMIST LUDO</text><text x="360" y="24" font-size="9.5" fill="url(#gold)">OPTIMIST LUDO</text><text x="360" y="706" font-size="7.2" letter-spacing="1.3" fill="#fff0c4" fill-opacity=".92">${title}  ·  ${geometry.maxPlayers} PLAYERS  ·  ${geometry.trackLength} CELLS  ·  HOME ${geometry.homeCells}</text></g>`);
  parts.push('</svg>');
  return parts.join('');
}
