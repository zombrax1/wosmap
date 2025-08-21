const COLS = 41;
const ROWS = 41;
const CENTER_X = Math.floor(COLS / 2);
const CENTER_Y = Math.floor(ROWS / 2);

function pointToCell(point, el, cols = COLS, rows = ROWS) {
  const rect = el.getBoundingClientRect();
  const xRatio = (point.x - rect.left) / rect.width;
  const yRatio = (point.y - rect.top) / rect.height;
  const col = Math.floor(xRatio * cols);
  const row = Math.floor(yRatio * rows);
  return {
    x: col - Math.floor(cols / 2),
    y: row - Math.floor(rows / 2)
  };
}
