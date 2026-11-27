import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  EventInput,
  HookIdParam,
  MockSlackMessage,
  MockSlackMode,
  type DevEventResult,
  type EventDto,
} from '@alerts/shared';
import { ingestEvent, type EventRow } from '../events/ingest';
import { HttpError } from '../http-error';

export const MOCK_SLACK_MAX_MESSAGES = 500;

interface ReceivedSlackMessage {
  hookId: string;
  text: string;
  receivedAt: string;
}

function toEventDto(row: EventRow): EventDto {
  // Ingest validated category and data together, which the column types cannot express.
  return {
    id: row.id,
    sourceId: row.sourceId,
    category: row.category,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    data: row.data,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  } as EventDto;
}

// buildApp registers these only outside production, so they need no login.
export async function devRoutes(app: FastifyInstance): Promise<void> {
  // Newest first. Each app instance has its own store.
  const slackMessages: ReceivedSlackMessage[] = [];
  let slackFails = false;

  app.post('/events', async (request, reply): Promise<DevEventResult> => {
    const input = EventInput.parse(request.body);
    const result = await ingestEvent(app.db, {
      ...input,
      sourceId: 'dev',
      externalId: randomUUID(),
    });
    if (!result) {
      throw new HttpError(409, 'Event already exists');
    }
    reply.code(201);
    return {
      event: toEventDto(result.event),
      deliveriesCreated: result.deliveriesCreated,
    };
  });

  app.post('/mock-slack/:hookId', async (request, reply) => {
    const { hookId } = HookIdParam.parse(request.params);
    const { text } = MockSlackMessage.parse(request.body);
    slackMessages.unshift({
      hookId,
      text,
      receivedAt: new Date().toISOString(),
    });
    slackMessages.splice(MOCK_SLACK_MAX_MESSAGES);
    if (slackFails) {
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Mock Slack fail mode is on',
      });
    }
    // Slack answers a successful webhook call with the plain text "ok".
    return 'ok';
  });

  app.get('/mock-slack/messages', async () => slackMessages);

  app.delete('/mock-slack/messages', async (_request, reply) => {
    slackMessages.length = 0;
    return reply.code(204).send();
  });

  app.put('/mock-slack/mode', async (request) => {
    const { fail } = MockSlackMode.parse(request.body);
    slackFails = fail;
    return { fail };
  });
}
