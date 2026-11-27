import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  IdParam,
  ListQuery,
  TargetInput,
  type TargetDto,
  type TargetTestResult,
} from '@alerts/shared';
import { currentUser, requireUser } from '../auth/guards';
import { channelById, sendThroughChannel } from '../channels/registry';
import type { Config } from '../config';
import { alertTargets, channels, targets } from '../db/schema';
import { buildTestMessage } from '../delivery/message';
import { HttpError } from '../http-error';

type TargetRow = typeof targets.$inferSelect;

function toTargetDto(row: TargetRow): TargetDto {
  // The create route validated channel and config together, which the column types cannot express.
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    config: row.config,
    createdAt: row.createdAt.toISOString(),
  } as TargetDto;
}

export async function targetRoutes(
  app: FastifyInstance,
  options: { config: Config },
): Promise<void> {
  // The test route sends mail or Slack posts at once, so it gets the auth routes' per-IP limit.
  const rateLimit = {
    max: options.config.AUTH_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  };

  app.addHook('preHandler', requireUser);

  app.get('/', async (request) => {
    const user = currentUser(request);
    const { limit } = ListQuery.parse(request.query);
    const rows = await app.db
      .select()
      .from(targets)
      .where(eq(targets.userId, user.id))
      .orderBy(desc(targets.createdAt))
      .limit(limit);
    return rows.map(toTargetDto);
  });

  app.post('/', async (request, reply) => {
    const user = currentUser(request);
    const input = TargetInput.parse(request.body);
    try {
      channelById(app.channels, input.channel).assertConfigAllowed?.(
        input.config,
      );
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : 'Target config is not allowed',
      );
    }
    const [row] = await app.db
      .insert(targets)
      .values({
        userId: user.id,
        name: input.name,
        channel: input.channel,
        config: input.config,
      })
      .returning();
    reply.code(201);
    return toTargetDto(row);
  });

  app.delete('/:id', async (request, reply) => {
    const user = currentUser(request);
    const { id } = IdParam.parse(request.params);
    await app.db.transaction(async (tx) => {
      // The row lock makes a concurrent alert insert wait, so the usage check below sees it.
      const [target] = await tx
        .select({ id: targets.id })
        .from(targets)
        .where(and(eq(targets.id, id), eq(targets.userId, user.id)))
        .for('update');
      if (!target) {
        throw new HttpError(404, 'Target not found');
      }
      const [link] = await tx
        .select({ alertId: alertTargets.alertId })
        .from(alertTargets)
        .where(eq(alertTargets.targetId, id))
        .limit(1);
      if (link) {
        throw new HttpError(409, 'An alert still uses this target');
      }
      await tx.delete(targets).where(eq(targets.id, id));
    });
    return reply.code(204).send();
  });

  app.post(
    '/:id/test',
    { config: { rateLimit } },
    async (request): Promise<TargetTestResult> => {
      const user = currentUser(request);
      const { id } = IdParam.parse(request.params);
      const [target] = await app.db
        .select()
        .from(targets)
        .where(and(eq(targets.id, id), eq(targets.userId, user.id)))
        .limit(1);
      if (!target) {
        throw new HttpError(404, 'Target not found');
      }
      const [channel] = await app.db
        .select({ enabled: channels.enabled })
        .from(channels)
        .where(eq(channels.id, target.channel))
        .limit(1);
      if (!channel?.enabled) {
        throw new HttpError(409, 'Channel is disabled');
      }
      try {
        await sendThroughChannel(
          app.channels,
          target,
          buildTestMessage(target.name),
        );
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Send failed',
        };
      }
    },
  );
}
