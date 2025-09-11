const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Disable db singleton when app is running to avoid file locks during tests
process.env.DB_SINGLETON = process.env.DB_SINGLETON || 'false';

const {
  TABLES,
  ACTIONS,
  runQuery,
  getQuery,
  allQuery,
  logAudit,
  initializeDatabase,
  withDb,
} = require('./db');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'wosmap-secret';
const BCRYPT_ROUNDS = 10;
const USER_MANAGEMENT_ROLES = ['admin', 'moderator'];
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

// Trust proxy (fixes rate-limit IP detection when X-Forwarded-For is present)
// Always enabled to avoid ERR_ERL_UNEXPECTED_X_FORWARDED_FOR in diverse setups.
app.set('trust proxy', 1);

// Security headers
app.use(helmet());
// CORS (restrict by default; allow overriding via env)
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || null;
if (ALLOW_ORIGIN) {
  app.use(
    cors({
      origin: ALLOW_ORIGIN,
      credentials: true,
    })
  );
}
// Compression for better performance
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(PUBLIC_DIR));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

initializeDatabase();

// During Jest tests on Windows, unlinking the DB file can fail if the
// connection remains open. Register a test-only cleanup to close it.
// Note: DB connections are opened per-operation in db.js when DB_SINGLETON=false

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

// Basic validators (avoid extra deps)
function isHexColor(v) {
  return typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}
function isInt(v) {
  return Number.isInteger(Number(v));
}
function isNumberLike(v) {
  return v === null || v === undefined || (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
}
function validateCityPayload(body) {
  const { id, name, level, status, x, y, px, py, notes, color } = body;
  if (!id || typeof id !== 'string') return 'Invalid id';
  if (!name || typeof name !== 'string' || name.length > 100) return 'Invalid name';
  if (level !== undefined && !isInt(level)) return 'Invalid level';
  if (!['occupied', 'reserved'].includes(status)) return 'Invalid status';
  if (!isInt(x) || !isInt(y)) return 'Invalid coordinates';
  if (!(px === undefined || px === null || isNumberLike(px))) return 'Invalid px';
  if (!(py === undefined || py === null || isNumberLike(py))) return 'Invalid py';
  if (color !== undefined && color !== null && !isHexColor(color)) return 'Invalid color';
  if (notes !== undefined && notes !== null && typeof notes !== 'string') return 'Invalid notes';
  return null;
}

// Helpers
function isInsideTrapCell(x, y) {
  // traps are 2x2 starting at (trap.x, trap.y)
  const traps = allQuery(`SELECT x, y FROM ${TABLES.TRAPS}`);
  return traps.some((t) => x >= t.x && x <= t.x + 1 && y >= t.y && y <= t.y + 1);
}
function validateTrapPayload(body) {
  const { id, slot, x, y, color, notes } = body;
  if (!id || typeof id !== 'string') return 'Invalid id';
  if (!isInt(slot) || ![1,2,3].includes(Number(slot))) return 'Invalid slot';
  if (!isInt(x) || !isInt(y)) return 'Invalid coordinates';
  if (color !== undefined && !isHexColor(color)) return 'Invalid color';
  if (notes !== undefined && typeof notes !== 'string') return 'Invalid notes';
  return null;
}
function validateUserPayload(body, { allowEmptyPassword = false } = {}) {
  const { id, username, password, role } = body;
  if (!id || typeof id !== 'string') return 'Invalid id';
  if (!username || typeof username !== 'string' || username.length > 50) return 'Invalid username';
  if (!allowEmptyPassword) {
    if (!password || typeof password !== 'string' || password.length < 2)
      return 'Invalid password (min 2 chars)';
  }
  if (!role || !['viewer', 'moderator', 'admin'].includes(role)) return 'Invalid role';
  return null;
}

// Rate limit login to mitigate brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication routes
app.post('/api/login', loginLimiter, (req, res) => {
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
    if (!isInt(level) || !isHexColor(color)) {
      return res.status(400).json({ error: 'Invalid level or color' });
    }
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
    const { id, name, level, status, x, y, px, py, notes, color } = req.body;
    const validationError = validateCityPayload({ id, name, level, status, x, y, px, py, notes, color });
    if (validationError) return res.status(400).json({ error: validationError });

    if (isInsideTrapCell(Number(x), Number(y))) {
      return res.status(400).json({ error: 'Cannot place a city on a bear trap area' });
    }

    const levelEntry = getQuery(
      `SELECT color FROM ${TABLES.LEVELS} WHERE level = ?`,
      [level]
    );
    const finalColor = color || (levelEntry ? levelEntry.color : undefined);

    // Allow multiple cities to share same tile; client enforces visual non-overlap

    runQuery(
      `INSERT OR REPLACE INTO ${TABLES.CITIES} (id, name, level, status, x, y, px, py, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, level, status, x, y, px ?? null, py ?? null, notes, finalColor]
    );

    const actor = req.session?.user?.username || 'system';
    logAudit(TABLES.CITIES, ACTIONS.CREATE, id, {
      user: actor,
      details: `${actor} city create (${x}, ${y}) ${name}`,
    });
    return res.json({ id, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/cities/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, level, status, x, y, px, py, notes, color } = req.body;
    const validationError = validateCityPayload({ id, name, level, status, x, y, px, py, notes, color });
    if (validationError) return res.status(400).json({ error: validationError });

    const levelEntry = getQuery(
      `SELECT color FROM ${TABLES.LEVELS} WHERE level = ?`,
      [level]
    );
    const finalColor = color || (levelEntry ? levelEntry.color : undefined);

    // Allow multiple cities to share same tile; client enforces visual non-overlap

    if (isInsideTrapCell(Number(x), Number(y))) {
      return res.status(400).json({ error: 'Cannot place a city on a bear trap area' });
    }

    // Capture existing for diffing
    const existing = getQuery(
      `SELECT name, level, status, x, y, px, py, notes, color FROM ${TABLES.CITIES} WHERE id = ?`,
      [id]
    );
    const result = runQuery(
      `UPDATE ${TABLES.CITIES} SET name = ?, level = ?, status = ?, x = ?, y = ?, px = ?, py = ?, notes = ?, color = ? WHERE id = ?`,
      [name, level, status, x, y, px ?? null, py ?? null, notes, finalColor, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    const actor = req.session?.user?.username || 'system';
    // Build a concise change summary
    const changes = [];
    if (existing) {
      if (existing.name !== name) changes.push('change name');
      if (existing.status !== status) changes.push(`status ${existing.status}->${status}`);
      if (existing.level !== level) changes.push(`level ${existing.level ?? ''}->${level ?? ''}`.trim());
      if (existing.x !== x || existing.y !== y) changes.push(`move (${existing.x},${existing.y})->(${x},${y})`);
      if (existing.px !== px || existing.py !== py) changes.push(`abs-pos ${existing.px ?? ''},${existing.py ?? ''}->${px ?? ''},${py ?? ''}`);
    }
    const summary = changes.length ? changes.join(', ') : 'update';
    logAudit(TABLES.CITIES, ACTIONS.UPDATE, id, {
      user: actor,
      details: `${actor} city update (${x}, ${y}) ${summary} ${name}`.trim(),
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cities/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const existing = getQuery(`SELECT name, x, y FROM ${TABLES.CITIES} WHERE id = ?`, [id]);
    const result = runQuery(`DELETE FROM ${TABLES.CITIES} WHERE id = ?`, [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    const actor = req.session?.user?.username || 'system';
    logAudit(TABLES.CITIES, ACTIONS.DELETE, id, {
      user: actor,
      details: existing
        ? `${actor} city deleted (${existing.x}, ${existing.y}) ${existing.name}`
        : `${actor} city deleted`,
    });
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
    const validationError = validateTrapPayload({ id, slot, x, y, color, notes });
    if (validationError) return res.status(400).json({ error: validationError });
    runQuery(
      `INSERT OR REPLACE INTO ${TABLES.TRAPS} (id, slot, x, y, color, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, slot, x, y, color, notes]
    );
    const actor = req.session?.user?.username || 'system';
    logAudit(TABLES.TRAPS, ACTIONS.CREATE, id, {
      user: actor,
      details: `${actor} trap create (${x}, ${y}) slot ${slot}`,
    });
    return res.json({ id, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/traps/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { slot, x, y, color, notes } = req.body;
    const validationError = validateTrapPayload({ id, slot, x, y, color, notes });
    if (validationError) return res.status(400).json({ error: validationError });
    const result = runQuery(
      `UPDATE ${TABLES.TRAPS} SET slot = ?, x = ?, y = ?, color = ?, notes = ? WHERE id = ?`,
      [slot, x, y, color, notes, id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trap not found' });
    }
    const actor = req.session?.user?.username || 'system';
    logAudit(TABLES.TRAPS, ACTIONS.UPDATE, id, {
      user: actor,
      details: `${actor} trap update (${x}, ${y}) slot ${slot}`,
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/traps/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = getQuery(`SELECT slot, x, y FROM ${TABLES.TRAPS} WHERE id = ?`, [id]);
    const result = runQuery(`DELETE FROM ${TABLES.TRAPS} WHERE id = ?`, [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Trap not found' });
    }
    const actor = req.session?.user?.username || 'system';
    logAudit(TABLES.TRAPS, ACTIONS.DELETE, id, {
      user: actor,
      details: existing
        ? `${actor} trap deleted (${existing.x}, ${existing.y}) slot ${existing.slot}`
        : `${actor} trap deleted`,
    });
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
      const validationError = validateUserPayload({ id, username, password, role });
      if (validationError) return res.status(400).json({ error: validationError });
      const hashedPassword = bcrypt.hashSync(password, BCRYPT_ROUNDS);
      runQuery(
        `INSERT OR REPLACE INTO ${TABLES.USERS} (id, username, password, role) VALUES (?, ?, ?, ?)`,
        [id, username, hashedPassword, role]
      );
      const actor = req.session?.user?.username || 'system';
      logAudit(TABLES.USERS, ACTIONS.CREATE, id, {
        user: actor,
        details: `${actor} user create ${username}`,
      });
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
      if (password) {
        const validationError = validateUserPayload({ id, username, password, role });
        if (validationError) return res.status(400).json({ error: validationError });
      } else {
        const validationError = validateUserPayload({ id, username, password: 'stub', role }, { allowEmptyPassword: true });
        if (validationError) return res.status(400).json({ error: validationError });
      }
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
      const actor = req.session?.user?.username || 'system';
      logAudit(TABLES.USERS, ACTIONS.UPDATE, id, {
        user: actor,
        details: `${actor} user update ${username}`,
      });
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

      const actor = req.session?.user?.username || 'system';
      logAudit(TABLES.USERS, ACTIONS.DELETE, id, {
        user: actor,
        details: `${actor} user deleted ${id}`,
      });
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

    // Use a single connection + transaction for batch insert
    withDb((d) => {
      d.prepare(`DELETE FROM ${TABLES.CITIES}`).run();
      d.prepare(`DELETE FROM ${TABLES.TRAPS}`).run();

      const insertCity = d.prepare(
        `INSERT INTO ${TABLES.CITIES} (id, name, level, status, x, y, px, py, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertTrap = d.prepare(
        `INSERT INTO ${TABLES.TRAPS} (id, slot, x, y, color, notes) VALUES (?, ?, ?, ?, ?, ?)`
      );

      const transaction = d.transaction(() => {
        for (const city of cities) {
          insertCity.run(
            city.id,
            city.name,
            city.level,
            city.status,
            city.x,
            city.y,
            city.px ?? null,
            city.py ?? null,
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
    });
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

