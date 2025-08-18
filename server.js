const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new Database('wos.db');

// Create cities table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER,
    status TEXT NOT NULL DEFAULT 'occupied',
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    notes TEXT,
    color TEXT DEFAULT '#ec4899'
  )
`);

// API Routes
app.get('/api/cities', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM cities ORDER BY name');
    const cities = stmt.all();
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cities', (req, res) => {
  try {
    const { id, name, level, status, x, y, notes, color } = req.body;
    
    // Check for existing city at coordinates
    const existing = db.prepare('SELECT * FROM cities WHERE x = ? AND y = ? AND id != ?').get(x, y, id);
    if (existing) {
      return res.status(400).json({ error: `Tile (${x}, ${y}) already has ${existing.name}. Delete or move it first.` });
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO cities (id, name, level, status, x, y, notes, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(id, name, level, status, x, y, notes, color);
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
    const existing = db.prepare('SELECT * FROM cities WHERE x = ? AND y = ? AND id != ?').get(x, y, id);
    if (existing) {
      return res.status(400).json({ error: `Tile (${x}, ${y}) already has ${existing.name}. Delete or move it first.` });
    }

    const stmt = db.prepare(`
      UPDATE cities 
      SET name = ?, level = ?, status = ?, x = ?, y = ?, notes = ?, color = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(name, level, status, x, y, notes, color, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cities/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM cities WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export all cities as JSON
app.get('/api/export', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM cities ORDER BY name');
    const cities = stmt.all();
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
    db.prepare('DELETE FROM cities').run();
    
    // Insert new data
    const insertStmt = db.prepare(`
      INSERT INTO cities (id, name, level, status, x, y, notes, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
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
