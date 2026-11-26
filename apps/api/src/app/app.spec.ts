import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { app } from './app';

describe('GET /api/health', () => {
  let server: FastifyInstance;

  beforeEach(() => {
    server = Fastify();
    server.register(app);
  });

  afterEach(async () => {
    await server.close();
  });

  it('responds with status ok', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
