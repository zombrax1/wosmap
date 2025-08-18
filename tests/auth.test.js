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
  test('login accepts form data', async () => {
    await request(app)
      .post('/api/login')
      .type('form')
      .send(ADMIN_CREDENTIALS)
      .expect(200);
  });

  test('viewer cannot add users', async () => {
    const adminLogin = await request(app)
      .post('/api/login')
      .send(ADMIN_CREDENTIALS);
    const adminCookie = adminLogin.headers['set-cookie'];

    await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        id: 'viewer1',
        username: 'viewer1',
        password: 'pw',
        role: 'viewer',
      })
      .expect(200);

    const viewerLogin = await request(app)
      .post('/api/login')
      .type('form')
      .send({ username: 'viewer1', password: 'pw' });
    const viewerCookie = viewerLogin.headers['set-cookie'];

    await request(app)
      .post('/api/users')
      .set('Cookie', viewerCookie)
      .send({ id: 'u2', username: 'u2', password: 'pw', role: 'viewer' })
      .expect(403);
  });

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
