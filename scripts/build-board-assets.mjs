import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAIN_TRACK, PLAYER_CONFIG, SAFE_TRACK_INDICES } from '../src/geometry.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'assets/boards');
const O=55,C=43.57,T=38,fmt=n=>Number(n.toFixed(2)),xy=(c,r)=>[fmt(O+c*C),fmt(O+r*C)];
const colors={red:'#ec5260',green:'#56c87b',yellow:'#efbd4d',blue:'#48b6f2'};
const themes={
 classic:{a:'#54361f',b:'#bd8d53',c:'#7b512e',felt:'#c6a87b',field:'#e8d7b5',tile:'#fff8e8',line:'#98734c',accent:'#b98745',text:'#50361f',safe:'#f1d38d',texture:'wood'},
 neon:{a:'#090d18',b:'#283047',c:'#0b1220',felt:'#101522',field:'#111827',tile:'#e5edf3',line:'#66758c',accent:'#f2c35f',text:'#f8f4e9',safe:'#f6d267',texture:'tech'},
 elite:{a:'#21120d',b:'#8c5d35',c:'#3c2116',felt:'#2d1b15',field:'#382319',tile:'#ead8b5',line:'#8b663e',accent:'#edc778',text:'#f8e5bd',safe:'#f3d48d',texture:'walnut'},
 marble:{a:'#263440',b:'#a7bdc9',c:'#455967',felt:'#536875',field:'#d9e2e6',tile:'#f8fbfc',line:'#8ba5b3',accent:'#bed5df',text:'#263744',safe:'#d4edf3',texture:'marble'}
};
const sockets={blue:[[132,132],[182,132],[132,182],[182,182]],red:[[538,132],[588,132],[538,182],[588,182]],green:[[132,538],[182,538],[132,588],[182,588]],yellow:[[538,538],[588,538],[538,588],[588,588]]};
const bases={blue:[157,157],red:[563,157],green:[157,563],yellow:[563,563]};
function build(key,t){
 const starts=new Map(Object.entries(PLAYER_CONFIG).map(([c,p])=>[p.start,c]));
 const safe=new Set([...SAFE_TRACK_INDICES].filter(i=>!starts.has(i)));
 const tile=(x,y,fill,meta='')=>\`<g \${meta}><rect x="\${fmt(x-T/2)}" y="\${fmt(y-T/2)}" width="\${T}" height="\${T}" rx="5" fill="\${t.tile}" stroke="\${t.line}" stroke-width="1.25"/><rect x="\${fmt(x-T/2+2.5)}" y="\${fmt(y-T/2+2.5)}" width="\${T-5}" height="\${T-5}" rx="4" fill="\${fill}" stroke="#fff" stroke-opacity=".25" stroke-width=".7"/></g>\`;
 const grain=t.texture==='wood'?'<path d="M0 10 C28 4 52 18 120 8 M0 29 C33 24 58 38 120 25 M0 52 C36 44 72 60 120 48" fill="none" stroke="'+t.accent+'" stroke-opacity=".2" stroke-width="1.3"/>':t.texture==='walnut'?'<path d="M0 12 C45 0 70 29 150 11 M0 42 C38 30 86 59 150 37 M0 72 C56 57 96 82 150 68" fill="none" stroke="'+t.accent+'" stroke-opacity=".2" stroke-width="1.5"/>':t.texture==='marble'?'<path d="M-12 18 C28 44 42 -1 82 18 S142 47 205 4 M-20 98 C28 68 58 129 94 91 S151 71 205 122" fill="none" stroke="'+t.accent+'" stroke-opacity=".2" stroke-width="2"/>':'<path d="M0 17H120 M60 0V64 M0 0L120 64 M120 0L0 64" fill="none" stroke="'+t.safe+'" stroke-opacity=".14" stroke-width=".8"/>';
 let s=\`<?xml version="1.0" encoding="UTF-8"?>\\n<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1440" viewBox="0 0 720 720" data-theme="\${key}" data-board-size="720" role="img" aria-labelledby="title desc"><title id="title">OPTIMIST LUDO \${key.toUpperCase()}</title><desc id="desc">Ludo board with 52 route cells, four bases, four home lanes and four finish positions.</desc><defs><linearGradient id="frame" x2="1" y2="1"><stop stop-color="\${t.b}"/><stop offset=".3" stop-color="\${t.a}"/><stop offset=".7" stop-color="\${t.c}"/><stop offset="1" stop-color="\${t.b}"/></linearGradient><linearGradient id="field" x2="1" y2="1"><stop stop-color="\${t.field}"/><stop offset="1" stop-color="\${t.felt}"/></linearGradient><pattern id="grain" width="150" height="90" patternUnits="userSpaceOnUse">\${grain}</pattern></defs><rect x="6" y="6" width="708" height="708" rx="34" fill="url(#frame)" stroke="\${t.accent}" stroke-width="2.6"/><rect x="13" y="13" width="694" height="694" rx="30" fill="none" stroke="#fff" stroke-opacity=".28"/><rect x="19" y="19" width="682" height="682" rx="27" fill="url(#field)" stroke="\${t.line}" stroke-width="1.5"/><rect x="22" y="22" width="676" height="676" rx="25" fill="url(#grain)" opacity=".8"/>\`;
 for(const [x,y,sx,sy] of [[36,36,1,1],[684,36,-1,1],[36,684,1,-1],[684,684,-1,-1]])s+=\`<g transform="translate(\${x} \${y}) scale(\${sx} \${sy})"><path d="M0 18V0H18 M4 13V4H13" fill="none" stroke="\${t.accent}" stroke-width="2.1" stroke-linecap="round"/></g>\`;
 for(const [c,[cx,cy]] of Object.entries(bases)){
  s+=\`<g data-base="\${c}"><circle cx="\${cx}" cy="\${cy}" r="112" fill="#05070d" fill-opacity=".56" stroke="\${t.accent}" stroke-width="3.2"/><circle cx="\${cx}" cy="\${cy}" r="105" fill="\${colors[c]}" fill-opacity=".25" stroke="\${colors[c]}" stroke-width="4"/><circle cx="\${cx}" cy="\${cy}" r="98" fill="\${t.field}" fill-opacity=".72" stroke="\${t.safe}" stroke-width="2"/><circle cx="\${cx}" cy="\${cy}" r="88" fill="none" stroke="\${t.accent}" stroke-opacity=".7" stroke-width="1.4" stroke-dasharray="3 7"/>\`;
  for(const [x,y] of sockets[c])s+=\`<circle cx="\${x}" cy="\${y}" r="22.5" fill="#070b14" fill-opacity=".72" stroke="\${t.accent}" stroke-width="2.2"/><circle cx="\${x}" cy="\${y}" r="18.4" fill="\${colors[c]}" fill-opacity=".2" stroke="\${colors[c]}" stroke-width="1.4"/>\`;
  s+='</g>';
 }
 MAIN_TRACK.forEach(cell=>{const[x,y]=xy(cell.col,cell.row),color=starts.get(cell.index);s+=tile(x,y,color?colors[color]:t.tile,\`data-track-index="\${cell.index}" data-grid="\${cell.col},\${cell.row}" data-center="\${x},\${y}"\`);if(safe.has(cell.index))s+=\`<path d="M \${x} \${y-9} l2.5 6 6.5 .5 -5 4 1.7 6.3 -5.7 -3.6 -5.7 3.6 1.7 -6.3 -5 -4 6.5 -.5Z" fill="\${t.safe}" stroke="#fff" stroke-width=".6"/>\`;if(color)s+=\`<circle cx="\${x}" cy="\${y}" r="7.8" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/>\`;});
 for(const[color,config]of Object.entries(PLAYER_CONFIG))config.lane.forEach(([col,row],i)=>{const[x,y]=xy(col,row);s+=tile(x,y,colors[color],\`data-home-color="\${color}" data-home-index="\${i}" data-grid="\${col},\${row}" data-center="\${x},\${y}"\`);s+=\`<rect x="\${fmt(x-14)}" y="\${fmt(y-14)}" width="28" height="28" rx="4" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".9"/>\`;});
 const a=xy(6,6),b=xy(8,6),c=xy(8,8),d=xy(6,8);
 s+=\`<polygon data-finish-wedge="blue" points="\${a} \${b} 360,360" fill="\${colors.blue}" stroke="\${t.accent}" stroke-width="2"/><polygon data-finish-wedge="red" points="\${b} \${c} 360,360" fill="\${colors.red}" stroke="\${t.accent}" stroke-width="2"/><polygon data-finish-wedge="yellow" points="\${c} \${d} 360,360" fill="\${colors.yellow}" stroke="\${t.accent}" stroke-width="2"/><polygon data-finish-wedge="green" points="\${d} \${a} 360,360" fill="\${colors.green}" stroke="\${t.accent}" stroke-width="2"/>\`;
 for(const[x,y]of[[336,336],[384,336],[336,384],[384,384]])s+=\`<circle data-finish-slot="\${x},\${y}" cx="\${x}" cy="\${y}" r="13.2" fill="#0b1018" fill-opacity=".25" stroke="\${t.accent}" stroke-width="1.2"/>\`;
 return s+\`<circle cx="360" cy="360" r="9" fill="\${t.accent}" stroke="#fff4d2" stroke-width="1.2"/></svg>\`;
}
await mkdir(out,{recursive:true});
for(const[key,theme]of Object.entries(themes)){const file=resolve(out,\`optimist-ludo-\${key}.svg\`);await writeFile(file,build(key,theme),'utf8');console.log('Wrote '+file);}
