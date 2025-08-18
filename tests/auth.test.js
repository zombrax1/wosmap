const request = require('supertest');
const fs = require('fs');

const TEST_DB = 'auth-test.db';
const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin' };

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

describe('Authentication and user permissions', () => {
  test('admin can delete a user', async () => {
    const loginRes = await request(app)
      .post('/api/login')
      .send(ADMIN_CREDENTIALS);
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers['set-cookie'];

    await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({ id: 'u1', username: 'user1', password: 'pw', role: 'viewer' })
      .expect(200);

    await request(app)
      .delete('/api/users/u1')
      .set('Cookie', cookie)
      .expect(200);

    const usersRes = await request(app)
      .get('/api/users')
      .set('Cookie', cookie)
      .expect(200);
    expect(usersRes.body.find((u) => u.id === 'u1')).toBeUndefined();
  });
});
