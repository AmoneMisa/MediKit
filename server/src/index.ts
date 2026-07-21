import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { ZodError } from 'zod';
import { config } from './config.js';
import { initDb } from './db.js';
import { HttpError } from './util.js';
import { attachRealtime } from './realtime.js';
import { seedMedicinesCatalog } from './seed.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { kitsRouter } from './routes/kits.js';
import { kitInvitesRouter, invitesRouter } from './routes/invites.js';
import { activityRouter } from './routes/activity.js';
import { notificationsRouter } from './routes/notifications.js';
import { medicinesRouter } from './routes/medicines.js';
import { kitMedicinesRouter } from './routes/kitMedicines.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'medikit-server' }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
// Both kit CRUD and kit-scoped invite/activity share the /api/kits prefix.
app.use('/api/kits', kitsRouter);
app.use('/api/kits', kitInvitesRouter);
app.use('/api/kits', kitMedicinesRouter);
app.use('/api/kits', activityRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/medicines', medicinesRouter);

// Central error handler → JSON.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);
attachRealtime(server);

async function main(): Promise<void> {
  await initDb();
  await seedMedicinesCatalog();
  server.listen(config.port, () => {
    console.log(`MediKit server listening on http://0.0.0.0:${config.port}`);
    console.log(`WebSocket:  ws://0.0.0.0:${config.port}/ws?token=<jwt>`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
