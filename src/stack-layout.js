/**
 * Returns deterministic compact offsets for multiple tokens on one logical cell.
 * Offsets are normalized to cell size and are shared by every visual theme.
 */
export function getStackLayout(count, cellSize = 60) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Token count must be a non-negative integer');
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('cellSize must be positive');
  if (count === 0) return { positions: [], hiddenCount: 0, scale: 1 };

  const patterns = {
    1: [[0, 0]],
    2: [[-0.19, 0], [0.19, 0]],
    3: [[0, -0.18], [-0.19, 0.17], [0.19, 0.17]],
    4: [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]],
  };
  const visibleCount = Math.min(count, 4);
  const offsets = patterns[visibleCount];
  const scale = visibleCount === 1 ? 1 : visibleCount === 2 ? 0.78 : visibleCount === 3 ? 0.68 : 0.58;
  return {
    positions: offsets.map(([x, y], index) => ({
      x: x * cellSize,
      y: y * cellSize,
      scale,
      slot: index,
    })),
    hiddenCount: Math.max(0, count - visibleCount),
    scale,
  };
}

export function layoutTokens(tokens, cellSize = 60) {
  const layout = getStackLayout(tokens.length, cellSize);
  return {
    ...layout,
    tokens: tokens.slice(0, 4).map((token, index) => ({
      ...token,
      ...layout.positions[index],
    })),
  };
}
