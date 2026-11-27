import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  AlertInput,
  IdParam,
  PatchEnabled,
  type AlertDto,
} from '@alerts/shared';
import { currentUser, requireUser } from '../auth/guards';
import type { Db } from '../db/client';
import { alerts, alertTargets, targets } from '../db/schema';
import { HttpError } from '../http-error';

type AlertRow = typeof alerts.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function toAlertDto(row: AlertRow, targetIds: string[]): AlertDto {
  // The routes validated category and filters together, which the column types cannot express.
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    filters: row.filters,
    minSeverity: row.minSeverity,
    enabled: row.enabled,
    targetIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as AlertDto;
}

async function targetIdsByAlert(
  db: Db,
  alertIds: string[],
): Promise<Map<string, string[]>> {
  const byAlert = new Map(alertIds.map((id) => [id, [] as string[]]));
  if (alertIds.length === 0) {
    return byAlert;
  }
  const rows = await db
    .select()
    .from(alertTargets)
    .where(inArray(alertTargets.alertId, alertIds));
  for (const row of rows) {
    byAlert.get(row.alertId)?.push(row.targetId);
  }
  return byAlert;
}

export async function listAlerts(db: Db, userId: string): Promise<AlertDto[]> {
  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt));
  const targetIds = await targetIdsByAlert(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toAlertDto(row, targetIds.get(row.id) ?? []));
}

async function assertOwnTargets(
  tx: Tx,
  userId: string,
  targetIds: string[],
): Promise<void> {
  // The lock makes a concurrent target delete either wait for this transaction or finish first and fail the check.
  const owned = await tx
    .select({ id: targets.id })
    .from(targets)
    .where(and(eq(targets.userId, userId), inArray(targets.id, targetIds)))
    .for('key share');
  // AlertInput rejects repeated ids, so the counts compare.
  if (owned.length !== targetIds.length) {
    throw new HttpError(400, 'targetIds: every target must be one of yours');
  }
}

async function linkTargets(
  tx: Tx,
  alertId: string,
  targetIds: string[],
): Promise<void> {
  await tx
    .insert(alertTargets)
    .values(targetIds.map((targetId) => ({ alertId, targetId })));
}

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireUser);

  app.get('/', async (request) =>
    listAlerts(app.db, currentUser(request).id),
  );

  app.post('/', async (request, reply) => {
    const user = currentUser(request);
    const { targetIds, ...fields } = AlertInput.parse(request.body);
    const row = await app.db.transaction(async (tx) => {
      await assertOwnTargets(tx, user.id, targetIds);
      const [alert] = await tx
        .insert(alerts)
        .values({ ...fields, userId: user.id })
        .returning();
      await linkTargets(tx, alert.id, targetIds);
      return alert;
    });
    reply.code(201);
    return toAlertDto(row, targetIds);
  });

  app.get('/:id', async (request) => {
    const user = currentUser(request);
    const { id } = IdParam.parse(request.params);
    const [row] = await app.db
      .select()
      .from(alerts)
      .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)))
      .limit(1);
    if (!row) {
      throw new HttpError(404, 'Alert not found');
    }
    const targetIds = await targetIdsByAlert(app.db, [row.id]);
    return toAlertDto(row, targetIds.get(row.id) ?? []);
  });

  app.put('/:id', async (request) => {
    const user = currentUser(request);
    const { id } = IdParam.parse(request.params);
    const { targetIds, ...fields } = AlertInput.parse(request.body);
    const row = await app.db.transaction(async (tx) => {
      // The schema's $onUpdate sets updated_at.
      const [alert] = await tx
        .update(alerts)
        .set(fields)
        .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)))
        .returning();
      if (!alert) {
        throw new HttpError(404, 'Alert not found');
      }
      await assertOwnTargets(tx, user.id, targetIds);
      await tx.delete(alertTargets).where(eq(alertTargets.alertId, id));
      await linkTargets(tx, id, targetIds);
      return alert;
    });
    return toAlertDto(row, targetIds);
  });

  app.patch('/:id', async (request) => {
    const user = currentUser(request);
    const { id } = IdParam.parse(request.params);
    const { enabled } = PatchEnabled.parse(request.body);
    const [row] = await app.db
      .update(alerts)
      .set({ enabled })
      .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)))
      .returning();
    if (!row) {
      throw new HttpError(404, 'Alert not found');
    }
    const targetIds = await targetIdsByAlert(app.db, [row.id]);
    return toAlertDto(row, targetIds.get(row.id) ?? []);
  });

  app.delete('/:id', async (request, reply) => {
    const user = currentUser(request);
    const { id } = IdParam.parse(request.params);
    const deleted = await app.db
      .delete(alerts)
      .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)))
      .returning({ id: alerts.id });
    if (deleted.length === 0) {
      throw new HttpError(404, 'Alert not found');
    }
    return reply.code(204).send();
  });
}
