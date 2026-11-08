/** Compact, deterministic pawn positions: four stay visible, overflow gets a badge. */
export function getStackLayout(count, cellSize = 40) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('Stack count must be a non-negative integer.');
  }
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError('Cell size must be positive.');
  }
  if (count === 0) return { positions: [], hiddenCount: 0, badge: null };

  // One pawn stays at the exact centre and keeps its full artwork size.
  if (count === 1) {
    return {
      positions: [{ x: 0, y: 0, scale: 1, visible: true }],
      hiddenCount: 0,
      badge: null,
      scale: 1,
    };
  }

  // Two pawns use opposite diagonal corners with enough clearance.
  if (count === 2) {
    const scale = 0.48;
    const offset = 0.22 * cellSize;
    return {
      positions: [
        { x: -offset, y: -offset, scale, visible: true },
        { x: offset, y: offset, scale, visible: true },
      ],
      hiddenCount: 0,
      badge: null,
      scale,
    };
  }

  // Three or four pawns use a symmetric 2x2 layout. At 0.42 scale,
  // their visual bounds remain inside the 38.4px face of a Classic tile.
  const scale = 0.42;
  const offset = 0.24 * cellSize;
  const slots = [
    [-offset, -offset],
    [offset, -offset],
    [-offset, offset],
    [offset, offset],
  ];
  const visibleCount = Math.min(count, 4);
  const positions = Array.from({ length: count }, (_, index) => {
    if (index >= visibleCount) {
      return { x: 0, y: 0, scale: 0, visible: false };
    }
    const [x, y] = slots[index];
    return { x, y, scale, visible: true };
  });
  const hiddenCount = count - visibleCount;

  return {
    positions,
    hiddenCount,
    badge: hiddenCount ? '×' + count : null,
    scale,
  };
}
