import { Router } from 'express';
import { q, exec } from '../db.js';
import { notificationDto } from '../serialize.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { pushToUser } from '../realtime.js';
import { ah, id, now } from '../util.js';

type NotifRow = Parameters<typeof notificationDto>[0];

/** Create a notification for a user and push it over the socket. */
export async function notify(
  userId: string, type: string, title: string, body: string,
  extra?: { kitId?: string; medicineId?: string },
): Promise<void> {
  const row: NotifRow = {
    id: id('notif'),
    type,
    title,
    body,
    kit_id: extra?.kitId ?? null,
    medicine_id: extra?.medicineId ?? null,
    is_read: false,
    created_at: now(),
  };
  await exec(
    `INSERT INTO notifications (id, user_id, type, title, body, kit_id, medicine_id, is_read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [row.id, userId, row.type, row.title, row.body, row.kit_id, row.medicine_id, row.is_read, row.created_at],
  );
  pushToUser(userId, { type: 'notification', notification: notificationDto(row) });
}

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', ah(async (req: AuthedRequest, res) => {
  const rows = await q<NotifRow>(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user!.id],
  );
  res.json({ notifications: rows.map(notificationDto) });
}));

notificationsRouter.post('/:notifId/read', ah(async (req: AuthedRequest, res) => {
  await exec('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
    [req.params.notifId, req.user!.id]);
  res.json({ ok: true });
}));

notificationsRouter.post('/read-all', ah(async (req: AuthedRequest, res) => {
  await exec('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user!.id]);
  res.json({ ok: true });
}));

notificationsRouter.delete('/:notifId', ah(async (req: AuthedRequest, res) => {
  await exec('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.notifId, req.user!.id]);
  res.json({ ok: true });
}));
