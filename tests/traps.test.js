const request = require('supertest');
const fs = require('fs');

const TEST_DB = 'traps-test.db';
const ADMIN = { username: 'admin', password: 'admin' };
let app;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
  process.env.DB_PATH = TEST_DB;
  app = require('../server');
});

afterAll(() => {
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
});

describe('Trap API', () => {
  test('public GET and auth-required mutations', async () => {
    await request(app).get('/api/traps').expect(200);
    await request(app).post('/api/traps').send({}).expect(401);

    const login = await request(app)
      .post('/api/login')
      .send(ADMIN);
    const cookie = login.headers['set-cookie'];

    const payload = { id: 't1', slot: 1, x: 0, y: 0, color: '#f59e0b' };
    await request(app)
      .post('/api/traps')
      .set('Cookie', cookie)
      .send(payload)
      .expect(200);

    const trapsRes = await request(app).get('/api/traps').expect(200);
    expect(trapsRes.body.length).toBe(1);

    await request(app)
      .delete('/api/traps/t1')
      .set('Cookie', cookie)
      .expect(200);
  });
});

describe('Snapshot ETag', () => {
  test('returns 304 when data unchanged', async () => {
    const res1 = await request(app).get('/api/snapshot').expect(200);
    const etag = res1.headers['etag'];
    await request(app)
      .get('/api/snapshot')
      .set('If-None-Match', etag)
      .expect(304);
  });
});
