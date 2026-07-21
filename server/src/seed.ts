import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { q1, pool } from './db.js';
import { id } from './util.js';

interface SeedMedicine {
  name: string;
  activeIngredient?: string;
  dosage?: string;
  form?: string;
  description?: string;
  usageNotes?: string;
  warnings?: string[];
  incompatibleWith?: string[];
  tags?: string[];
  barcodes?: string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSeedFile(): SeedMedicine[] {
  const raw = readFileSync(resolve(__dirname, 'data/medicines-seed.json'), 'utf-8');
  return JSON.parse(raw) as SeedMedicine[];
}

export function normalizeTerm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Populate the medicines catalog + derived interaction pairs when empty. */
export async function seedMedicinesCatalog(): Promise<void> {
  const existing = await q1<{ n: string }>('SELECT COUNT(*) AS n FROM medicines_catalog');
  if (existing && Number(existing.n) > 0) return;

  let items: SeedMedicine[];
  try {
    items = loadSeedFile();
  } catch (e) {
    console.warn('No medicines seed file found; catalog will start empty.', e);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of items) {
      const blob = [m.name, m.activeIngredient, m.description].filter(Boolean).join(' ').toLowerCase();
      await client.query(
        `INSERT INTO medicines_catalog
           (id, name, active_ingredient, dosage, form, description, usage_notes, warnings, incompatible_with, tags, barcodes, source, search_blob)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'seed',$12)`,
        [
          id('cat'), m.name, m.activeIngredient ?? null, m.dosage ?? null, m.form ?? null,
          m.description ?? null, m.usageNotes ?? null,
          m.warnings ? JSON.stringify(m.warnings) : null,
          m.incompatibleWith ? JSON.stringify(m.incompatibleWith) : null,
          m.tags ? JSON.stringify(m.tags) : null,
          m.barcodes ? JSON.stringify(m.barcodes) : null,
          blob,
        ],
      );

      // Derive "restricted to use together" pairs from the curated incompatibleWith data.
      const self = normalizeTerm(m.activeIngredient || m.name);
      for (const raw of m.incompatibleWith ?? []) {
        const other = normalizeTerm(raw);
        if (!other || other === self) continue;
        const [a, b] = self < other ? [self, other] : [other, self];
        await client.query(
          `INSERT INTO medicine_interactions (id, ingredient_a, ingredient_b, status, note, source)
           VALUES ($1, $2, $3, 'restricted', $4, 'seed')
           ON CONFLICT (ingredient_a, ingredient_b) DO NOTHING`,
          [id('ix'), a, b, `«${m.name}» несовместим с: ${raw}`],
        );
      }
    }
    await client.query('COMMIT');
    console.log(`Seeded ${items.length} catalog medicines and derived interaction pairs.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Re-export for callers that only need the file (e.g. re-seeding scripts).
export { loadSeedFile };
export type { SeedMedicine };
