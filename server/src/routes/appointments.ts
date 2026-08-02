import { Router } from 'express';
import { q, q1, exec } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth.js';
import { HttpError } from '../util.js';
import { pushToUser } from '../realtime.js';

const VALID_STATUSES = new Set(['upcoming', 'completed', 'cancelled']);

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);

// ─── Row ↔ Appointment mapping ────────────────────────────────────────────────

interface AppointmentRow {
  id: string; user_id: string; doctor_id: string;
  date_time: string; is_online: boolean;
  meet_link: string | null; address: string | null;
  description: string | null; questions_for_doctor: string | null;
  analyses: unknown[] | null; prescriptions: unknown[] | null;
  notes: string | null; status: string;
  calendar_event_id: string | null;
  created_at: string; updated_at: string;
}

function toAppointment(r: AppointmentRow) {
  return {
    id:                  r.id,
    doctorId:            r.doctor_id,
    dateTime:            r.date_time,
    isOnline:            r.is_online,
    meetLink:            r.meet_link            ?? undefined,
    address:             r.address              ?? undefined,
    description:         r.description          ?? undefined,
    questionsForDoctor:  r.questions_for_doctor ?? undefined,
    analyses:            r.analyses             ?? [],
    prescriptions:       r.prescriptions        ?? [],
    notes:               r.notes                ?? undefined,
    status:              r.status,
    calendarEventId:     r.calendar_event_id    ?? undefined,
    createdAt:           r.created_at,
    updatedAt:           r.updated_at,
  };
}

// ─── GET /api/appointments ────────────────────────────────────────────────────

appointmentsRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const { doctorId, limit, offset } = req.query as { doctorId?: string; limit?: string; offset?: string };
    const lim = limit ? Math.min(parseInt(limit, 10) || 100, 500) : null;
    const off = offset ? (parseInt(offset, 10) || 0) : 0;

    let sql: string;
    let params: unknown[];

    if (doctorId) {
      sql = 'SELECT * FROM appointments WHERE user_id = $1 AND doctor_id = $2 ORDER BY date_time DESC';
      params = [req.user!.id, doctorId];
    } else {
      sql = 'SELECT * FROM appointments WHERE user_id = $1 ORDER BY date_time DESC';
      params = [req.user!.id];
    }
    // Use parameterized LIMIT/OFFSET — never interpolate into SQL
    if (off) { params.push(off); sql += ` OFFSET $${params.length}`; }
    if (lim) { params.push(lim); sql += ` LIMIT $${params.length}`; }

    const rows = await q<AppointmentRow>(sql, params);
    res.json({ appointments: rows.map(toAppointment), offset: off, limit: lim });
  } catch (e) { next(e); }
});

// ─── POST /api/appointments  (upsert by client id) ────────────────────────────

appointmentsRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body;
    if (!b.doctorId)  throw new HttpError(400, 'doctorId is required');
    if (!b.dateTime)  throw new HttpError(400, 'dateTime is required');
    if (b.status !== undefined && !VALID_STATUSES.has(b.status)) throw new HttpError(400, 'invalid status');

    const now = new Date().toISOString();
    const id  = b.id ?? `appt-${Date.now()}`;

    await exec(`
      INSERT INTO appointments (
        id, user_id, doctor_id, date_time, is_online,
        meet_link, address, description, questions_for_doctor,
        analyses, prescriptions, notes, status, calendar_event_id,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO UPDATE SET
        doctor_id=$3, date_time=$4, is_online=$5,
        meet_link=$6, address=$7, description=$8, questions_for_doctor=$9,
        analyses=$10, prescriptions=$11, notes=$12, status=$13,
        calendar_event_id=$14, updated_at=$16
    `, [
      id, req.user!.id, b.doctorId, b.dateTime,
      b.isOnline ?? false,
      b.meetLink           ?? null,
      b.address            ?? null,
      b.description        ?? null,
      b.questionsForDoctor ?? null,
      b.analyses           ? JSON.stringify(b.analyses)      : null,
      b.prescriptions      ? JSON.stringify(b.prescriptions) : null,
      b.notes              ?? null,
      b.status             ?? 'upcoming',
      b.calendarEventId    ?? null,
      b.createdAt ?? now,
      b.updatedAt ?? now,
    ]);

    const row = await q1<AppointmentRow>('SELECT * FROM appointments WHERE id = $1', [id]);
    const appointment = toAppointment(row!);
    pushToUser(req.user!.id, { type: 'appointment_upserted', appointment });
    res.status(201).json({ appointment });
  } catch (e) { next(e); }
});

// ─── PATCH /api/appointments/:id ──────────────────────────────────────────────

appointmentsRouter.patch('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await q1<AppointmentRow>(
      'SELECT * FROM appointments WHERE id = $1 AND user_id = $2', [id, req.user!.id],
    );
    if (!existing) throw new HttpError(404, 'Appointment not found');

    const b   = req.body;
    const now = new Date().toISOString();
    if (b.status !== undefined && !VALID_STATUSES.has(b.status)) throw new HttpError(400, 'invalid status');

    await exec(`
      UPDATE appointments SET
        doctor_id=$1, date_time=$2, is_online=$3,
        meet_link=$4, address=$5, description=$6, questions_for_doctor=$7,
        analyses=$8, prescriptions=$9, notes=$10, status=$11,
        calendar_event_id=$12, updated_at=$13
      WHERE id=$14 AND user_id=$15
    `, [
      b.doctorId            ?? existing.doctor_id,
      b.dateTime            ?? existing.date_time,
      b.isOnline            !== undefined ? b.isOnline            : existing.is_online,
      b.meetLink            !== undefined ? b.meetLink            : existing.meet_link,
      b.address             !== undefined ? b.address             : existing.address,
      b.description         !== undefined ? b.description         : existing.description,
      b.questionsForDoctor  !== undefined ? b.questionsForDoctor  : existing.questions_for_doctor,
      b.analyses            !== undefined ? JSON.stringify(b.analyses)      : existing.analyses,
      b.prescriptions       !== undefined ? JSON.stringify(b.prescriptions) : existing.prescriptions,
      b.notes               !== undefined ? b.notes               : existing.notes,
      b.status              ?? existing.status,
      b.calendarEventId     !== undefined ? b.calendarEventId     : existing.calendar_event_id,
      b.updatedAt ?? now,
      id, req.user!.id,
    ]);

    const updated = await q1<AppointmentRow>('SELECT * FROM appointments WHERE id = $1', [id]);
    const appointment = toAppointment(updated!);
    pushToUser(req.user!.id, { type: 'appointment_upserted', appointment });
    res.json({ appointment });
  } catch (e) { next(e); }
});

// ─── DELETE /api/appointments/:id ─────────────────────────────────────────────

appointmentsRouter.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params;
    const result = await q1<{ id: string }>(
      'DELETE FROM appointments WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id],
    );
    if (!result) throw new HttpError(404, 'Appointment not found');
    pushToUser(req.user!.id, { type: 'appointment_deleted', appointmentId: id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
