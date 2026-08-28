import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { ah, HttpError } from '../util.js';
import { config } from '../config.js';

export const labelScanRouter = Router();
labelScanRouter.use(requireAuth);

const bodySchema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.string().default('image/jpeg'),
});

const SYSTEM_PROMPT =
  'You are a pharmacist assistant. Extract medicine information from package photos and return ONLY valid JSON.';

const USER_PROMPT =
  'Look at this medicine package photo. Return ONLY a JSON object, no markdown, no explanation:\n' +
  '{"name":"brand name without dosage numbers","activeIngredient":"WHO INN generic name in English","dosage":"e.g. 50 mg","form":"tablets or capsules or syrup or spray or drops or ointment or injection or powder or other","manufacturer":"company name","totalQuantity":null,"usageNotes":"one sentence what it treats","warnings":null,"storage":null,"country":null,"tags":["pick 1-3 from: pain,fever,sleep,allergy,cold,stomach,heart,nerves,muscles,antiseptic,antibiotic,vitamins,pressure,skin,eyes,diabetes"]}\n' +
  'Rules: null for unknown fields. Keep brand name in original language. Translate activeIngredient to English INN. For tags pick only from the exact list provided, or use empty array if none fit.';

// Strips <think> blocks (some hosted models emit them) and extracts/parses the
// first JSON object found in the model's text response.
function parseModelJson(raw: string): unknown {
  const afterThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
                        .replace(/<think>[\s\S]*/gi, '')
                        .trim();
  const jsonMatch = afterThink.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new HttpError(502, `Model did not return JSON: ${afterThink.slice(0, 80)}`);

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new HttpError(502, `Model returned invalid JSON: ${jsonMatch[0].slice(0, 80)}`);
  }
}

// Shared shape for OpenAI-compatible chat-completions vision endpoints (Groq, Gemini).
async function callOpenAiCompatibleVision(
  url: string,
  apiKey: string,
  model: string,
  imageBase64: string,
  mediaType: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: USER_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = (err as any)?.error?.message ?? `HTTP_${resp.status}`;
    throw new Error(msg);
  }

  const data = await resp.json();
  const raw = (data?.choices?.[0]?.message?.content ?? '').trim();
  return parseModelJson(raw);
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
async function callGroq(imageBase64: string, mediaType: string): Promise<unknown> {
  if (!config.groqApiKey) throw new Error('GROQ_NOT_CONFIGURED');
  return callOpenAiCompatibleVision(GROQ_URL, config.groqApiKey, config.groqVisionModel, imageBase64, mediaType);
}

// Gemini's OpenAI-compatible endpoint.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
async function callGemini(imageBase64: string, mediaType: string): Promise<unknown> {
  if (!config.geminiApiKey) throw new Error('GEMINI_NOT_CONFIGURED');
  return callOpenAiCompatibleVision(GEMINI_URL, config.geminiApiKey, config.geminiVisionModel, imageBase64, mediaType);
}

const PROVIDERS: Array<{ name: string; call: (imageBase64: string, mediaType: string) => Promise<unknown> }> = [
  { name: 'groq', call: callGroq },
  { name: 'gemini', call: callGemini },
];

// POST /api/label-scan — authed proxy to hosted vision models (Groq primary, Gemini
// fallback). Keeps API keys server-side; the client never sees them. Returns the
// model's parsed JSON object as-is; the client keeps its own normalization/tag
// -inference logic (buildPrefill) unchanged.
labelScanRouter.post('/', ah(async (req, res) => {
  const { imageBase64, mediaType } = bodySchema.parse(req.body);

  const errors: string[] = [];
  for (const provider of PROVIDERS) {
    try {
      const result = await provider.call(imageBase64, mediaType);
      res.json({ result, provider: provider.name });
      return;
    } catch (e) {
      errors.push(`${provider.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new HttpError(503, `Label scanning is not available: ${errors.join('; ')}`);
}));
