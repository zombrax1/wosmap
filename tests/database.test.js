const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Test database file
const TEST_DB_PATH = 'test-wos.db';

// Helper function to create a fresh test database
function createTestDB() {
  // Remove existing test database if it exists
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  
  // Create cities table
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
  
  return db;
}

describe('Database CRUD Operations', () => {
  let db;
  
  beforeEach(() => {
    db = createTestDB();
  });
  
  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });
  
  describe('INSERT operations', () => {
    test('should insert a new city successfully', () => {
      const stmt = db.prepare(`
        INSERT INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        'test-1',
        'TestCity',
        25,
        'occupied',
        10,
        15,
        'Test notes',
        '#ff0000'
      );
      
      expect(result.changes).toBe(1);
      
      // Verify the city was inserted
      const city = db.prepare('SELECT * FROM cities WHERE id = ?').get('test-1');
      expect(city).toBeDefined();
      expect(city.name).toBe('TestCity');
      expect(city.level).toBe(25);
      expect(city.status).toBe('occupied');
      expect(city.x).toBe(10);
      expect(city.y).toBe(15);
      expect(city.notes).toBe('Test notes');
      expect(city.color).toBe('#ff0000');
    });
    
    test('should handle INSERT OR REPLACE for existing city', () => {
      // Insert initial city
      const insertStmt = db.prepare(`
        INSERT INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run('test-2', 'OriginalCity', 10, 'reserved', 5, 5, 'Original notes', '#00ff00');
      
      // Replace with new data
      const replaceStmt = db.prepare(`
        INSERT OR REPLACE INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = replaceStmt.run('test-2', 'UpdatedCity', 20, 'occupied', 10, 10, 'Updated notes', '#0000ff');
      
      expect(result.changes).toBe(1);
      
      // Verify the city was updated
      const city = db.prepare('SELECT * FROM cities WHERE id = ?').get('test-2');
      expect(city.name).toBe('UpdatedCity');
      expect(city.level).toBe(20);
      expect(city.status).toBe('occupied');
      expect(city.x).toBe(10);
      expect(city.y).toBe(10);
    });
  });
  
  describe('SELECT operations', () => {
    beforeEach(() => {
      // Insert test data
      const stmt = db.prepare(`
        INSERT INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run('test-1', 'City1', 10, 'occupied', 0, 0, 'Notes 1', '#ff0000');
      stmt.run('test-2', 'City2', 20, 'reserved', 1, 1, 'Notes 2', '#00ff00');
      stmt.run('test-3', 'City3', 30, 'occupied', 2, 2, 'Notes 3', '#0000ff');
    });
    
    test('should select all cities ordered by name', () => {
      const stmt = db.prepare('SELECT * FROM cities ORDER BY name');
      const cities = stmt.all();
      
      expect(cities).toHaveLength(3);
      expect(cities[0].name).toBe('City1');
      expect(cities[1].name).toBe('City2');
      expect(cities[2].name).toBe('City3');
    });
    
    test('should select city by coordinates', () => {
      const stmt = db.prepare('SELECT * FROM cities WHERE x = ? AND y = ?');
      const city = stmt.get(1, 1);
      
      expect(city).toBeDefined();
      expect(city.name).toBe('City2');
      expect(city.status).toBe('reserved');
    });
    
    test('should select cities by status', () => {
      const stmt = db.prepare('SELECT * FROM cities WHERE status = ?');
      const occupiedCities = stmt.all('occupied');
      const reservedCities = stmt.all('reserved');
      
      expect(occupiedCities).toHaveLength(2);
      expect(reservedCities).toHaveLength(1);
    });
  });
  
  describe('UPDATE operations', () => {
    beforeEach(() => {
      const stmt = db.prepare(`
        INSERT INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run('test-1', 'OriginalCity', 10, 'occupied', 0, 0, 'Original notes', '#ff0000');
    });
    
    test('should update city successfully', () => {
      const stmt = db.prepare(`
        UPDATE cities 
        SET name = ?, level = ?, status = ?, x = ?, y = ?, notes = ?, color = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(
        'UpdatedCity',
        25,
        'reserved',
        5,
        5,
        'Updated notes',
        '#00ff00',
        'test-1'
      );
      
      expect(result.changes).toBe(1);
      
      // Verify the update
      const city = db.prepare('SELECT * FROM cities WHERE id = ?').get('test-1');
      expect(city.name).toBe('UpdatedCity');
      expect(city.level).toBe(25);
      expect(city.status).toBe('reserved');
      expect(city.x).toBe(5);
      expect(city.y).toBe(5);
    });
    
    test('should return 0 changes for non-existent city', () => {
      const stmt = db.prepare(`
        UPDATE cities 
        SET name = ?
        WHERE id = ?
      `);
      
      const result = stmt.run('NewName', 'non-existent-id');
      
      expect(result.changes).toBe(0);
    });
  });
  
  describe('DELETE operations', () => {
    beforeEach(() => {
      const stmt = db.prepare(`
        INSERT INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run('test-1', 'City1', 10, 'occupied', 0, 0, 'Notes 1', '#ff0000');
      stmt.run('test-2', 'City2', 20, 'reserved', 1, 1, 'Notes 2', '#00ff00');
    });
    
    test('should delete city by id', () => {
      const stmt = db.prepare('DELETE FROM cities WHERE id = ?');
      const result = stmt.run('test-1');
      
      expect(result.changes).toBe(1);
      
      // Verify deletion
      const city = db.prepare('SELECT * FROM cities WHERE id = ?').get('test-1');
      expect(city).toBeUndefined();
      
      // Verify other city still exists
      const remainingCity = db.prepare('SELECT * FROM cities WHERE id = ?').get('test-2');
      expect(remainingCity).toBeDefined();
    });
    
    test('should delete all cities', () => {
      const stmt = db.prepare('DELETE FROM cities');
      const result = stmt.run();
      
      expect(result.changes).toBe(2);
      
      // Verify all cities are deleted
      const cities = db.prepare('SELECT * FROM cities').all();
      expect(cities).toHaveLength(0);
    });
    
    test('should return 0 changes for non-existent city', () => {
      const stmt = db.prepare('DELETE FROM cities WHERE id = ?');
      const result = stmt.run('non-existent-id');
      
      expect(result.changes).toBe(0);
    });
  });
  
  describe('Constraint validation', () => {
    test('should allow multiple cities at same coordinates (application-level constraint)', () => {
      const stmt = db.prepare(`
        INSERT INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Insert first city
      stmt.run('test-1', 'City1', 10, 'occupied', 0, 0, 'Notes 1', '#ff0000');
      
      // Insert another city at the same coordinates (this is allowed at DB level)
      const result = stmt.run('test-2', 'City2', 20, 'reserved', 0, 0, 'Notes 2', '#00ff00');
      
      expect(result.changes).toBe(1);
      
      // Verify both cities exist
      const cities = db.prepare('SELECT * FROM cities').all();
      expect(cities).toHaveLength(2);
    });
    
    test('should handle INSERT OR REPLACE correctly', () => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO cities (id, name, level, status, x, y, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Insert first city
      stmt.run('test-1', 'City1', 10, 'occupied', 0, 0, 'Notes 1', '#ff0000');
      
      // Replace with same ID but different data
      const result = stmt.run('test-1', 'UpdatedCity', 20, 'reserved', 5, 5, 'Updated notes', '#00ff00');
      
      expect(result.changes).toBe(1);
      
      // Verify the city was updated
      const city = db.prepare('SELECT * FROM cities WHERE id = ?').get('test-1');
      expect(city.name).toBe('UpdatedCity');
      expect(city.x).toBe(5);
      expect(city.y).toBe(5);
    });
  });
});
