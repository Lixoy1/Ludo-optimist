import { getExtendedGeometry, getExtendedStackLayout } from './extended-geometries.js';

export const PLAYABLE_BOARD_TYPES = Object.freeze(['CLASSIC', 'HEXA']);

export function getPlayableGeometry(boardType) {
  const mode = String(boardType || '').toUpperCase();
  if (mode === 'HEXA') return getExtendedGeometry('hexa');
  throw new RangeError('Unknown playable board geometry.');
}

export function getPlayableStackLayout(boardType, count) {
  const mode = String(boardType || '').toUpperCase();
  if (mode === 'HEXA') return getExtendedStackLayout('hexa', count);
  throw new RangeError('Unknown playable board geometry.');
}
