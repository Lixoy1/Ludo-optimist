import { getDiamondGeometry, getDiamondStackLayout } from './diamond-geometry.js';
import { getExtendedGeometry, getExtendedStackLayout } from './extended-geometries.js';

export const PLAYABLE_BOARD_TYPES = Object.freeze(['CLASSIC', 'DIAMOND', 'PENTA', 'HEX']);

export function getPlayableGeometry(boardType) {
  const mode = String(boardType || '').toUpperCase();
  if (mode === 'DIAMOND') return getDiamondGeometry();
  if (mode === 'PENTA' || mode === 'HEX') return getExtendedGeometry(mode.toLowerCase());
  throw new RangeError('Unknown playable board geometry.');
}

export function getPlayableStackLayout(boardType, count) {
  const mode = String(boardType || '').toUpperCase();
  if (mode === 'DIAMOND') return getDiamondStackLayout(count);
  if (mode === 'PENTA' || mode === 'HEX') return getExtendedStackLayout(mode.toLowerCase(), count);
  throw new RangeError('Unknown playable board geometry.');
}
