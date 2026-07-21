import { Router } from 'express';
import { z } from 'zod';
import { q, exec } from '../db.js';
import { activityDto } from '../serialize.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { requireMember, requireEditor } from '../access.js';
import { broadcastToKit } from '../realtime.js';
import { ah, id, now } from '../util.js';

type ActivityRow = Parameters<typeof activityDto>[0];

/** Insert an activity event and notify connected kit members. */
export async function logActivity(
  kitId: string, userId: string, userName: string, type: string,
  extra?: { medicineId?: string; medicineName?: string; detail?: string },
): Promise<void> {
  const row: ActivityRow = {
    id: id('act'),
    kit_id: kitId,
    user_id: userId,
    user_name: userName,
    type,
    medicine_id: extra?.medicineId ?? null,
    medicine_name: extra?.medicineName ?? null,
    detail: extra?.detail ?? null,
    created_at: now(),
  };
  await exec(
    `INSERT INTO activity (id, kit_id, user_id, user_name, type, medicine_id, medicine_name, detail, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [row.id, row.kit_id, row.user_id, row.user_name, row.type, row.medicine_id, row.medicine_name, row.detail, row.created_at],
  );
  broadcastToKit(kitId, { type: 'activity', kitId, event: activityDto(row) });
}

export const activityRouter = Router();
activityRouter.use(requireAuth);

// GET /api/kits/:kitId/activity
activityRouter.get('/:kitId/activity', ah(async (req: AuthedRequest, res) => {
  await requireMember(req.params.kitId, req.user!.id);
  const rows = await q<ActivityRow>(
    'SELECT * FROM activity WHERE kit_id = $1 ORDER BY created_at DESC LIMIT 100', [req.params.kitId],
  );
  res.json({ events: rows.map(activityDto) });
}));

const logSchema = z.object({
  type: z.string().min(1),
  medicineId: z.string().optional(),
  medicineName: z.string().optional(),
  detail: z.string().optional(),
});

// POST /api/kits/:kitId/activity
activityRouter.post('/:kitId/activity', ah(async (req: AuthedRequest, res) => {
  await requireEditor(req.params.kitId, req.user!.id);
  const body = logSchema.parse(req.body);
  await logActivity(req.params.kitId, req.user!.id, req.user!.name, body.type, body);
  res.status(201).json({ ok: true });
}));
