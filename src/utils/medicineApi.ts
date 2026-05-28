import type { MedicinePrefill, MedicineForm } from '../types';

function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function parseFdaForm(formStr: string): MedicineForm {
  const s = (formStr ?? '').toLowerCase();
  if (s.includes('tablet'))                                                    return 'tablets';
  if (s.includes('capsule'))                                                   return 'capsules';
  if (s.includes('syrup') || s.includes('solution') || s.includes('liquid'))  return 'syrup';
  if (s.includes('spray') || s.includes('aerosol'))                           return 'spray';
  if (s.includes('drop'))                                                      return 'drops';
  if (s.includes('cream') || s.includes('ointment') || s.includes('gel'))     return 'ointment';
  if (s.includes('inject') || s.includes('vial'))                             return 'injection';
  if (s.includes('powder'))                                                    return 'powder';
  if (s.includes('patch'))                                                     return 'patch';
  return 'other';
}

function mapFdaResult(r: any): MedicinePrefill {
  const ingredient = r.active_ingredients?.[0];
  return {
    name:             (r.brand_name || r.generic_name || '').trim(),
    activeIngredient: ingredient?.name?.trim(),
    dosage:           ingredient?.strength?.trim(),
    form:             parseFdaForm(r.dosage_form ?? ''),
  };
}

// Returns a human-readable country name from the EAN-13 prefix (first 3 digits).
export function barcodeCountry(barcode: string): string {
  const prefix = parseInt(barcode.slice(0, 3), 10);
  if (prefix >= 460 && prefix <= 469) return 'Россия';
  if (prefix === 481)                  return 'Беларусь';
  if (prefix === 482)                  return 'Украина';
  if (prefix === 484)                  return 'Молдова';
  if (prefix === 485)                  return 'Армения';
  if (prefix === 486)                  return 'Грузия';
  if (prefix === 487)                  return 'Казахстан';
  if (prefix === 488)                  return 'Таджикистан';
  if (prefix === 489)                  return 'Гонконг';
  if (prefix === 470)                  return 'Казахстан/Кыргызстан';
  if (prefix === 478)                  return 'Узбекистан';
  if (prefix === 869)                  return 'Турция';
  if (prefix >= 400 && prefix <= 440)  return 'Германия';
  if (prefix >= 300 && prefix <= 379)  return 'Франция';
  if (prefix >= 500 && prefix <= 509)  return 'Великобритания';
  if (prefix >= 380 && prefix <= 383)  return 'Болгария';
  if (prefix === 385)                  return 'Хорватия';
  if (prefix >= 590 && prefix <= 599)  return 'Польша';
  if (prefix === 599)                  return 'Венгрия';
  if (prefix === 560)                  return 'Португалия';
  if (prefix === 569)                  return 'Мальта';
  if (prefix >= 500 && prefix <= 509)  return 'Великобритания';
  if (prefix >= 600 && prefix <= 601)  return 'ЮАР';
  if (prefix >= 690 && prefix <= 699)  return 'Китай';
  if (prefix >= 0   && prefix <= 19)   return 'США/Канада';
  if (prefix >= 30  && prefix <= 37)   return 'Франция';
  if (prefix >= 40  && prefix <= 44)   return 'Германия';
  if (prefix >= 45  && prefix <= 49)   return 'Япония';
  if (prefix >= 50  && prefix <= 59)   return 'Великобритания';
  return '';
}

// ─── Barcode lookup ───────────────────────────────────────────────────────────

export async function fetchByBarcode(barcode: string): Promise<MedicinePrefill | null> {
  // 1. Open Food Facts — world database (best for CIS/European EAN-13)
  try {
    const resp = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_ru,product_name_uk,generic_name,brands`,
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const name: string =
          p.product_name_ru || p.product_name_uk || p.product_name ||
          p.generic_name    || p.brands          || '';
        if (name.trim()) {
          return {
            name: name.trim(),
            activeIngredient: (p.generic_name && p.generic_name !== name) ? p.generic_name.trim() : undefined,
          };
        }
      }
    }
  } catch {}

  // 2. barcode.monster — free community barcode DB, covers many CIS/EU products
  try {
    const resp = await fetchWithTimeout(`https://barcode.monster/api/${barcode}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.name && !data.error) {
        return { name: data.name.trim(), description: data.description || undefined };
      }
    }
  } catch {}

  // 3. Open EAN / OpenGTIN DB — European community EAN database (XML response)
  try {
    const resp = await fetchWithTimeout(
      `https://opengtindb.org/?ean=${barcode}&cmd=details&lang=EN`,
    );
    if (resp.ok) {
      const xml = await resp.text();
      const nameMatch = xml.match(/<name>(.*?)<\/name>/i);
      const vendorMatch = xml.match(/<vendor>(.*?)<\/vendor>/i);
      if (nameMatch?.[1] && nameMatch[1] !== 'N/A') {
        return {
          name: nameMatch[1].trim(),
          activeIngredient: vendorMatch?.[1]?.trim() || undefined,
        };
      }
    }
  } catch {}

  // 4. Open Food Facts — Russian subdomain (different product index)
  try {
    const resp = await fetchWithTimeout(
      `https://ru.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_ru,generic_name,brands`,
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const name: string = p.product_name_ru || p.product_name || p.brands || '';
        if (name.trim()) return { name: name.trim() };
      }
    }
  } catch {}

  // 5. UPC Item DB — broad international barcode database
  try {
    const resp = await fetchWithTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
    if (resp.ok) {
      const data = await resp.json();
      const item = data.items?.[0];
      if (item?.title) return { name: item.title.trim(), description: item.description || undefined };
    }
  } catch {}

  // 6. OpenFDA package NDC (US medicines / global registrations)
  try {
    const resp = await fetchWithTimeout(
      `https://api.fda.gov/drug/ndc.json?search=package_ndc:"${barcode}"&limit=1`,
    );
    if (resp.ok) {
      const data = await resp.json();
      const r = data.results?.[0];
      if (r) return mapFdaResult(r);
    }
  } catch {}

  // 7. OpenFDA product NDC
  try {
    const resp = await fetchWithTimeout(
      `https://api.fda.gov/drug/ndc.json?search=product_ndc:"${barcode}"&limit=1`,
    );
    if (resp.ok) {
      const data = await resp.json();
      const r = data.results?.[0];
      if (r) return mapFdaResult(r);
    }
  } catch {}

  return null;
}

// ─── Medicine name / ingredient search ────────────────────────────────────────

export async function searchMedicinesApi(query: string): Promise<MedicinePrefill[]> {
  if (!query.trim()) return [];
  const q = encodeURIComponent(query.trim());

  const seen    = new Set<string>();
  const results: MedicinePrefill[] = [];

  function add(r: MedicinePrefill) {
    const key = (r.name ?? '').toLowerCase().trim();
    if (key && !seen.has(key)) { seen.add(key); results.push(r); }
  }

  // OpenFDA drug NDC — brand_name and generic_name in parallel
  const [brandRes, genericRes] = await Promise.allSettled([
    fetchWithTimeout(`https://api.fda.gov/drug/ndc.json?search=brand_name:${q}&limit=15`),
    fetchWithTimeout(`https://api.fda.gov/drug/ndc.json?search=generic_name:${q}&limit=10`),
  ]);

  for (const settled of [brandRes, genericRes]) {
    if (settled.status === 'fulfilled' && settled.value.ok) {
      try {
        const data = await settled.value.json();
        (data.results ?? []).forEach((r: any) => {
          const mapped = mapFdaResult(r);
          if (mapped.name) add(mapped);
        });
      } catch {}
    }
  }

  // RxNorm — NIH pharmaceutical database (US, but with many generic INN names)
  try {
    const resp = await fetchWithTimeout(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${q}`);
    if (resp.ok) {
      const data = await resp.json();
      const groups: any[] = data.drugGroup?.conceptGroup ?? [];
      for (const group of groups) {
        for (const concept of (group.conceptProperties ?? [])) {
          if (concept.name) add({ name: concept.name.trim() });
        }
      }
    }
  } catch {}

  // OpenFDA drug labels — catches additional products
  try {
    const resp = await fetchWithTimeout(
      `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${q}&limit=8`,
    );
    if (resp.ok) {
      const data = await resp.json();
      (data.results ?? []).forEach((r: any) => {
        const name: string = r.openfda?.brand_name?.[0] ?? '';
        const generic: string = r.openfda?.generic_name?.[0] ?? '';
        const form: string = r.openfda?.dosage_form?.[0] ?? '';
        if (name) add({ name: name.trim(), activeIngredient: generic || undefined, form: parseFdaForm(form) });
      });
    }
  } catch {}

  return results;
}
