const fs = require('fs');

test('appends .db extension when missing from DB_PATH', () => {
  const temp = 'noext';
  const expected = `${temp}.db`;
  process.env.DB_PATH = temp;
  if (fs.existsSync(expected)) fs.unlinkSync(expected);
  delete require.cache[require.resolve('../db')];
  const { db } = require('../db');
  expect(db.name).toBe(expected);
  db.close();
  expect(fs.existsSync(expected)).toBe(true);
  fs.unlinkSync(expected);
  delete process.env.DB_PATH;
  delete require.cache[require.resolve('../db')];
});
