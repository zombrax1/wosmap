const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_EXTENSION = '.db';
const DEFAULT_DB_NAME = `wos${DB_EXTENSION}`;
const BCRYPT_ROUNDS = 10;
const DEFAULT_ADMIN = {
  id: 'admin',
  username: 'admin',
  password: 'admin',
  role: 'admin',
};

const envPath = process.env.DB_PATH || DEFAULT_DB_NAME;
const DB_PATH = path.extname(envPath) === DB_EXTENSION ? envPath : `${envPath}${DB_EXTENSION}`;

const TABLES = {
  CITIES: 'cities',
  TRAPS: 'traps',
  USERS: 'users',
  AUDIT: 'audit_logs',
};

const USER_PASSWORD_COLUMN = 'password';

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
    CREATE TABLE IF NOT EXISTS ${TABLES.TRAPS} (
      id TEXT PRIMARY KEY,
      slot INTEGER UNIQUE CHECK(slot IN (1,2)),
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      color TEXT NOT NULL DEFAULT '#f59e0b',
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS ${TABLES.AUDIT} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureUsersTable();

  const admin = getQuery(
    `SELECT ${USER_PASSWORD_COLUMN} FROM ${TABLES.USERS} WHERE username = ?`,
    [DEFAULT_ADMIN.username]
  );

  if (!admin) {
    runQuery(
      `INSERT INTO ${TABLES.USERS} (id, username, ${USER_PASSWORD_COLUMN}, role) VALUES (?, ?, ?, ?)`,
      [
        DEFAULT_ADMIN.id,
        DEFAULT_ADMIN.username,
        bcrypt.hashSync(DEFAULT_ADMIN.password, BCRYPT_ROUNDS),
        DEFAULT_ADMIN.role,
      ]
    );
  } else if (!admin[USER_PASSWORD_COLUMN]) {
    runQuery(
      `UPDATE ${TABLES.USERS} SET ${USER_PASSWORD_COLUMN} = ? WHERE username = ?`,
      [
        bcrypt.hashSync(DEFAULT_ADMIN.password, BCRYPT_ROUNDS),
        DEFAULT_ADMIN.username,
      ]
    );
  }
}

function ensureUsersTable() {
  const tableInfo = db
    .prepare(`PRAGMA table_info(${TABLES.USERS})`)
    .all();

  if (tableInfo.length === 0) {
    db.exec(`
      CREATE TABLE ${TABLES.USERS} (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        ${USER_PASSWORD_COLUMN} TEXT NOT NULL,
        role TEXT NOT NULL
      );
    `);
    return;
  }

  const hasPassword = tableInfo.some(
    (column) => column.name === USER_PASSWORD_COLUMN
  );
  if (!hasPassword) {
    db.exec(
      `ALTER TABLE ${TABLES.USERS} ADD COLUMN ${USER_PASSWORD_COLUMN} TEXT NOT NULL DEFAULT ''`
    );
  }
}

function clearDatabase() {
  runQuery(`DELETE FROM ${TABLES.CITIES}`);
  runQuery(`DELETE FROM ${TABLES.TRAPS}`);
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
  db,
};