const COLS = 41;
const ROWS = 41;
const CENTER_X = Math.floor(COLS / 2);
const CENTER_Y = Math.floor(ROWS / 2);

function pointToCell(point, el, cols = COLS, rows = ROWS) {
  const rect = el.getBoundingClientRect();
  const col = Math.floor(((point.x - rect.left) / rect.width) * cols);
  const row = Math.floor(((point.y - rect.top) / rect.height) * rows);
  return {
    x: col - Math.floor(cols / 2),
    y: row - Math.floor(rows / 2)
  };
}
