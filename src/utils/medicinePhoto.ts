/**
 * Fetches a medicine photo URL from the NLM RxImage API (free, no key required).
 * Works best for internationally known medicine names / active ingredients.
 * Returns null if nothing is found or on network error.
 */
const RXIMAGE_BASE = 'https://rximage.nlm.nih.gov/api/rximage/1/rxnav';

export async function fetchMedicinePhoto(name: string): Promise<string | null> {
  if (!name.trim()) return null;
  try {
    const url = `${RXIMAGE_BASE}?name=${encodeURIComponent(name.trim())}&resolution=600`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data  = await res.json();
    const images: { imageUrl?: string }[] = data?.nlmRxImages ?? [];
    return images[0]?.imageUrl ?? null;
  } catch {
    return null;
  }
}
