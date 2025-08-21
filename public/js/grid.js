const COLS = 41;
const ROWS = 41;
const CENTER_X = Math.floor(COLS / 2);
const CENTER_Y = Math.floor(ROWS / 2);

function pointToCell(point, el, cols = COLS, rows = ROWS) {
  const rect = el.getBoundingClientRect();
  const scaleX = rect.width / el.offsetWidth;
  const scaleY = rect.height / el.offsetHeight;
  const x = (point.x - rect.left) / scaleX;
  const y = (point.y - rect.top) / scaleY;
  const col = Math.floor((x / el.offsetWidth) * cols);
  const row = Math.floor((y / el.offsetHeight) * rows);
  return {
    x: col - Math.floor(cols / 2),
    y: row - Math.floor(rows / 2)
  };
}
