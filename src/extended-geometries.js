/** Canonical HEXA and ROYAL geometry. Logical routes are independent of SVG painting. */
export const BASE_CELL_SIZE = 128;
export const BOARD_THEMES = Object.freeze({
  classic: { bg:'#10131b', outer:'#4c3828', board:'#80603e', cell:'#fff8e8', tile2:'#ead8b8', edge:'#98734c', gold:'#d9ae60', shadow:'#08090d', ink:'#302417', accent:'#f2dba8', glow:'#f1c96d', baseBg:'#34271d' },
  neon: { bg:'#070a14', outer:'#11182a', board:'#141c2f', cell:'#fff9ed', tile2:'#e7d9bf', edge:'#9e8a67', gold:'#f2c66f', shadow:'#03050b', ink:'#1e2430', accent:'#fff0c8', glow:'#64dfff', baseBg:'#11182a' },
  elite: { bg:'#090807', outer:'#29180f', board:'#3a2418', cell:'#f4e4c7', tile2:'#d8bf94', edge:'#997144', gold:'#e8c278', shadow:'#080504', ink:'#342317', accent:'#ffebbd', glow:'#d9a74c', baseBg:'#32180f' },
  marble: { bg:'#09111a', outer:'#1e3340', board:'#2d4350', cell:'#f8fcff', tile2:'#d7e4ea', edge:'#91aab7', gold:'#c2dce7', shadow:'#050a10', ink:'#263f4d', accent:'#edfaff', glow:'#92d9ef', baseBg:'#203746' }
});
export const BOARD_PLAYER_COLORS = Object.freeze({
  hexa: [
    { id:'blue', label:'BLUE', color:'#168BFF', dark:'#075A8E' },
    { id:'red', label:'RED', color:'#F02D3A', dark:'#851A2B' },
    { id:'yellow', label:'YELLOW', color:'#F5B51B', dark:'#8C5A09' },
    { id:'purple', label:'PURPLE', color:'#A52BEA', dark:'#51268D' },
    { id:'green', label:'GREEN', color:'#18B94B', dark:'#12623B' },
    { id:'cyan', label:'CYAN', color:'#13C9D8', dark:'#08727D' }
  ],
  royal: [
    { id:'blue', label:'BLUE', color:'#168BFF', dark:'#075A8E' },
    { id:'red', label:'RED', color:'#F02D3A', dark:'#851A2B' },
    { id:'yellow', label:'YELLOW', color:'#F5B51B', dark:'#8C5A09' },
    { id:'green', label:'GREEN', color:'#18B94B', dark:'#12623B' }
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

function makeRoyal() {
  const nativeSize = 2816;
  const cx = nativeSize/2;
  const cy = nativeSize/2;
  const scale = VIEW/nativeSize;
  const colors = BOARD_PLAYER_COLORS.royal;
  const halfSide = 8.5;
  const starts = { blue:0, red:17, yellow:34, green:51 };
  const entries = Object.fromEntries(colors.map((player)=>[player.id,(starts[player.id]+66)%68]));
  const safe = [...new Set(colors.flatMap((player)=>[starts[player.id],starts[player.id]+6,starts[player.id]+12]))].sort((a,b)=>a-b);
  const track = [];

  // 17 cells per side, with half-cell corner margins: the 68-cell square
  // loop is continuous and remains inside the 19x19 board footprint.
  for (let side=0; side<4; side++) {
    for (let step=0; step<17; step++) {
      const x = cx + (-halfSide+step)*C;
      const y = cy - halfSide*C;
      const native = rotate(x,y,cx,cy,side*90);
      track.push({
        index:track.length, sector:side, lane:'perimeter', row:step,
        rotation:side*90,
        nativeX:fmt(native.x), nativeY:fmt(native.y),
        ...scaled(native,scale)
      });
    }
  }
  track.forEach((cell)=>{
    cell.safe=safe.includes(cell.index);
    cell.startFor=colors.find((player)=>starts[player.id]===cell.index)?.id || null;
    cell.entryFor=colors.find((player)=>entries[player.id]===cell.index)?.id || null;
  });

  const arms = colors.map((player,index)=>{
    const startIndex=starts[player.id];
    const homeEntryIndex=entries[player.id];
    const entry=track[homeEntryIndex];
    // First step leaves the perimeter at a right angle; the remaining six
    // steps turn gradually toward the central finish without touching the
    // neighbouring perimeter tile.
    const inwardNormal=rotateVector({x:1,y:0},index*90);
    const firstNative={
      x:entry.nativeX+inwardNormal.x*C,
      y:entry.nativeY+inwardNormal.y*C
    };
    const direction=unitTowardCenter(firstNative,cx,cy);
    const homeLane=[{
      ...scaled(firstNative,scale),
      nativeX:fmt(firstNative.x),nativeY:fmt(firstNative.y),
      homeIndex:1,
      rotation:Math.atan2(inwardNormal.y,inwardNormal.x)*180/Math.PI
    }];
    for(let homeIndex=1;homeIndex<7;homeIndex++) {
      const native={
        x:firstNative.x+direction.x*C*homeIndex,
        y:firstNative.y+direction.y*C*homeIndex
      };
      homeLane.push({
        ...scaled(native,scale),
        nativeX:fmt(native.x),nativeY:fmt(native.y),
        homeIndex:homeIndex+1,
        rotation:Math.atan2(direction.y,direction.x)*180/Math.PI
      });
    }
    const baseNative=rotate(cx-6*C,cy-1.5*C,cx,cy,index*90);
    return {
      index,player,angle:index*90,startIndex,homeEntryIndex,
      starIndex:startIndex+6,royalSafeIndex:startIndex+12,
      homeLane,baseCenter:scaled(baseNative,scale),
      baseSlots:pawnSlots(baseNative,index*90,scale),
      baseRadius:1.9*C*scale,baseRotation:index*90,
      finishSlots:makeFinishSlots(homeLane[homeLane.length-1] && {
        x:homeLane[homeLane.length-1].nativeX,
        y:homeLane[homeLane.length-1].nativeY
      },direction,scale,'royal'),
      homeDirection:direction
    };
  });

  const outline=polygon(8,10.35*C,cx,cy, -67.5).map((p)=>scaled(p,scale));
  const finishVertices=polygon(4,3.5*C,cx,cy,-45).map((p)=>scaled(p,scale));
  const routeLinkDistances=track.map((cell,index)=>fmt(distance(cell,track[(index+1)%68])/(C*scale)));
  return {
    id:'royal',boardId:'royal',shape:'royal-square-loop',sides:4,maxPlayers:4,tokensPerPlayer:4,
    canvasSize:nativeSize,cellSize:C,artScale:scale,
    trackLength:68,maxOuterSteps:66,homeCells:7,finishStep:74,
    startIndices:starts,homeEntryIndices:entries,safeIndices:safe,
    cellPitch:C*scale,tileSize:.82*C*scale,safeAreaSize:.8*C*scale,
    pawnDiameter:.68*C*scale,pawnMaxWidth:.82*C*scale,pawnDiameterRatio:.68,
    finishPawnScale:.68,touchTargetCssPx:48,
    center:scaled({x:cx,y:cy},scale),track,arms,outline,finishVertices,
    routeLinkDistances:[...new Set(routeLinkDistances)].sort((a,b)=>a-b)
  };
}

export const EXTENDED_GEOMETRIES = Object.freeze({ hexa:makeHexa(), royal:makeRoyal() });
export const EXTENDED_GEOMETRY_IDS = Object.freeze(['hexa','royal']);
export function getExtendedGeometry(id) {
  const geometry=EXTENDED_GEOMETRIES[String(id||'').toLowerCase()];
  if(!geometry) throw new RangeError('Unknown HEXA/ROYAL geometry.');
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
  if(!geometry || !['hexa','royal'].includes(geometry.id)) throw new TypeError('Expected HEXA or ROYAL geometry.');
  const expected=geometry.id==='hexa'
    ? { sides:6,track:72,outer:71,home:6,finish:78 }
    : { sides:4,track:68,outer:66,home:7,finish:74 };
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
  const expectedOutlineVertices=geometry.id==='hexa'?6:8;
  const expectedFinishVertices=geometry.id==='hexa'?6:4;
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

export function renderExtendedBoardSvg(geometry,theme='neon') {
  if(!BOARD_THEMES[theme]) throw new RangeError('Unknown board theme.');
  assertExtendedGeometry(geometry);
  const palette=BOARD_THEMES[theme];
  const parts=[];
  const colors=geometry.arms.map((arm)=>arm.player.color);
  const title=geometry.id.toUpperCase();
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" role="img" aria-label="OPTIMIST LUDO '+title+'"><title>OPTIMIST LUDO '+title+' board</title><defs>');
  parts.push('<linearGradient id="frame" x2="1" y2="1"><stop stop-color="'+palette.glow+'"/><stop offset=".35" stop-color="'+palette.gold+'"/><stop offset="1" stop-color="'+palette.shadow+'"/></linearGradient>');
  parts.push('<linearGradient id="tile" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".55" stop-color="'+palette.cell+'"/><stop offset="1" stop-color="'+palette.tile2+'"/></linearGradient>');
  parts.push('<radialGradient id="well"><stop stop-color="'+palette.baseBg+'"/><stop offset="1" stop-color="#03050a"/></radialGradient></defs>');
  parts.push('<rect width="720" height="720" rx="32" fill="'+palette.bg+'"/>');
  parts.push('<path d="'+closedPath(geometry.outline)+'" fill="url(#frame)" stroke="'+palette.gold+'" stroke-width="4"/>');
  const inner=geometry.outline.map((p)=>({x:360+(p.x-360)*.96,y:360+(p.y-360)*.96}));
  parts.push('<path d="'+closedPath(inner)+'" fill="'+palette.board+'" stroke="'+palette.shadow+'" stroke-width="5"/>');

  geometry.arms.forEach((arm)=>{
    const color=arm.player.color,base=arm.baseCenter,radius=arm.baseRadius;
    parts.push('<g data-base="'+arm.player.id+'"><circle cx="'+base.x+'" cy="'+base.y+'" r="'+radius+'" fill="'+palette.shadow+'" fill-opacity=".72" stroke="url(#frame)" stroke-width="5"/>');
    parts.push('<circle cx="'+base.x+'" cy="'+base.y+'" r="'+radius*.9+'" fill="'+color+'" fill-opacity=".23" stroke="'+color+'" stroke-width="3"/>');
    arm.baseSlots.forEach((slot,index)=>parts.push('<circle data-base-slot="'+arm.index+':'+index+'" cx="'+slot.x+'" cy="'+slot.y+'" r="'+geometry.pawnDiameter*.54+'" fill="url(#well)" stroke="'+palette.gold+'" stroke-width="2"/>'));
    parts.push('</g>');
  });

  geometry.track.forEach((cell)=>{
    const size=geometry.tileSize;
    const fill=cell.startFor?geometry.arms.find((arm)=>arm.player.id===cell.startFor).player.color:'url(#tile)';
    parts.push('<g data-track-cell="'+cell.index+'" data-center="'+cell.x+','+cell.y+'" transform="rotate('+cell.rotation+' '+cell.x+' '+cell.y+')">');
    parts.push('<rect x="'+(cell.x-size/2+1.5)+'" y="'+(cell.y-size/2+2.5)+'" width="'+size+'" height="'+size+'" rx="'+size*.08+'" fill="'+palette.shadow+'" opacity=".5"/>');
    parts.push('<rect x="'+(cell.x-size/2)+'" y="'+(cell.y-size/2)+'" width="'+size+'" height="'+size+'" rx="'+size*.08+'" fill="'+fill+'" stroke="'+palette.edge+'" stroke-width="1.5"/></g>');
    if(cell.safe) parts.push('<polygon data-safe-cell="'+cell.index+'" points="'+star(cell.x,cell.y,size*.22)+'" fill="'+palette.gold+'" stroke="'+palette.ink+'" stroke-width=".7"/>');
    if(cell.startFor) parts.push('<path d="M'+(cell.x-4)+' '+(cell.y+4)+'l4 -9 4 9h-3v5h-2v-5z" fill="#fff5d8" stroke="'+palette.ink+'" stroke-width=".7"/>');
  });

  geometry.arms.forEach((arm)=>{
    arm.homeLane.forEach((cell,index)=>{
      const size=geometry.tileSize,color=arm.player.color;
      parts.push('<g data-home-cell="'+arm.index+':'+index+'" transform="rotate('+cell.rotation+' '+cell.x+' '+cell.y+')">');
      parts.push('<rect x="'+(cell.x-size/2)+'" y="'+(cell.y-size/2)+'" width="'+size+'" height="'+size+'" rx="'+size*.08+'" fill="'+color+'" stroke="'+palette.gold+'" stroke-width="2"/>');
      parts.push('<text x="'+cell.x+'" y="'+(cell.y+3)+'" fill="#fff" text-anchor="middle" font-family="Arial" font-size="9">H'+(index+1)+'</text></g>');
    });
  });

  for(let index=0;index<geometry.arms.length;index++) {
    const a=geometry.finishVertices[index],b=geometry.finishVertices[(index+1)%geometry.finishVertices.length];
    parts.push('<path d="M360 360L'+a.x+' '+a.y+'L'+b.x+' '+b.y+'Z" fill="'+colors[index]+'" fill-opacity=".68" stroke="'+palette.gold+'" stroke-width="2"/>');
  }
  geometry.arms.forEach((arm)=>arm.finishSlots.forEach((slot,index)=>{
    parts.push('<circle data-finish-slot="'+arm.index+':'+index+'" cx="'+slot.x+'" cy="'+slot.y+'" r="'+geometry.pawnDiameter*geometry.finishPawnScale*.48+'" fill="url(#well)" stroke="'+palette.gold+'" stroke-width="1.3"/>');
  }));
  parts.push('<circle cx="360" cy="360" r="12" fill="url(#frame)" stroke="'+palette.gold+'" stroke-width="2"/>');
  parts.push('<path d="M352 360l3-7 5 4 4-9 4 9 5-4 3 7z" fill="'+palette.accent+'"/>');
  parts.push('<text x="360" y="24" fill="'+palette.accent+'" font-family="Arial" text-anchor="middle" font-size="10" font-weight="900" letter-spacing="2">OPTIMIST LUDO · '+title+'</text></svg>');
  return parts.join('');
}
