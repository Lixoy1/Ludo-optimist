export function getStackLayout(count, cellSize = 60) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Token count must be a non-negative integer');
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('cellSize must be positive');
  if (count === 0) return { positions: [], hiddenCount: 0, scale: 1 };
  const patterns = {
    1: [[0, 0]],
    2: [[-.19, 0], [.19, 0]],
    3: [[0, -.20], [-.20, .20], [.20, .20]],
    4: [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]],
  };
  const visible = Math.min(count, 4), offsets = patterns[visible];
  const scale = visible === 1 ? 1 : visible === 2 ? .64 : visible === 3 ? .60 : .56;
  const positions = Array.from({ length: count }, (_, index) => {
    if (index >= visible) return { x: 0, y: 0, scale: 0, slot: index, visible: false };
    const [x, y] = offsets[index];
    return { x: x * cellSize, y: y * cellSize, scale, slot: index, visible: true };
  });
  return { positions, hiddenCount: Math.max(0, count - visible), scale };
}
export function layoutTokens(tokens, cellSize = 60) {
  const layout = getStackLayout(tokens.length, cellSize);
  return { ...layout, tokens: tokens.slice(0, 4).map((token, index) => ({ ...token, ...layout.positions[index] })) };
}
