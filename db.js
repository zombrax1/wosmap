const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || 'wos.db';

const TABLES = {
  CITIES: 'cities',
  USERS: 'users',
  AUDIT: 'audit_logs',
};

const ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

const db = new Database(DB_PATH);

const runQuery = (sql, params = []) => db.prepare(sql).run(...params);
const getQuery = (sql, params = []) => db.prepare(sql).get(...params);
const allQuery = (sql, params = []) => db.prepare(sql).all(...params);

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLES.CITIES} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER,
      status TEXT NOT NULL DEFAULT 'occupied',
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      notes TEXT,
      color TEXT DEFAULT '#ec4899'
    );
    CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${TABLES.AUDIT} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function clearDatabase() {
  runQuery(`DELETE FROM ${TABLES.CITIES}`);
  runQuery(`DELETE FROM ${TABLES.USERS}`);
  runQuery(`DELETE FROM ${TABLES.AUDIT}`);
}

function logAudit(entity, action, entityId) {
  runQuery(
    `INSERT INTO ${TABLES.AUDIT} (entity, action, entity_id) VALUES (?, ?, ?)`,
    [entity, action, entityId]
  );
}

module.exports = {
  TABLES,
  ACTIONS,
  runQuery,
  getQuery,
  allQuery,
  logAudit,
  initializeDatabase,
  clearDatabase,
};
