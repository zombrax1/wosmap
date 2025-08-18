const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

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

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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
      [id, name, level, status, x, y, notes, color]
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
      [name, level, status, x, y, notes, color, id]
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

// Export all cities as JSON
app.get('/api/export', requireAuth, (req, res) => {
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
app.post('/api/import', requireRole(...USER_MANAGEMENT_ROLES), (req, res) => {
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

    const transaction = db.transaction((data) => {
      for (const city of data) {
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
    return res.json({ success: true, count: cities.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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

app.get('/users', requireRole(...USER_MANAGEMENT_ROLES), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'users.html'));
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

