import { Router } from 'express';
import { q, q1, exec } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { HttpError } from '../util.js';
import { pushToUser } from '../realtime.js';

export const doctorsRouter = Router();

// ─── Community catalog ─────────────────────────────────────────────────────────

interface CatalogRow {
  id: string; name: string; speciality: string;
  phone: string | null; email: string | null;
  address: string | null; city: string | null; country: string | null;
  languages: string[] | null;
  is_free: boolean | null; cost: string | null;
  whatsapp: string | null; telegram: string | null; viber: string | null;
  photo_uri: string | null; experience_years: number | null;
  notes: string | null; contributed_at: string;
}

function toCatalog(r: CatalogRow) {
  return {
    id: r.id, name: r.name, speciality: r.speciality,
    phone:           r.phone           ?? undefined,
    email:           r.email           ?? undefined,
    address:         r.address         ?? undefined,
    city:            r.city            ?? undefined,
    country:         r.country         ?? undefined,
    languages:       r.languages       ?? undefined,
    isFree:          r.is_free         ?? undefined,
    cost:            r.cost            ?? undefined,
    whatsapp:        r.whatsapp        ?? undefined,
    telegram:        r.telegram        ?? undefined,
    viber:           r.viber           ?? undefined,
    photoUri:        r.photo_uri       ?? undefined,
    experienceYears: r.experience_years ?? undefined,
    notes:           r.notes           ?? undefined,
    contributedAt:   r.contributed_at,
  };
}

/** GET /api/doctors/catalog — search shared catalog, no auth required */
doctorsRouter.get('/catalog', async (_req: AuthedRequest, res, next) => {
  try {
    const { q: qParam = '', speciality, city } = _req.query as Record<string, string>;
    const term = `%${qParam}%`;
    const params: unknown[] = [term];
    let sql = 'SELECT * FROM doctors_catalog WHERE search_blob ILIKE $1';
    if (speciality) { params.push(speciality); sql += ` AND speciality = $${params.length}`; }
    if (city) { params.push(`%${city}%`); sql += ` AND (city ILIKE $${params.length} OR search_blob ILIKE $${params.length})`; }
    sql += ' ORDER BY name ASC LIMIT 50';
    const rows = await q<CatalogRow>(sql, params);
    res.json({ doctors: rows.map(toCatalog) });
  } catch (e) { next(e); }
});

// All other routes require auth — doctors are private to the authenticated user.
doctorsRouter.use(requireAuth);

/** POST /api/doctors/catalog — contribute a doctor to the shared catalog */
doctorsRouter.post('/catalog', async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body;
    if (!b.name)      throw new HttpError(400, 'name is required');
    if (!b.speciality) throw new HttpError(400, 'speciality is required');
    const now = new Date().toISOString();
    const catalogId = `dc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const blob = [b.name, b.speciality, b.city, b.country, b.address].filter(Boolean).join(' ');
    await exec(`
      INSERT INTO doctors_catalog (
        id, name, speciality, phone, email, address, city, country,
        languages, is_free, cost, whatsapp, telegram, viber,
        photo_uri, experience_years, notes,
        contributed_by, contributed_at, search_blob
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO NOTHING
    `, [
      catalogId, b.name, b.speciality,
      b.phone ?? null, b.email ?? null,
      b.address ?? null, b.city ?? null, b.country ?? null,
      b.languages ? JSON.stringify(b.languages) : null,
      b.isFree ?? null, b.cost ?? null,
      b.whatsapp ?? null, b.telegram ?? null, b.viber ?? null,
      b.photoUri ?? null,
      b.experienceYears != null ? Number(b.experienceYears) : null,
      b.notes ?? null,
      req.user!.id, now, blob,
    ]);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ─── Row ↔ Doctor mapping ──────────────────────────────────────────────────────

interface DoctorRow {
  id: string; user_id: string;
  name: string; speciality: string;
  phone: string | null; email: string | null;
  address: string | null; city: string | null; country: string | null;
  languages: string[] | null;
  is_free: boolean | null; cost: string | null;
  whatsapp: string | null; telegram: string | null; viber: string | null;
  photo_uri: string | null; experience_years: number | null; notes: string | null;
  created_at: string; updated_at: string;
}

function toDoctor(r: DoctorRow) {
  return {
    id: r.id,
    name: r.name,
    speciality: r.speciality,
    phone:           r.phone            ?? undefined,
    email:           r.email            ?? undefined,
    address:         r.address          ?? undefined,
    city:            r.city             ?? undefined,
    country:         r.country          ?? undefined,
    languages:       r.languages        ?? undefined,
    isFree:          r.is_free          ?? undefined,
    cost:            r.cost             ?? undefined,
    whatsapp:        r.whatsapp         ?? undefined,
    telegram:        r.telegram         ?? undefined,
    viber:           r.viber            ?? undefined,
    photoUri:        r.photo_uri        ?? undefined,
    experienceYears: r.experience_years ?? undefined,
    notes:           r.notes            ?? undefined,
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
  };
}

// ─── GET /api/doctors ──────────────────────────────────────────────────────────

doctorsRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const rows = await q<DoctorRow>(
      'SELECT * FROM doctors WHERE user_id = $1 ORDER BY name ASC',
      [req.user!.id],
    );
    res.json({ doctors: rows.map(toDoctor) });
  } catch (e) { next(e); }
});

// ─── POST /api/doctors ─────────────────────────────────────────────────────────

doctorsRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body;
    if (!b.name)      throw new HttpError(400, 'name is required');
    if (!b.speciality) throw new HttpError(400, 'speciality is required');

    const now = new Date().toISOString();
    const id  = b.id ?? `doc-${Date.now()}`;

    await exec(`
      INSERT INTO doctors (
        id, user_id, name, speciality, phone, email, address, city, country,
        languages, is_free, cost, whatsapp, telegram, viber, photo_uri, experience_years, notes,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (id) DO UPDATE SET
        name=$3, speciality=$4, phone=$5, email=$6, address=$7, city=$8, country=$9,
        languages=$10, is_free=$11, cost=$12, whatsapp=$13, telegram=$14, viber=$15,
        photo_uri=$16, experience_years=$17, notes=$18, updated_at=$20
    `, [
      id, req.user!.id,
      b.name, b.speciality,
      b.phone    ?? null, b.email   ?? null,
      b.address  ?? null, b.city    ?? null, b.country ?? null,
      b.languages ? JSON.stringify(b.languages) : null,
      b.isFree   ?? null, b.cost    ?? null,
      b.whatsapp ?? null, b.telegram ?? null, b.viber ?? null,
      b.photoUri ?? null,
      b.experienceYears != null ? Number(b.experienceYears) : null,
      b.notes   ?? null,
      b.createdAt ?? now, b.updatedAt ?? now,
    ]);

    const row = await q1<DoctorRow>('SELECT * FROM doctors WHERE id = $1', [id]);
    const doctor = toDoctor(row!);
    pushToUser(req.user!.id, { type: 'doctor_upserted', doctor });
    res.status(201).json({ doctor });
  } catch (e) { next(e); }
});

// ─── PATCH /api/doctors/:id ────────────────────────────────────────────────────

doctorsRouter.patch('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await q1<DoctorRow>(
      'SELECT * FROM doctors WHERE id = $1 AND user_id = $2', [id, req.user!.id],
    );
    if (!existing) throw new HttpError(404, 'Doctor not found');

    const b = req.body;
    const now = new Date().toISOString();

    await exec(`
      UPDATE doctors SET
        name=$1, speciality=$2, phone=$3, email=$4, address=$5, city=$6, country=$7,
        languages=$8, is_free=$9, cost=$10, whatsapp=$11, telegram=$12, viber=$13,
        photo_uri=$14, experience_years=$15, notes=$16, updated_at=$17
      WHERE id=$18 AND user_id=$19
    `, [
      b.name       ?? existing.name,
      b.speciality ?? existing.speciality,
      b.phone    !== undefined ? b.phone    : existing.phone,
      b.email    !== undefined ? b.email    : existing.email,
      b.address  !== undefined ? b.address  : existing.address,
      b.city     !== undefined ? b.city     : existing.city,
      b.country  !== undefined ? b.country  : existing.country,
      b.languages !== undefined ? JSON.stringify(b.languages) : existing.languages,
      b.isFree   !== undefined ? b.isFree   : existing.is_free,
      b.cost     !== undefined ? b.cost     : existing.cost,
      b.whatsapp !== undefined ? b.whatsapp : existing.whatsapp,
      b.telegram !== undefined ? b.telegram : existing.telegram,
      b.viber    !== undefined ? b.viber    : existing.viber,
      b.photoUri !== undefined ? b.photoUri : existing.photo_uri,
      b.experienceYears !== undefined
        ? (b.experienceYears != null ? Number(b.experienceYears) : null)
        : existing.experience_years,
      b.notes    !== undefined ? b.notes    : existing.notes,
      b.updatedAt ?? now,
      id, req.user!.id,
    ]);

    const updated = await q1<DoctorRow>('SELECT * FROM doctors WHERE id = $1', [id]);
    const doctor = toDoctor(updated!);
    pushToUser(req.user!.id, { type: 'doctor_upserted', doctor });
    res.json({ doctor });
  } catch (e) { next(e); }
});

// ─── DELETE /api/doctors/:id ───────────────────────────────────────────────────

doctorsRouter.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params;
    const result = await q1<{ id: string }>(
      'DELETE FROM doctors WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id],
    );
    if (!result) throw new HttpError(404, 'Doctor not found');
    pushToUser(req.user!.id, { type: 'doctor_deleted', doctorId: id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
