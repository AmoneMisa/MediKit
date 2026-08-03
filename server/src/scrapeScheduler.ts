/**
 * Background scrape scheduler — runs the hospital scraper every 3 days.
 *
 * Design:
 *  - All scraper work is async I/O (Overpass fetch + DB inserts), so it never
 *    blocks the Express event loop. No child processes or message queues needed.
 *  - A DB row in `scrape_jobs` acts as a distributed lock: prevents a second
 *    run if the server restarts mid-scrape or two instances race.
 *  - Checks every 6 hours; runs immediately if 3+ days have elapsed.
 */
import { pool, q1, exec } from './db.js';
import { runScrape } from './scripts/scrapeHospitals.js';

const THREE_DAYS_MS  = 3 * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;   // check every 6 h
const STALE_AFTER_MS = 4 * 60 * 60 * 1000;   // a "running" job older than 4 h is considered stale

let scraping = false;

async function getLastSuccessTime(): Promise<Date | null> {
  const row = await q1<{ finished_at: string }>(
    `SELECT finished_at FROM scrape_jobs
     WHERE type = 'hospitals' AND status = 'done'
     ORDER BY finished_at DESC LIMIT 1`,
  );
  return row ? new Date(row.finished_at) : null;
}

async function isAlreadyRunning(): Promise<boolean> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const row = await q1<{ id: string }>(
    `SELECT id FROM scrape_jobs
     WHERE type = 'hospitals' AND status = 'running' AND started_at > $1
     LIMIT 1`,
    [cutoff],
  );
  return !!row;
}

async function maybeScrape(): Promise<void> {
  if (scraping) return; // in-process guard

  try {
    if (await isAlreadyRunning()) {
      console.log('[scraper] Another run is already in progress, skipping.');
      return;
    }
    const last = await getLastSuccessTime();
    if (last && Date.now() - last.getTime() < THREE_DAYS_MS) return; // not due yet
  } catch (err) {
    console.error('[scraper] Failed to check scrape status:', err);
    return;
  }

  scraping = true;
  const jobId     = `sj-${Date.now()}`;
  const startedAt = new Date().toISOString();

  // Fire-and-forget: the async IIFE runs independently while Express keeps serving.
  void (async () => {
    try {
      await exec(
        `INSERT INTO scrape_jobs (id, type, started_at, status) VALUES ($1, 'hospitals', $2, 'running')`,
        [jobId, startedAt],
      );
      console.log(`[scraper] Job ${jobId} started.`);

      const { inserted, skipped } = await runScrape(pool);

      await exec(
        `UPDATE scrape_jobs SET status='done', finished_at=$1, rows_upserted=$2 WHERE id=$3`,
        [new Date().toISOString(), inserted, jobId],
      );
      console.log(`[scraper] Job ${jobId} done. Inserted: ${inserted}, skipped: ${skipped}`);
    } catch (err) {
      try {
        await exec(
          `UPDATE scrape_jobs SET status='error', finished_at=$1, error_msg=$2 WHERE id=$3`,
          [new Date().toISOString(), String(err), jobId],
        );
      } catch { /* best-effort */ }
      console.error(`[scraper] Job ${jobId} error:`, err);
    } finally {
      scraping = false;
    }
  })();
}

/** Call once after initDb() to activate the 3-day scheduler. */
export function startScrapeScheduler(): void {
  // First check 30 s after boot (let the server fully start first).
  setTimeout(() => { void maybeScrape(); }, 30_000);
  // Then check every 6 hours.
  setInterval(() => { void maybeScrape(); }, CHECK_EVERY_MS);
  console.log('[scraper] Scheduler active — hospital data refreshes every 3 days.');
}
