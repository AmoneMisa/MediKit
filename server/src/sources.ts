import { config } from './config.js';

/** A medicine record fetched from an external open-data source. */
export interface GlobalMedicine {
  name: string;
  activeIngredient?: string;
  form?: string;
  description?: string;
  usageNotes?: string;
  warnings?: string[];
  source: string; // 'openfda' | 'rxnav'
}

async function fetchJson<T = unknown>(url: string, timeoutMs = 6000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // network/timeout/parse — treat as "no external data"
  } finally {
    clearTimeout(timer);
  }
}

function firstStr(v: unknown): string | undefined {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined;
  return typeof v === 'string' ? v : undefined;
}

interface OpenFdaLabel {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    substance_name?: string[];
    route?: string[];
    dosage_form?: string[];
  };
  purpose?: string[];
  indications_and_usage?: string[];
  warnings?: string[];
  dosage_and_administration?: string[];
}

/** Search openFDA drug labels by brand or generic name. */
export async function searchOpenFda(term: string, limit = 8): Promise<GlobalMedicine[]> {
  const q = encodeURIComponent(term.trim());
  if (!q) return [];
  const search = `openfda.brand_name:${q}+openfda.generic_name:${q}+openfda.substance_name:${q}`;
  const url = `https://api.fda.gov/drug/label.json?search=${search}&limit=${limit}`;
  const data = await fetchJson<{ results?: OpenFdaLabel[] }>(url);
  if (!data?.results) return [];
  return data.results.map((r): GlobalMedicine => {
    const of = r.openfda ?? {};
    return {
      name: firstStr(of.brand_name) ?? firstStr(of.generic_name) ?? firstStr(of.substance_name) ?? term,
      activeIngredient: firstStr(of.substance_name) ?? firstStr(of.generic_name),
      form: firstStr(of.dosage_form) ?? firstStr(of.route),
      description: firstStr(r.purpose) ?? firstStr(r.indications_and_usage),
      usageNotes: firstStr(r.dosage_and_administration),
      warnings: r.warnings?.slice(0, 3),
      source: 'openfda',
    };
  });
}

interface RxNavGroup {
  drugGroup?: {
    conceptGroup?: Array<{
      tty?: string;
      conceptProperties?: Array<{ name?: string; synonym?: string }>;
    }>;
  };
}

/** Search RxNav/RxNorm by drug name (returns normalized clinical drug names). */
export async function searchRxNav(term: string, limit = 8): Promise<GlobalMedicine[]> {
  const q = encodeURIComponent(term.trim());
  if (!q) return [];
  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${q}`;
  const data = await fetchJson<RxNavGroup>(url);
  const groups = data?.drugGroup?.conceptGroup ?? [];
  const out: GlobalMedicine[] = [];
  for (const g of groups) {
    for (const c of g.conceptProperties ?? []) {
      if (!c.name) continue;
      out.push({ name: c.name, activeIngredient: c.synonym || undefined, source: 'rxnav' });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Merge results from all enabled open sources, de-duplicated by lowercased name. */
export async function searchGlobalSources(term: string, limit = 12): Promise<GlobalMedicine[]> {
  if (!config.enableGlobalMedicineSources) return [];
  const [fda, rx] = await Promise.all([
    searchOpenFda(term, limit),
    searchRxNav(term, limit),
  ]);
  const seen = new Set<string>();
  const merged: GlobalMedicine[] = [];
  for (const m of [...fda, ...rx]) {
    const key = m.name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(m);
    if (merged.length >= limit) break;
  }
  return merged;
}
