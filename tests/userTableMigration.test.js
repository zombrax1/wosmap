const fs = require('fs');
const Database = require('better-sqlite3');

test('initializeDatabase adds password column when missing', () => {
  const TEMP_DB = 'migration.db';
  if (fs.existsSync(TEMP_DB)) fs.unlinkSync(TEMP_DB);

  const tmpDb = new Database(TEMP_DB);
  tmpDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `);
  tmpDb.close();

  process.env.DB_PATH = TEMP_DB;
  delete require.cache[require.resolve('../db')];
  const { initializeDatabase, db } = require('../db');
  initializeDatabase();
  const columns = db.prepare('PRAGMA table_info(users)').all();
  const colNames = columns.map((c) => c.name);
  expect(colNames).toContain('password');
  db.close();
  fs.unlinkSync(TEMP_DB);
  delete process.env.DB_PATH;
  delete require.cache[require.resolve('../db')];
});
