const request = require('supertest');
const app = require('../server');

describe('static file serving', () => {
  test('serves auth helper script', async () => {
    const res = await request(app).get('/js/auth.js');
    expect(res.status).toBe(200);
    expect(res.text).toContain('const Auth');
  });
});
