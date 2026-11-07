import { getExtendedGeometry, getExtendedStackLayout } from './extended-geometries.js';
export const PLAYABLE_BOARD_TYPES = Object.freeze(['CLASSIC','HEXA','ROYAL']);
export function getPlayableGeometry(boardType){
 const mode=String(boardType||'').toUpperCase();
 if(mode==='HEXA'||mode==='ROYAL')return getExtendedGeometry(mode.toLowerCase());
 throw new RangeError('Unknown playable board geometry.');
}
export function getPlayableStackLayout(boardType,count){
 const mode=String(boardType||'').toUpperCase();
 if(mode==='HEXA'||mode==='ROYAL')return getExtendedStackLayout(mode.toLowerCase(),count);
 throw new RangeError('Unknown playable board geometry.');
}
