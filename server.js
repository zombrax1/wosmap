const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const {
  TABLES,
  ACTIONS,
  runQuery,
  getQuery,
  allQuery,
  logAudit,
  initializeDatabase,
  db,
} = require('./db');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'wosmap-secret';
const BCRYPT_ROUNDS = 10;
const USER_MANAGEMENT_ROLES = ['admin', 'moderator'];
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(PUBLIC_DIR));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

initializeDatabase();

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

// Authentication routes
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = getQuery(
      `SELECT * FROM ${TABLES.USERS} WHERE username = ?`,
      [username]
    );

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    return res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

// Level color routes
app.get('/api/levels', (req, res) => {
  try {
    const levels = allQuery(`SELECT level, color FROM ${TABLES.LEVELS} ORDER BY level`);
    res.json(levels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/levels', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { level, color } = req.body;
    runQuery(
      `INSERT OR REPLACE INTO ${TABLES.LEVELS} (level, color) VALUES (?, ?)`,
      [level, color]
    );
    runQuery(
      `UPDATE ${TABLES.CITIES} SET color = ? WHERE level = ?`,
      [color, level]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// City routes
app.get('/api/cities', (req, res) => {
  try {
    const cities = allQuery(`SELECT * FROM ${TABLES.CITIES} ORDER BY name`);
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cities', requireAuth, (req, res) => {
  try {
    const { id, name, level, status, x, y, notes, color } = req.body;

    const levelEntry = getQuery(
      `SELECT color FROM ${TABLES.LEVELS} WHERE level = ?`,
      [level]
    );
    const finalColor = color || (levelEntry ? levelEntry.color : undefined);

    const existing = getQuery(
      `SELECT * FROM ${TABLES.CITIES} WHERE x = ? AND y = ? AND id != ?`,
      [x, y, id]
    );

    if (existing) {
      return res
        .status(400)
        .json({ error: `Tile (${x}, ${y}) already has ${existing.name}. Delete or move it first.` });
    }

    runQuery(
      `INSERT OR REPLACE INTO ${TABLES.CITIES} (id, name, level, status, x, y, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, level, status, x, y, notes, finalColor]
    );

    logAudit(TABLES.CITIES, ACTIONS.CREATE, id);
    return res.json({ id, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/cities/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, level, status, x, y, notes, color } = req.body;

    const levelEntry = getQuery(
      `SELECT color FROM ${TABLES.LEVELS} WHERE level = ?`,
      [level]
    );
    const finalColor = color || (levelEntry ? levelEntry.color : undefined);

    const existing = getQuery(
      `SELECT * FROM ${TABLES.CITIES} WHERE x = ? AND y = ? AND id != ?`,
      [x, y, id]
    );

    if (existing) {
      return res
        .status(400)
        .json({ error: `Tile (${x}, ${y}) already has ${existing.name}. Delete or move it first.` });
    }

    const result = runQuery(
      `UPDATE ${TABLES.CITIES} SET name = ?, level = ?, status = ?, x = ?, y = ?, notes = ?, color = ? WHERE id = ?`,
      [name, level, status, x, y, notes, finalColor, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    logAudit(TABLES.CITIES, ACTIONS.UPDATE, id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cities/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const result = runQuery(`DELETE FROM ${TABLES.CITIES} WHERE id = ?`, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    logAudit(TABLES.CITIES, ACTIONS.DELETE, id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Trap routes
app.get('/api/traps', (req, res) => {
  try {
    const traps = allQuery(`SELECT * FROM ${TABLES.TRAPS} ORDER BY slot`);
    res.json(traps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/traps', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id, slot, x, y, color, notes } = req.body;
    runQuery(
      `INSERT OR REPLACE INTO ${TABLES.TRAPS} (id, slot, x, y, color, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, slot, x, y, color, notes]
    );
    logAudit(TABLES.TRAPS, ACTIONS.CREATE, id);
    return res.json({ id, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/traps/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { slot, x, y, color, notes } = req.body;
    const result = runQuery(
      `UPDATE ${TABLES.TRAPS} SET slot = ?, x = ?, y = ?, color = ?, notes = ? WHERE id = ?`,
      [slot, x, y, color, notes, id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trap not found' });
    }
    logAudit(TABLES.TRAPS, ACTIONS.UPDATE, id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/traps/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const result = runQuery(`DELETE FROM ${TABLES.TRAPS} WHERE id = ?`, [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trap not found' });
    }
    logAudit(TABLES.TRAPS, ACTIONS.DELETE, id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// User management
app.get('/api/users', requireRole(...USER_MANAGEMENT_ROLES), (req, res) => {
  try {
    const users = allQuery(`SELECT id, username, role FROM ${TABLES.USERS} ORDER BY username`);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  '/api/users',
  requireRole(...USER_MANAGEMENT_ROLES),
  (req, res) => {
    try {
      const { id, username, password, role } = req.body;
      const hashedPassword = bcrypt.hashSync(password, BCRYPT_ROUNDS);
      runQuery(
        `INSERT OR REPLACE INTO ${TABLES.USERS} (id, username, password, role) VALUES (?, ?, ?, ?)`,
        [id, username, hashedPassword, role]
      );
      logAudit(TABLES.USERS, ACTIONS.CREATE, id);
      return res.json({ id, success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

app.put(
  '/api/users/:id',
  requireRole(...USER_MANAGEMENT_ROLES),
  (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role } = req.body;
      const sql = password
        ? `UPDATE ${TABLES.USERS} SET username = ?, password = ?, role = ? WHERE id = ?`
        : `UPDATE ${TABLES.USERS} SET username = ?, role = ? WHERE id = ?`;
      const params = password
        ? [username, bcrypt.hashSync(password, BCRYPT_ROUNDS), role, id]
        : [username, role, id];

      const result = runQuery(sql, params);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      logAudit(TABLES.USERS, ACTIONS.UPDATE, id);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

app.delete(
  '/api/users/:id',
  requireRole(...USER_MANAGEMENT_ROLES),
  (req, res) => {
    try {
      const { id } = req.params;
      const result = runQuery(`DELETE FROM ${TABLES.USERS} WHERE id = ?`, [id]);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      logAudit(TABLES.USERS, ACTIONS.DELETE, id);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Audit log retrieval
app.get('/api/audit', requireAuth, (req, res) => {
  try {
    const logs = allQuery(`SELECT * FROM ${TABLES.AUDIT} ORDER BY timestamp DESC`);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Snapshot of cities and traps with ETag
app.get('/api/snapshot', (req, res) => {
  try {
    const cities = allQuery(`SELECT * FROM ${TABLES.CITIES} ORDER BY name`);
    const traps = allQuery(`SELECT * FROM ${TABLES.TRAPS} ORDER BY slot`);
    const hash = crypto
      .createHash('sha1')
      .update(JSON.stringify({ cities, traps }))
      .digest('hex');

    if (req.headers['if-none-match'] === hash) {
      return res.status(304).end();
    }

    res.setHeader('ETag', hash);
    res.json({ etag: hash, cities, traps, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export all cities as JSON
app.get('/api/export', requireAuth, (req, res) => {
  try {
    const cities = allQuery(`SELECT * FROM ${TABLES.CITIES} ORDER BY name`);
    const traps = allQuery(`SELECT * FROM ${TABLES.TRAPS} ORDER BY slot`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="wos-spots.json"');
    res.json({ version: 2, cities, traps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import cities from JSON
app.post('/api/import', requireRole(...USER_MANAGEMENT_ROLES), (req, res) => {
  try {
    const payload = req.body;
    let cities = [];
    let traps = [];

    if (Array.isArray(payload)) {
      cities = payload;
    } else {
      if (
        typeof payload !== 'object' ||
        payload.version !== 2 ||
        !Array.isArray(payload.cities) ||
        !Array.isArray(payload.traps)
      ) {
        return res.status(400).json({ error: 'Invalid data format' });
      }
      cities = payload.cities;
      traps = payload.traps;
    }

    // Clear existing data
    runQuery(`DELETE FROM ${TABLES.CITIES}`);
    runQuery(`DELETE FROM ${TABLES.TRAPS}`);

    // Insert cities
    const insertCity = db.prepare(
      `INSERT INTO ${TABLES.CITIES} (id, name, level, status, x, y, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertTrap = db.prepare(
      `INSERT INTO ${TABLES.TRAPS} (id, slot, x, y, color, notes) VALUES (?, ?, ?, ?, ?, ?)`
    );

    const transaction = db.transaction(() => {
      for (const city of cities) {
        insertCity.run(
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
      for (const trap of traps) {
        insertTrap.run(trap.id, trap.slot, trap.x, trap.y, trap.color, trap.notes);
        logAudit(TABLES.TRAPS, ACTIONS.CREATE, trap.id);
      }
    });

    transaction();
    return res.json({ success: true, cities: cities.length, traps: traps.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Serve pages
app.get('/map', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'map.html'));
});

app.get('/list', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'list.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'history.html'));
});

app.get('/users', requireRole(...USER_MANAGEMENT_ROLES), (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'users.html'));
});

app.get('/levels', requireRole('admin'), (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'levels.html'));
});

app.get('/', (req, res) => {
  res.redirect('/map');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Map page: http://localhost:${PORT}/map`);
    console.log(`List page: http://localhost:${PORT}/list`);
    console.log(`History page: http://localhost:${PORT}/history`);
    console.log(`Users page: http://localhost:${PORT}/users`);
  });
}

module.exports = app;

