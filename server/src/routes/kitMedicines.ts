import { Router } from 'express';
import { z } from 'zod';
import { q, q1, exec } from '../db.js';
import { medicineDto, type MedicineRow } from '../serialize.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { requireMember, requireEditor } from '../access.js';
import { broadcastToKit } from '../realtime.js';
import { ah, now, HttpError } from '../util.js';
import { logActivity } from './activity.js';

export const kitMedicinesRouter = Router();
kitMedicinesRouter.use(requireAuth);

const compositionSchema = z.array(z.object({ name: z.string(), amount: z.string().optional() }));

// Full medicine payload — client generates the id so entities stay consistent offline.
const medicineSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  manufacturer: z.string().optional(),
  activeIngredient: z.string().optional(),
  dosage: z.string().optional(),
  form: z.string().default('other'),
  composition: compositionSchema.optional(),
  totalQuantity: z.number().default(0),
  remainingQuantity: z.number().default(0),
  startDate: z.string().optional(),
  expirationDate: z.string(),
  storageNotes: z.string().optional(),
  notes: z.string().optional(),
  photoUri: z.string().optional(),
  description: z.string().optional(),
  usageNotes: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  incompatibleWith: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  addedAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// GET /api/kits/:kitId/medicines
kitMedicinesRouter.get('/:kitId/medicines', ah(async (req: AuthedRequest, res) => {
  await requireMember(req.params.kitId, req.user!.id);
  const rows = await q<MedicineRow>(
    'SELECT * FROM kit_medicines WHERE kit_id = $1 ORDER BY added_at ASC', [req.params.kitId],
  );
  res.json({ medicines: rows.map(medicineDto) });
}));

// POST /api/kits/:kitId/medicines  → upsert (create or update) by id
kitMedicinesRouter.post('/:kitId/medicines', ah(async (req: AuthedRequest, res) => {
  await requireEditor(req.params.kitId, req.user!.id);
  const m = medicineSchema.parse(req.body);
  const ts = now();

  const inserted = await q1<{ inserted: boolean }>(
    `INSERT INTO kit_medicines
       (id, kit_id, name, manufacturer, active_ingredient, dosage, form, composition,
        total_quantity, remaining_quantity, start_date, expiration_date, storage_notes,
        notes, photo_uri, description, usage_notes, warnings, incompatible_with, tags,
        added_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, manufacturer = EXCLUDED.manufacturer,
       active_ingredient = EXCLUDED.active_ingredient, dosage = EXCLUDED.dosage,
       form = EXCLUDED.form, composition = EXCLUDED.composition,
       total_quantity = EXCLUDED.total_quantity, remaining_quantity = EXCLUDED.remaining_quantity,
       start_date = EXCLUDED.start_date, expiration_date = EXCLUDED.expiration_date,
       storage_notes = EXCLUDED.storage_notes, notes = EXCLUDED.notes,
       photo_uri = EXCLUDED.photo_uri, description = EXCLUDED.description,
       usage_notes = EXCLUDED.usage_notes, warnings = EXCLUDED.warnings,
       incompatible_with = EXCLUDED.incompatible_with, tags = EXCLUDED.tags,
       updated_at = EXCLUDED.updated_at
     RETURNING (xmax = 0) AS inserted`,
    [
      m.id, req.params.kitId, m.name, m.manufacturer ?? null, m.activeIngredient ?? null,
      m.dosage ?? null, m.form, m.composition ? JSON.stringify(m.composition) : null,
      m.totalQuantity, m.remainingQuantity, m.startDate ?? null, m.expirationDate,
      m.storageNotes ?? null, m.notes ?? null, m.photoUri ?? null, m.description ?? null,
      m.usageNotes ?? null, m.warnings ? JSON.stringify(m.warnings) : null,
      m.incompatibleWith ? JSON.stringify(m.incompatibleWith) : null,
      m.tags ? JSON.stringify(m.tags) : null, m.addedAt ?? ts, m.updatedAt ?? ts,
    ],
  );

  const row = await q1<MedicineRow>('SELECT * FROM kit_medicines WHERE id = $1', [m.id]);
  const dto = medicineDto(row!);
  broadcastToKit(req.params.kitId, { type: 'medicine_upserted', kitId: req.params.kitId, medicine: dto }, req.user!.id);
  if (inserted?.inserted) {
    await logActivity(req.params.kitId, req.user!.id, req.user!.name, 'medicine_added',
      { medicineId: m.id, medicineName: m.name });
  }
  res.status(201).json({ medicine: dto });
}));

// PATCH /api/kits/:kitId/medicines/:medId  → partial update
const patchSchema = medicineSchema.partial().omit({ id: true });

kitMedicinesRouter.patch('/:kitId/medicines/:medId', ah(async (req: AuthedRequest, res) => {
  await requireEditor(req.params.kitId, req.user!.id);
  const body = patchSchema.parse(req.body);
  const existing = await q1<MedicineRow>('SELECT * FROM kit_medicines WHERE id = $1 AND kit_id = $2',
    [req.params.medId, req.params.kitId]);
  if (!existing) throw new HttpError(404, 'Medicine not found');

  const colMap: Record<string, string> = {
    name: 'name', manufacturer: 'manufacturer', activeIngredient: 'active_ingredient',
    dosage: 'dosage', form: 'form', composition: 'composition',
    totalQuantity: 'total_quantity', remainingQuantity: 'remaining_quantity',
    startDate: 'start_date', expirationDate: 'expiration_date', storageNotes: 'storage_notes',
    notes: 'notes', photoUri: 'photo_uri', description: 'description', usageNotes: 'usage_notes',
    warnings: 'warnings', incompatibleWith: 'incompatible_with', tags: 'tags',
  };
  const jsonCols = new Set(['composition', 'warnings', 'incompatible_with', 'tags']);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (!(key in body)) continue;
    const value = (body as Record<string, unknown>)[key];
    params.push(jsonCols.has(col) && value != null ? JSON.stringify(value) : value ?? null);
    sets.push(`${col} = $${params.length}`);
  }
  params.push(now());
  sets.push(`updated_at = $${params.length}`);
  params.push(req.params.medId);
  await exec(`UPDATE kit_medicines SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

  const row = await q1<MedicineRow>('SELECT * FROM kit_medicines WHERE id = $1', [req.params.medId]);
  const dto = medicineDto(row!);
  broadcastToKit(req.params.kitId, { type: 'medicine_upserted', kitId: req.params.kitId, medicine: dto }, req.user!.id);
  res.json({ medicine: dto });
}));

// DELETE /api/kits/:kitId/medicines/:medId
kitMedicinesRouter.delete('/:kitId/medicines/:medId', ah(async (req: AuthedRequest, res) => {
  await requireEditor(req.params.kitId, req.user!.id);
  const existing = await q1<MedicineRow>('SELECT * FROM kit_medicines WHERE id = $1 AND kit_id = $2',
    [req.params.medId, req.params.kitId]);
  if (!existing) { res.json({ ok: true }); return; }
  await exec('DELETE FROM kit_medicines WHERE id = $1', [req.params.medId]);
  broadcastToKit(req.params.kitId, { type: 'medicine_deleted', kitId: req.params.kitId, medicineId: req.params.medId }, req.user!.id);
  await logActivity(req.params.kitId, req.user!.id, req.user!.name, 'medicine_removed',
    { medicineId: req.params.medId, medicineName: existing.name });
  res.json({ ok: true });
}));
