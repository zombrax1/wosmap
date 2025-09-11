const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_EXTENSION = '.db';
const DEFAULT_DB_NAME = `wos${DB_EXTENSION}`;
const BCRYPT_ROUNDS = 10;
const DEFAULT_ADMIN = {
  id: 'admin',
  username: 'admin',
  // In production, if ADMIN_PASSWORD not provided, generate a strong one on first run.
  password:
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === 'production'
      ? crypto.randomBytes(12).toString('base64url')
      : 'admin'),
  role: 'admin',
};

const envPath = process.env.DB_PATH || DEFAULT_DB_NAME;
const DB_PATH = path.extname(envPath) === DB_EXTENSION ? envPath : `${envPath}${DB_EXTENSION}`;

const TABLES = {
  CITIES: 'cities',
  TRAPS: 'traps',
  USERS: 'users',
  AUDIT: 'audit_logs',
  LEVELS: 'level_colors',
};

const USER_PASSWORD_COLUMN = 'password';

const ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

const createSingleton = process.env.DB_SINGLETON !== 'false';
const db = createSingleton ? new Database(DB_PATH) : null;

function withDb(fn) {
  if (db) return fn(db);
  const temp = new Database(DB_PATH);
  try {
    return fn(temp);
  } finally {
    try { temp.close(); } catch (_) {}
  }
}

const runQuery = (sql, params = []) => withDb((d) => d.prepare(sql).run(...params));
const getQuery = (sql, params = []) => withDb((d) => d.prepare(sql).get(...params));
const allQuery = (sql, params = []) => withDb((d) => d.prepare(sql).all(...params));

function initializeDatabase() {
  withDb((d) => d.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLES.CITIES} (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER,
      status TEXT NOT NULL DEFAULT 'occupied',
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      px INTEGER, -- absolute pixel X (optional)
      py INTEGER, -- absolute pixel Y (optional)
      notes TEXT,
      color TEXT DEFAULT '#ec4899'
    );
    CREATE TABLE IF NOT EXISTS ${TABLES.TRAPS} (
      id TEXT PRIMARY KEY,
      slot INTEGER UNIQUE CHECK(slot IN (1,2,3)),
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      color TEXT NOT NULL DEFAULT '#f59e0b',
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS ${TABLES.LEVELS} (
      level INTEGER PRIMARY KEY,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ${TABLES.AUDIT} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT,
      user TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `));

  ensureUsersTable();
  ensureAuditTable();
  ensureTrapsTable();
  ensureAuditTable();
  ensureCitiesAbsoluteColumns();

  // Seed default level colors (1-5)
  const defaultLevelColors = {
    1: '#ef4444',
    2: '#f59e0b',
    3: '#10b981',
    4: '#3b82f6',
    5: '#8b5cf6',
  };
  for (const [level, color] of Object.entries(defaultLevelColors)) {
    runQuery(
      `INSERT OR IGNORE INTO ${TABLES.LEVELS} (level, color) VALUES (?, ?)`,
      [level, color]
    );
  }

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
    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
      // eslint-disable-next-line no-console
      console.warn(
        `Admin user created. Set ADMIN_PASSWORD env. Temporary password: ${DEFAULT_ADMIN.password}`
      );
    }
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
  const tableInfo = allQuery(`PRAGMA table_info(${TABLES.USERS})`);

  if (tableInfo.length === 0) {
    withDb((d) => d.exec(`
      CREATE TABLE ${TABLES.USERS} (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        ${USER_PASSWORD_COLUMN} TEXT NOT NULL,
        role TEXT NOT NULL
      );
    `));
    return;
  }

  const hasPassword = tableInfo.some(
    (column) => column.name === USER_PASSWORD_COLUMN
  );
  if (!hasPassword) {
    withDb((d) =>
      d.exec(
        `ALTER TABLE ${TABLES.USERS} ADD COLUMN ${USER_PASSWORD_COLUMN} TEXT NOT NULL DEFAULT ''`
      )
    );
  }
}

function ensureTrapsTable() {
  const row = getQuery(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${TABLES.TRAPS}'`);
  const createSql = row && row.sql ? String(row.sql) : '';
  if (createSql.includes('CHECK(slot IN (1,2))')) {
    // Migrate to allow slot 1,2,3
    withDb((d) => {
      const migrate = `
        PRAGMA foreign_keys=off;
        BEGIN TRANSACTION;
        CREATE TABLE ${TABLES.TRAPS}_new (
          id TEXT PRIMARY KEY,
          slot INTEGER UNIQUE CHECK(slot IN (1,2,3)),
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,
          color TEXT NOT NULL DEFAULT '#f59e0b',
          notes TEXT
        );
        INSERT INTO ${TABLES.TRAPS}_new (id, slot, x, y, color, notes)
          SELECT id, slot, x, y, color, notes FROM ${TABLES.TRAPS};
        DROP TABLE ${TABLES.TRAPS};
        ALTER TABLE ${TABLES.TRAPS}_new RENAME TO ${TABLES.TRAPS};
        COMMIT;
        PRAGMA foreign_keys=on;
      `;
      d.exec(migrate);
    });
  }
}

function ensureCitiesAbsoluteColumns() {
  const cols = allQuery(`PRAGMA table_info(${TABLES.CITIES})`).map((c) => c.name);
  if (!cols.includes('px')) {
    withDb((d) => d.exec(`ALTER TABLE ${TABLES.CITIES} ADD COLUMN px INTEGER`));
  }
  if (!cols.includes('py')) {
    withDb((d) => d.exec(`ALTER TABLE ${TABLES.CITIES} ADD COLUMN py INTEGER`));
  }
}

function ensureAuditTable() {
  const tableInfo = allQuery(`PRAGMA table_info(${TABLES.AUDIT})`);
  const colNames = tableInfo.map((c) => c.name);
  if (!colNames.includes('user')) {
    withDb((d) => d.exec(`ALTER TABLE ${TABLES.AUDIT} ADD COLUMN user TEXT`));
  }
  if (!colNames.includes('details')) {
    withDb((d) => d.exec(`ALTER TABLE ${TABLES.AUDIT} ADD COLUMN details TEXT`));
  }
}

function clearDatabase() {
  runQuery(`DELETE FROM ${TABLES.CITIES}`);
  runQuery(`DELETE FROM ${TABLES.TRAPS}`);
  runQuery(`DELETE FROM ${TABLES.USERS}`);
  runQuery(`DELETE FROM ${TABLES.AUDIT}`);
}

function logAudit(entity, action, entityId, meta = {}) {
  const { user = '', details = '' } = meta;
  runQuery(
    `INSERT INTO ${TABLES.AUDIT} (entity, action, entity_id, user, details) VALUES (?, ?, ?, ?, ?)`,
    [entity, action, entityId, user, details]
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
  withDb,
  ensureCitiesAbsoluteColumns,
};
