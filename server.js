const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Table names and audit actions
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new Database('wos.db');

// Helper query functions
const runQuery = (sql, params = []) => db.prepare(sql).run(...params);
const getQuery = (sql, params = []) => db.prepare(sql).get(...params);
const allQuery = (sql, params = []) => db.prepare(sql).all(...params);

// Audit logger
const logAudit = (entity, action, entityId) => {
  runQuery(
    `INSERT INTO ${TABLES.AUDIT} (entity, action, entity_id) VALUES (?, ?, ?)`,
    [entity, action, entityId]
  );
};

// Create tables if they don't exist
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

// API Routes
app.get('/api/cities', (req, res) => {
  try {
    const cities = allQuery(`SELECT * FROM ${TABLES.CITIES} ORDER BY name`);
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cities', (req, res) => {
  try {
    const { id, name, level, status, x, y, notes, color } = req.body;

    // Check for existing city at coordinates
    const existing = getQuery(
      `SELECT * FROM ${TABLES.CITIES} WHERE x = ? AND y = ? AND id != ?`,
      [x, y, id]
    );
    if (existing) {
      return res.status(400).json({ error: `Tile (${x}, ${y}) already has ${existing.name}. Delete or move it first.` });
    }

    runQuery(
      `INSERT OR REPLACE INTO ${TABLES.CITIES} (id, name, level, status, x, y, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, level, status, x, y, notes, color]
    );

    logAudit(TABLES.CITIES, ACTIONS.CREATE, id);
    res.json({ id, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cities/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, level, status, x, y, notes, color } = req.body;

    // Check for existing city at coordinates (excluding current city)
    const existing = getQuery(
      `SELECT * FROM ${TABLES.CITIES} WHERE x = ? AND y = ? AND id != ?`,
      [x, y, id]
    );
    if (existing) {
      return res.status(400).json({ error: `Tile (${x}, ${y}) already has ${existing.name}. Delete or move it first.` });
    }

    const result = runQuery(
      `UPDATE ${TABLES.CITIES} SET name = ?, level = ?, status = ?, x = ?, y = ?, notes = ?, color = ? WHERE id = ?`,
      [name, level, status, x, y, notes, color, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    logAudit(TABLES.CITIES, ACTIONS.UPDATE, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cities/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = runQuery(`DELETE FROM ${TABLES.CITIES} WHERE id = ?`, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    logAudit(TABLES.CITIES, ACTIONS.DELETE, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User management
app.get('/api/users', (req, res) => {
  try {
    const users = allQuery(`SELECT * FROM ${TABLES.USERS} ORDER BY username`);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const { id, username, role } = req.body;
    runQuery(
      `INSERT OR REPLACE INTO ${TABLES.USERS} (id, username, role) VALUES (?, ?, ?)`,
      [id, username, role]
    );
    logAudit(TABLES.USERS, ACTIONS.CREATE, id);
    res.json({ id, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { username, role } = req.body;
    const result = runQuery(
      `UPDATE ${TABLES.USERS} SET username = ?, role = ? WHERE id = ?`,
      [username, role, id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    logAudit(TABLES.USERS, ACTIONS.UPDATE, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = runQuery(`DELETE FROM ${TABLES.USERS} WHERE id = ?`, [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    logAudit(TABLES.USERS, ACTIONS.DELETE, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit log retrieval
app.get('/api/audit', (req, res) => {
  try {
    const logs = allQuery(`SELECT * FROM ${TABLES.AUDIT} ORDER BY timestamp DESC`);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export all cities as JSON
app.get('/api/export', (req, res) => {
  try {
    const cities = allQuery(`SELECT * FROM ${TABLES.CITIES} ORDER BY name`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="wos-spots.json"');
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import cities from JSON
app.post('/api/import', (req, res) => {
  try {
    const cities = req.body;
    
    if (!Array.isArray(cities)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    // Clear existing data
    runQuery(`DELETE FROM ${TABLES.CITIES}`);

    // Insert new data
    const insertStmt = db.prepare(
      `INSERT INTO ${TABLES.CITIES} (id, name, level, status, x, y, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    const transaction = db.transaction((cities) => {
      for (const city of cities) {
        insertStmt.run(
          city.id,
          city.name,
          city.level,
          city.status,
          city.x,
          city.y,
          city.notes,
          city.color
        );
      }
    });
    
    transaction(cities);
    res.json({ success: true, count: cities.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve pages
app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'map.html'));
});

app.get('/list', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'list.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

app.get('/users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

app.get('/', (req, res) => {
  res.redirect('/map');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Map page: http://localhost:${PORT}/map`);
  console.log(`List page: http://localhost:${PORT}/list`);
  console.log(`History page: http://localhost:${PORT}/history`);
  console.log(`Users page: http://localhost:${PORT}/users`);
});
