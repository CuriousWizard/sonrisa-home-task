import type { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/api/health', async function () {
    return { status: 'ok' };
  });
}
