import type { MedicinePrefill, MedicineForm, CompositionItem } from '../types';
import { inferMedicineTags } from './medicineTags';
import { request } from '../api/client';

// ─── Module-level lazy load ───────────────────────────────────────────────────
let launchCamera: any;
let launchImageLibrary: any;
try {
  const ip = require('react-native-image-picker');
  launchCamera       = ip.launchCamera;
  launchImageLibrary = ip.launchImageLibrary;
} catch {}

// ─── Server-side vision scan ───────────────────────────────────────────────────
// The Groq call itself (key, model, prompts) lives server-side in
// server/src/routes/labelScan.ts so the API key never ships in the app bundle.
async function scanViaServer(base64: string, mediaType: string): Promise<MedicinePrefill> {
  const { result } = await request<{ result: unknown }>('/label-scan', {
    method: 'POST',
    body: { imageBase64: base64, mediaType },
    timeoutMs: 35_000,
  });
  return buildPrefill(result);
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
          const prefill = await scanViaServer(asset.base64, asset.type ?? 'image/jpeg');
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
          const prefill = await scanViaServer(asset.base64, asset.type ?? 'image/jpeg');
          if (!prefill.name && !prefill.activeIngredient) { reject(new Error('NO_TEXT')); return; }
          if (asset.uri) prefill.photoUri = asset.uri;
          resolve({ prefill });
        } catch (e) { reject(e); }
      },
    );
  });
}
