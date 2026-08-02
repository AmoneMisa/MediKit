import type { MedicinePrefill, MedicineForm, CompositionItem } from '../types';
import { inferMedicineTags } from './medicineTags';

// ─── Configuration ────────────────────────────────────────────────────────────
// Free tier: 14,400 requests/day, ~3s per scan.
// Get key at console.groq.com → API Keys → Create
// Set GROQ_API_KEY in your environment or app config (e.g. react-native-config).
// Get a free key at console.groq.com → API Keys → Create (14,400 req/day free).
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'qwen/qwen3.6-27b';

// ─── Module-level lazy load ───────────────────────────────────────────────────
let launchCamera: any;
let launchImageLibrary: any;
try {
  const ip = require('react-native-image-picker');
  launchCamera       = ip.launchCamera;
  launchImageLibrary = ip.launchImageLibrary;
} catch {}

// ─── Groq vision call ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT =
  'You are a pharmacist assistant. Extract medicine information from package photos and return ONLY valid JSON.';

const USER_PROMPT =
  'Look at this medicine package photo. Return ONLY a JSON object, no markdown, no explanation:\n' +
  '{"name":"brand name without dosage numbers","activeIngredient":"WHO INN generic name in English","dosage":"e.g. 50 mg","form":"tablets or capsules or syrup or spray or drops or ointment or injection or powder or other","manufacturer":"company name","totalQuantity":null,"usageNotes":"one sentence what it treats","warnings":null,"storage":null,"country":null,"tags":["pick 1-3 from: pain,fever,sleep,allergy,cold,stomach,heart,nerves,muscles,antiseptic,antibiotic,vitamins,pressure,skin,eyes,diabetes"]}\n' +
  'Rules: null for unknown fields. Keep brand name in original language. Translate activeIngredient to English INN. For tags pick only from the exact list provided, or use empty array if none fit.';

async function callGroq(base64: string, mediaType: string): Promise<MedicinePrefill> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const body = JSON.stringify({
      model:      GROQ_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          ],
        },
      ],
    });

    const resp = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body,
      signal: controller.signal,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = (err as any)?.error?.message ?? `HTTP_${resp.status}`;
      throw new Error(msg);
    }

    const data = await resp.json();
    const raw  = (data?.choices?.[0]?.message?.content ?? '').trim();

    // Strip think blocks first, then extract the JSON object
    const afterThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')  // closed think tag
                          .replace(/<think>[\s\S]*/gi, '')             // unclosed think tag
                          .trim();
    const jsonMatch = afterThink.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`JSON_PARSE: ${afterThink.slice(0, 80)}`);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(`JSON_PARSE: ${jsonMatch[0].slice(0, 80)}`);
    }

    return buildPrefill(parsed);
  } finally {
    clearTimeout(timer);
  }
}

function buildPrefill(p: any): MedicinePrefill {
  const name             = str(p.name);
  const activeIngredient = str(p.activeIngredient);
  const composition      = buildComposition(activeIngredient);
  const descParts        = [str(p.storage), str(p.country)].filter(Boolean);
  const description      = descParts.length > 0 ? descParts.join('  ·  ') : undefined;
  const warnings         = Array.isArray(p.warnings) && p.warnings.length > 0
    ? (p.warnings as any[]).map(String).filter(s => s.length > 2).slice(0, 10)
    : undefined;
  const VALID_TAGS = ['pain','fever','sleep','allergy','cold','stomach','heart','nerves','muscles','antiseptic','antibiotic','vitamins','pressure','skin','eyes','diabetes'];
  const groqTags = Array.isArray(p.tags)
    ? (p.tags as any[]).map(String).filter(t => VALID_TAGS.includes(t))
    : [];
  const inferredTags = inferMedicineTags(name ?? '', activeIngredient ?? '');
  const allTags = [...new Set([...groqTags, ...inferredTags])];

  return {
    name,
    activeIngredient,
    composition,
    dosage:        str(p.dosage),
    form:          parseForm(p.form),
    manufacturer:  str(p.manufacturer),
    totalQuantity: num(p.totalQuantity),
    usageNotes:    str(p.usageNotes),
    warnings,
    description,
    tags:          allTags.length > 0 ? allTags : undefined,
  };
}

function str(v: any): string | undefined {
  if (v === null || v === undefined || v === 'null') return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function num(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

function parseForm(v: any): MedicineForm | undefined {
  const allowed: MedicineForm[] = ['tablets','capsules','syrup','spray','drops','ointment','injection','powder','patch','other'];
  const s = String(v ?? '').toLowerCase().trim();
  return allowed.includes(s as MedicineForm) ? (s as MedicineForm) : undefined;
}

function buildComposition(activeIngredient: string | undefined): CompositionItem[] | undefined {
  if (!activeIngredient) return undefined;
  const parts = activeIngredient
    .split(/[,;+]+/)
    .map(s => s.trim())
    .filter(s => s.length > 2 && s.length < 80);
  if (parts.length < 2) return undefined;
  return parts.map(name => ({ name, amount: '' }));
}

// ─── Public API ───────────────────────────────────────────────────────────────
export interface LabelScanResult {
  prefill: MedicinePrefill;
}

export async function scanMedicineLabel(): Promise<LabelScanResult | null> {
  if (!launchCamera) throw new Error('IMAGE_PICKER_UNAVAILABLE');

  return new Promise<LabelScanResult | null>((resolve, reject) => {
    launchCamera(
      {
        mediaType:     'photo',
        quality:       0.7,
        maxWidth:      1024,
        maxHeight:     1024,
        includeBase64: true,
        saveToPhotos:  false,
      },
      async (response: any) => {
        if (response.didCancel) { resolve(null); return; }
        if (response.errorCode) {
          reject(new Error(response.errorMessage ?? response.errorCode));
          return;
        }
        const asset = response.assets?.[0];
        if (!asset?.base64) { reject(new Error('NO_IMAGE_DATA')); return; }
        try {
          const prefill = await callGroq(asset.base64, asset.type ?? 'image/jpeg');
          if (!prefill.name && !prefill.activeIngredient) { reject(new Error('NO_TEXT')); return; }
          if (asset.uri) prefill.photoUri = asset.uri;
          resolve({ prefill });
        } catch (e) { reject(e); }
      },
    );
  });
}

export async function scanMedicineLabelFromGallery(): Promise<LabelScanResult | null> {
  if (!launchImageLibrary) throw new Error('IMAGE_PICKER_UNAVAILABLE');

  return new Promise<LabelScanResult | null>((resolve, reject) => {
    launchImageLibrary(
      {
        mediaType:     'photo',
        quality:       0.7,
        maxWidth:      1024,
        maxHeight:     1024,
        includeBase64: true,
      },
      async (response: any) => {
        if (response.didCancel) { resolve(null); return; }
        if (response.errorCode) {
          reject(new Error(response.errorMessage ?? response.errorCode));
          return;
        }
        const asset = response.assets?.[0];
        if (!asset?.base64) { reject(new Error('NO_IMAGE_DATA')); return; }
        try {
          const prefill = await callGroq(asset.base64, asset.type ?? 'image/jpeg');
          if (!prefill.name && !prefill.activeIngredient) { reject(new Error('NO_TEXT')); return; }
          if (asset.uri) prefill.photoUri = asset.uri;
          resolve({ prefill });
        } catch (e) { reject(e); }
      },
    );
  });
}
