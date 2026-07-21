import { Router } from 'express';
import { z } from 'zod';
import { q, q1 } from '../db.js';
import { ah } from '../util.js';
import { normalizeTerm } from '../seed.js';
import { searchGlobalSources } from '../sources.js';

interface CatalogRow {
  id: string; name: string; active_ingredient: string | null; dosage: string | null;
  form: string | null; description: string | null; usage_notes: string | null;
  warnings: string[] | null; incompatible_with: string[] | null;
  tags: string[] | null; barcodes: string[] | null;
}

// JSONB columns arrive already parsed from pg; coerce defensively.
function asArr(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string') { try { return JSON.parse(v) as string[]; } catch { return undefined; } }
  return undefined;
}

function catalogDto(r: CatalogRow) {
  return {
    id: r.id,
    name: r.name,
    activeIngredient: r.active_ingredient ?? undefined,
    dosage: r.dosage ?? undefined,
    form: r.form ?? undefined,
    description: r.description ?? undefined,
    usageNotes: r.usage_notes ?? undefined,
    warnings: asArr(r.warnings),
    incompatibleWith: asArr(r.incompatible_with),
    tags: asArr(r.tags),
    barcode: asArr(r.barcodes)?.[0],
  };
}

// Public catalog — no auth required (used for search & placeholders while adding meds).
export const medicinesRouter = Router();

// GET /api/medicines/search?q=&global=1
medicinesRouter.get('/search', ah(async (req, res) => {
  const term = String(req.query.q ?? '').toLowerCase().trim();
  if (term.length < 1) { res.json({ medicines: [], global: [] }); return; }
  const like = `%${term}%`;
  const prefix = `${term}%`;
  // Rank: name prefix > name contains > ingredient > blob.
  const rows = await q<CatalogRow>(
    `SELECT *,
       (CASE WHEN lower(name) LIKE $1 THEN 100 ELSE 0 END) +
       (CASE WHEN lower(name) LIKE $2 THEN 50 ELSE 0 END) +
       (CASE WHEN lower(COALESCE(active_ingredient,'')) LIKE $2 THEN 25 ELSE 0 END) +
       (CASE WHEN search_blob LIKE $2 THEN 5 ELSE 0 END) AS score
     FROM medicines_catalog
     WHERE search_blob LIKE $2
     ORDER BY score DESC, name ASC
     LIMIT 20`,
    [prefix, like],
  );

  // Optionally augment with live open-source results (openFDA / RxNav).
  const wantGlobal = req.query.global === '1' || req.query.global === 'true';
  const global = wantGlobal ? await searchGlobalSources(term) : [];

  res.json({ medicines: rows.map(catalogDto), global });
}));

// GET /api/medicines/barcode/:code
medicinesRouter.get('/barcode/:code', ah(async (req, res) => {
  const code = req.params.code;
  const match = await q1<CatalogRow>(
    'SELECT * FROM medicines_catalog WHERE barcodes @> $1::jsonb LIMIT 1',
    [JSON.stringify([code])],
  );
  res.json({ medicine: match ? catalogDto(match) : null });
}));

// ── Drug-drug interaction matching ───────────────────────────────────────────────
interface InteractionRow {
  ingredient_a: string; ingredient_b: string; status: string;
  severity: string | null; note: string | null; source: string;
}

const interactionsSchema = z.object({
  // Ingredient names or medicine names to check pairwise.
  items: z.array(z.string().trim().min(1)).min(2).max(30),
});

/**
 * POST /api/medicines/interactions
 * Body: { items: string[] }  → every unordered pair classified as:
 *   'restricted' (Restricted to use together) | 'caution' | 'ok' (can be used together)
 */
medicinesRouter.post('/interactions', ah(async (req, res) => {
  const { items } = interactionsSchema.parse(req.body);

  // Normalise + de-duplicate while remembering an original label for display.
  const labelByTerm = new Map<string, string>();
  for (const raw of items) {
    const t = normalizeTerm(raw);
    if (t && !labelByTerm.has(t)) labelByTerm.set(t, raw.trim());
  }
  const terms = [...labelByTerm.keys()];
  if (terms.length < 2) { res.json({ pairs: [], worst: 'ok' }); return; }

  // Pull every stored interaction touching two of our terms in one query.
  const rows = await q<InteractionRow>(
    `SELECT ingredient_a, ingredient_b, status, severity, note, source
       FROM medicine_interactions
      WHERE ingredient_a = ANY($1) AND ingredient_b = ANY($1)`,
    [terms],
  );
  const found = new Map<string, InteractionRow>();
  for (const r of rows) found.set(`${r.ingredient_a}|${r.ingredient_b}`, r);

  const rank: Record<string, number> = { ok: 0, caution: 1, restricted: 2 };
  let worst = 'ok';
  const pairs = [] as Array<{
    a: string; b: string; status: string; severity?: string; note?: string; source: string;
  }>;

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const [x, y] = terms[i] < terms[j] ? [terms[i], terms[j]] : [terms[j], terms[i]];
      const hit = found.get(`${x}|${y}`);
      const status = hit?.status ?? 'ok'; // no record → assumed compatible
      if (rank[status] > rank[worst]) worst = status;
      pairs.push({
        a: labelByTerm.get(terms[i])!,
        b: labelByTerm.get(terms[j])!,
        status,
        severity: hit?.severity ?? undefined,
        note: hit?.note ?? undefined,
        source: hit?.source ?? 'assumed',
      });
    }
  }

  res.json({ pairs, worst });
}));
