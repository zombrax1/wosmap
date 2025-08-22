const request = require('supertest');
const fs = require('fs');

const TEST_DB = 'levels-test.db';
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

describe('Level color API', () => {
  test('should get and update level colors', async () => {
    const res = await request(app).get('/api/levels').expect(200);
    expect(res.body.length).toBe(5);
    const level1Color = res.body.find(l => l.level === 1).color;

    const login = await request(app).post('/api/login').send(ADMIN);
    const cookie = login.headers['set-cookie'];

    await request(app)
      .post('/api/cities')
      .set('Cookie', cookie)
      .send({ id: 'c1', name: 'City1', level: 1, status: 'occupied', x: 0, y: 0, notes: '', color: level1Color })
      .expect(200);

    await request(app)
      .post('/api/levels')
      .set('Cookie', cookie)
      .send({ level: 1, color: '#123456' })
      .expect(200);

    const citiesRes = await request(app).get('/api/cities').expect(200);
    expect(citiesRes.body[0].color).toBe('#123456');
  });
});
