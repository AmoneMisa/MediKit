/**
 * Scrapes hospital/clinic data from OpenStreetMap via Overpass API and seeds
 * the doctors_catalog table. Run once (or periodically) to populate the catalog.
 *
 * Usage: npx tsx src/scripts/scrapeHospitals.ts
 */
import pg from 'pg';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/medikit';
const pool = new pg.Pool({ connectionString: DB_URL });

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// ─── OSM speciality → our display name ───────────────────────────────────────

const OSM_TO_SPECIALITY: Record<string, string> = {
  cardiology: 'Cardiologist',
  dermatology: 'Dermatologist',
  endocrinology: 'Endocrinologist',
  gastroenterology: 'Gastroenterologist',
  gynaecology: 'Gynecologist',
  gynecology: 'Gynecologist',
  neurology: 'Neurologist',
  ophthalmology: 'Ophthalmologist',
  orthopedics: 'Orthopedist',
  orthopaedics: 'Orthopedist',
  paediatrics: 'Pediatrician',
  pediatrics: 'Pediatrician',
  psychiatry: 'Psychiatrist',
  psychology: 'Psychologist',
  urology: 'Urologist',
  oncology: 'Oncologist',
  rheumatology: 'Rheumatologist',
  pulmonology: 'Pulmonologist',
  nephrology: 'Nephrologist',
  dentistry: 'Dentist',
  dental: 'Dentist',
  general: 'Therapist',
  general_practice: 'Family Medicine',
  family_medicine: 'Family Medicine',
  family: 'Family Medicine',
  surgery: 'Surgeon',
  otolaryngology: 'ENT',
  ear_nose_throat: 'ENT',
  allergology: 'Allergist',
  allergy: 'Allergist',
  radiology: 'Radiologist',
  physiotherapy: 'Physiotherapist',
  physical_therapy: 'Physiotherapist',
  haematology: 'Hematologist',
  hematology: 'Hematologist',
  hepatology: 'Hepatologist',
  immunology: 'Immunologist',
  infectious_diseases: 'Infectologist',
  emergency: 'Emergency Medicine',
  dietetics: 'Dietitian',
};

// ─── Target cities ────────────────────────────────────────────────────────────

interface City {
  name: string;
  country: string;
  bbox: string; // "south,west,north,east" for Overpass
}

const CITIES: City[] = [
  // Russia
  { name: 'Moscow',          country: 'Russia',  bbox: '55.4897,37.2695,56.0094,37.9686' },
  { name: 'Saint Petersburg', country: 'Russia', bbox: '59.8190,30.0580,60.0990,30.5620' },
  { name: 'Yekaterinburg',   country: 'Russia',  bbox: '56.7089,60.5290,56.9329,60.7730' },
  { name: 'Novosibirsk',     country: 'Russia',  bbox: '54.7866,82.8498,55.0946,83.1398' },
  { name: 'Kazan',           country: 'Russia',  bbox: '55.7107,48.9946,55.8707,49.2746' },
  // Turkey
  { name: 'Istanbul',        country: 'Turkey',  bbox: '40.8026,28.4675,41.3212,29.4521' },
  { name: 'Ankara',          country: 'Turkey',  bbox: '39.7528,32.5636,40.0558,33.0025' },
  { name: 'Izmir',           country: 'Turkey',  bbox: '38.2847,26.9714,38.5760,27.3054' },
  { name: 'Bursa',           country: 'Turkey',  bbox: '40.1274,28.8650,40.2864,29.1400' },
  { name: 'Antalya',         country: 'Turkey',  bbox: '36.7800,30.5450,37.0100,30.8250' },
  // Romania
  { name: 'Bucharest',       country: 'Romania', bbox: '44.3540,25.9430,44.5630,26.2350' },
  { name: 'Cluj-Napoca',     country: 'Romania', bbox: '46.7139,23.5063,46.8119,23.6682' },
  { name: 'Timișoara',       country: 'Romania', bbox: '45.7139,21.1773,45.8179,21.3533' },
  { name: 'Iași',            country: 'Romania', bbox: '47.1214,27.5102,47.2154,27.6712' },
  { name: 'Constanța',       country: 'Romania', bbox: '44.1340,28.5700,44.2340,28.7000' },
  // Moldova
  { name: 'Chișinău',        country: 'Moldova', bbox: '46.9317,28.7570,47.0856,28.9869' },
  { name: 'Bălți',           country: 'Moldova', bbox: '47.7286,27.8596,47.8286,27.9996' },
];

// ─── OSM data types ───────────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSpeciality(tags: Record<string, string>): string {
  const rawSpec = (tags['healthcare:speciality'] ?? tags['speciality'] ?? '').toLowerCase().trim();
  if (rawSpec) {
    const mapped = OSM_TO_SPECIALITY[rawSpec];
    if (mapped) return mapped;
    // Try partial match (e.g. "cardiology;neurology" → first one)
    const first = rawSpec.split(';')[0].trim();
    if (OSM_TO_SPECIALITY[first]) return OSM_TO_SPECIALITY[first];
  }
  const amenity = (tags['amenity'] ?? tags['healthcare'] ?? '').toLowerCase();
  if (amenity === 'hospital') return 'Hospital';
  if (amenity === 'clinic')   return 'Clinic';
  if (amenity === 'doctors')  return 'Therapist';
  return 'Clinic';
}

function getPhone(tags: Record<string, string>): string | null {
  return tags['phone'] ?? tags['contact:phone'] ?? tags['telephone'] ?? null;
}

function getAddress(tags: Record<string, string>): string | null {
  const parts = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function getName(tags: Record<string, string>): string | null {
  // Prefer the native name, fall back to English, then any name
  return tags['name'] ?? tags['name:en'] ?? null;
}

function getNotes(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  if (tags['opening_hours']) parts.push(`Hours: ${tags['opening_hours']}`);
  if (tags['website'] ?? tags['contact:website']) parts.push(`Web: ${tags['website'] ?? tags['contact:website']}`);
  if (tags['beds']) parts.push(`Beds: ${tags['beds']}`);
  return parts.length > 0 ? parts.join(' | ') : null;
}

// ─── Overpass query ───────────────────────────────────────────────────────────

async function queryCity(city: City): Promise<OsmElement[]> {
  const query = `[out:json][timeout:60];
(
  node["amenity"~"^(hospital|clinic|doctors)$"]["name"](${city.bbox});
  way["amenity"~"^(hospital|clinic|doctors)$"]["name"](${city.bbox});
  node["healthcare"~"^(hospital|clinic|doctor)$"]["name"](${city.bbox});
  way["healthcare"~"^(hospital|clinic|doctor)$"]["name"](${city.bbox});
);
out center tags;`;

  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
  const json = await resp.json() as { elements?: OsmElement[] };
  return json.elements ?? [];
}

// ─── DB insertion ─────────────────────────────────────────────────────────────

async function upsertDoctor(city: City, el: OsmElement): Promise<boolean> {
  const tags = el.tags;
  const name = getName(tags);
  if (!name?.trim()) return false;

  const id = `dc-osm-${el.type}-${el.id}`;
  const speciality = getSpeciality(tags);
  const address = getAddress(tags);
  const cityName = tags['addr:city'] ?? city.name;
  const country = tags['addr:country'] ?? city.country;
  const phone = getPhone(tags);
  const notes = getNotes(tags);
  // Store blob without lowercasing — ILIKE handles case on the server
  const blob = [name, speciality, cityName, country, address].filter(Boolean).join(' ');
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO doctors_catalog
       (id, name, speciality, phone, address, city, country, notes, contributed_at, search_blob)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, speciality=$3, phone=$4, address=$5, city=$6,
       country=$7, notes=$8, search_blob=$10`,
    [id, name, speciality, phone, address, cityName, country, notes, now, blob],
  );
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🏥 MediKit hospital scraper — OpenStreetMap / Overpass API\n');
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const city of CITIES) {
    try {
      process.stdout.write(`Querying ${city.name}, ${city.country} ... `);
      const elements = await queryCity(city);
      process.stdout.write(`${elements.length} elements → `);

      let cityCount = 0;
      for (const el of elements) {
        try {
          const ok = await upsertDoctor(city, el);
          if (ok) { cityCount++; totalInserted++; } else totalSkipped++;
        } catch { totalSkipped++; }
      }
      console.log(`${cityCount} saved`);

      // Respect Overpass rate limit: 1 request per second
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
    }
  }

  console.log(`\n✅ Done! Saved: ${totalInserted}, skipped: ${totalSkipped}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
