const COLS = 41;
const ROWS = 41;
const CENTER_X = Math.floor(COLS / 2);
const CENTER_Y = Math.floor(ROWS / 2);

function pointToCell(point, el, cols = COLS, rows = ROWS) {
  const rect = el.getBoundingClientRect();
  const scaleX = rect.width / el.offsetWidth;
  const scaleY = rect.height / el.offsetHeight;
  const localX = (point.x - rect.left) / scaleX;
  const localY = (point.y - rect.top) / scaleY;
  let col = Math.floor((localX / el.offsetWidth) * cols);
  let row = Math.floor((localY / el.offsetHeight) * rows);
  col = Math.min(Math.max(col, 0), cols - 1);
  row = Math.min(Math.max(row, 0), rows - 1);
  return {
    x: col - Math.floor(cols / 2),
    y: row - Math.floor(rows / 2)
  };
}
