/**
 * Scrapes hospital/clinic data from OpenStreetMap via Overpass API and seeds
 * the doctors_catalog table. Covers public hospitals, private clinics, dentists,
 * and specialty practices. Also seeds well-known online doctor platforms manually.
 *
 * Usage (CLI):  DATABASE_URL=postgresql://... npm run scrape
 * Usage (code): import { runScrape } from './scrapeHospitals.js'; await runScrape(pool);
 */
import pg from 'pg';

// Multiple mirrors tried in order — first reachable one wins.
const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

let OVERPASS_URL = OVERPASS_MIRRORS[0];

async function pickMirror(): Promise<void> {
  for (const url of OVERPASS_MIRRORS) {
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8_000) });
      if (resp.ok || resp.status < 500) { OVERPASS_URL = url; return; }
    } catch { /* try next */ }
  }
  console.warn('[scraper] No Overpass mirror reachable — OSM data will be skipped.');
}

// ─── OSM speciality → our display name ───────────────────────────────────────

const OSM_TO_SPECIALITY: Record<string, string> = {
  cardiology: 'Cardiologist',
  dermatology: 'Dermatologist',
  endocrinology: 'Endocrinologist',
  gastroenterology: 'Gastroenterologist',
  gynaecology: 'Gynecologist', gynecology: 'Gynecologist',
  neurology: 'Neurologist',
  ophthalmology: 'Ophthalmologist',
  orthopedics: 'Orthopedist', orthopaedics: 'Orthopedist',
  paediatrics: 'Pediatrician', pediatrics: 'Pediatrician',
  psychiatry: 'Psychiatrist',
  psychology: 'Psychologist',
  urology: 'Urologist',
  oncology: 'Oncologist',
  rheumatology: 'Rheumatologist',
  pulmonology: 'Pulmonologist', pneumology: 'Pulmonologist',
  nephrology: 'Nephrologist',
  dentistry: 'Dentist', dental: 'Dentist',
  general: 'Therapist', therapy: 'Therapist',
  general_practice: 'Family Medicine', family_medicine: 'Family Medicine', family: 'Family Medicine',
  surgery: 'Surgeon',
  otolaryngology: 'ENT', ear_nose_throat: 'ENT', ent: 'ENT',
  allergology: 'Allergist', allergy: 'Allergist',
  radiology: 'Radiologist',
  physiotherapy: 'Physiotherapist', physical_therapy: 'Physiotherapist', rehabilitation: 'Physiotherapist',
  haematology: 'Hematologist', hematology: 'Hematologist',
  hepatology: 'Hepatologist',
  immunology: 'Immunologist',
  infectious_diseases: 'Infectologist',
  emergency: 'Emergency Medicine',
  dietetics: 'Dietitian', nutrition: 'Dietitian',
  anesthesiology: 'Anesthesiologist', anaesthesiology: 'Anesthesiologist',
};

// ─── Target cities (south, west, north, east) ────────────────────────────────

interface City { name: string; country: string; bbox: string; }

const CITIES: City[] = [
  // ── Russia ──────────────────────────────────────────────────────────────────
  { name: 'Moscow',           country: 'Russia',      bbox: '55.4897,37.2695,56.0094,37.9686' },
  { name: 'Saint Petersburg', country: 'Russia',      bbox: '59.8190,30.0580,60.0990,30.5620' },
  { name: 'Yekaterinburg',    country: 'Russia',      bbox: '56.7089,60.5290,56.9329,60.7730' },
  { name: 'Novosibirsk',      country: 'Russia',      bbox: '54.7866,82.8498,55.0946,83.1398' },
  { name: 'Kazan',            country: 'Russia',      bbox: '55.7107,48.9946,55.8707,49.2746' },
  { name: 'Krasnodar',        country: 'Russia',      bbox: '45.0000,38.9000,45.1000,39.0800' },
  { name: 'Rostov-on-Don',    country: 'Russia',      bbox: '47.1500,39.5500,47.3500,39.8500' },
  { name: 'Samara',           country: 'Russia',      bbox: '53.1000,50.0500,53.3000,50.3500' },
  // ── Ukraine ──────────────────────────────────────────────────────────────────
  { name: 'Kyiv',             country: 'Ukraine',     bbox: '50.2135,30.2396,50.5910,30.8234' },
  { name: 'Kharkiv',          country: 'Ukraine',     bbox: '49.8800,36.1000,50.0900,36.4500' },
  { name: 'Odesa',            country: 'Ukraine',     bbox: '46.3000,30.5500,46.5500,30.9500' },
  { name: 'Dnipro',           country: 'Ukraine',     bbox: '48.3500,34.8500,48.5800,35.2000' },
  { name: 'Lviv',             country: 'Ukraine',     bbox: '49.7700,23.8900,49.9300,24.1700' },
  { name: 'Zaporizhzhia',     country: 'Ukraine',     bbox: '47.7200,34.9500,47.9700,35.3500' },
  { name: 'Vinnytsia',        country: 'Ukraine',     bbox: '49.1700,28.3700,49.2700,28.5300' },
  { name: 'Poltava',          country: 'Ukraine',     bbox: '49.5300,34.5100,49.6400,34.6600' },
  // ── Turkey ───────────────────────────────────────────────────────────────────
  { name: 'Istanbul',         country: 'Turkey',      bbox: '40.8026,28.4675,41.3212,29.4521' },
  { name: 'Ankara',           country: 'Turkey',      bbox: '39.7528,32.5636,40.0558,33.0025' },
  { name: 'Izmir',            country: 'Turkey',      bbox: '38.2847,26.9714,38.5760,27.3054' },
  { name: 'Bursa',            country: 'Turkey',      bbox: '40.1274,28.8650,40.2864,29.1400' },
  { name: 'Antalya',          country: 'Turkey',      bbox: '36.7800,30.5450,37.0100,30.8250' },
  { name: 'Adana',            country: 'Turkey',      bbox: '36.9500,35.2500,37.0800,35.4500' },
  { name: 'Konya',            country: 'Turkey',      bbox: '37.8200,32.4000,37.9500,32.6000' },
  { name: 'Gaziantep',        country: 'Turkey',      bbox: '37.0000,37.2500,37.1200,37.5000' },
  // ── Romania ──────────────────────────────────────────────────────────────────
  { name: 'Bucharest',        country: 'Romania',     bbox: '44.3540,25.9430,44.5630,26.2350' },
  { name: 'Cluj-Napoca',      country: 'Romania',     bbox: '46.7139,23.5063,46.8119,23.6682' },
  { name: 'Timișoara',        country: 'Romania',     bbox: '45.7139,21.1773,45.8179,21.3533' },
  { name: 'Iași',             country: 'Romania',     bbox: '47.1214,27.5102,47.2154,27.6712' },
  { name: 'Constanța',        country: 'Romania',     bbox: '44.1340,28.5700,44.2340,28.7000' },
  { name: 'Craiova',          country: 'Romania',     bbox: '44.2800,23.7200,44.3900,23.8800' },
  { name: 'Brașov',           country: 'Romania',     bbox: '45.6200,25.5200,45.7200,25.6500' },
  { name: 'Galați',           country: 'Romania',     bbox: '45.3900,27.9300,45.4900,28.0900' },
  // ── Moldova ──────────────────────────────────────────────────────────────────
  { name: 'Chișinău',         country: 'Moldova',     bbox: '46.9317,28.7570,47.0856,28.9869' },
  { name: 'Bălți',            country: 'Moldova',     bbox: '47.7286,27.8596,47.8286,27.9996' },
  { name: 'Tiraspol',         country: 'Moldova',     bbox: '46.8200,29.6000,46.9200,29.7000' },
  // ── Uzbekistan ───────────────────────────────────────────────────────────────
  { name: 'Tashkent',         country: 'Uzbekistan',  bbox: '41.1800,69.1200,41.4200,69.4800' },
  { name: 'Samarkand',        country: 'Uzbekistan',  bbox: '39.5700,66.9000,39.7700,67.1500' },
  { name: 'Bukhara',          country: 'Uzbekistan',  bbox: '39.7000,64.3500,39.8600,64.5700' },
  { name: 'Namangan',         country: 'Uzbekistan',  bbox: '40.9700,71.5500,41.0700,71.7400' },
  { name: 'Andijan',          country: 'Uzbekistan',  bbox: '40.7400,72.2800,40.8600,72.4700' },
  // ── Kazakhstan ───────────────────────────────────────────────────────────────
  { name: 'Almaty',           country: 'Kazakhstan',  bbox: '43.1200,76.6800,43.4700,77.1700' },
  { name: 'Astana',           country: 'Kazakhstan',  bbox: '51.0600,71.3000,51.2800,71.5900' },
  { name: 'Shymkent',         country: 'Kazakhstan',  bbox: '42.2300,69.4300,42.4700,69.7900' },
  { name: 'Karaganda',        country: 'Kazakhstan',  bbox: '49.7300,73.0000,49.9500,73.3000' },
  { name: 'Aktobe',           country: 'Kazakhstan',  bbox: '50.2000,57.1000,50.3600,57.3000' },
  // ── Kyrgyzstan ───────────────────────────────────────────────────────────────
  { name: 'Bishkek',          country: 'Kyrgyzstan',  bbox: '42.7900,74.5000,43.0300,74.8800' },
  { name: 'Osh',              country: 'Kyrgyzstan',  bbox: '40.4600,72.6900,40.6900,72.9700' },
  // ── Georgia ───────────────────────────────────────────────────────────────────
  { name: 'Tbilisi',          country: 'Georgia',     bbox: '41.6200,44.7000,41.8300,44.9900' },
  { name: 'Batumi',           country: 'Georgia',     bbox: '41.5800,41.6100,41.6800,41.7500' },
  { name: 'Kutaisi',          country: 'Georgia',     bbox: '42.2200,42.6200,42.3300,42.8000' },
  // ── Bulgaria ─────────────────────────────────────────────────────────────────
  { name: 'Sofia',            country: 'Bulgaria',    bbox: '42.6100,23.2000,42.7900,23.4600' },
  { name: 'Plovdiv',          country: 'Bulgaria',    bbox: '42.0700,24.6100,42.2700,24.8600' },
  { name: 'Varna',            country: 'Bulgaria',    bbox: '43.1400,27.8100,43.3100,28.0300' },
  { name: 'Burgas',           country: 'Bulgaria',    bbox: '42.4200,27.3700,42.5900,27.6000' },
  { name: 'Stara Zagora',     country: 'Bulgaria',    bbox: '42.4000,25.5800,42.5000,25.7300' },
  // ── Montenegro ───────────────────────────────────────────────────────────────
  { name: 'Podgorica',        country: 'Montenegro',  bbox: '42.3900,19.1600,42.5200,19.3600' },
  { name: 'Budva',            country: 'Montenegro',  bbox: '42.2400,18.7600,42.3300,18.9100' },
  // ── Serbia ───────────────────────────────────────────────────────────────────
  { name: 'Belgrade',         country: 'Serbia',      bbox: '44.6800,20.3400,44.9400,20.5900' },
  { name: 'Novi Sad',         country: 'Serbia',      bbox: '45.2000,19.7600,45.3600,20.0200' },
  { name: 'Niš',              country: 'Serbia',      bbox: '43.2700,21.8200,43.4100,22.0600' },
  { name: 'Kragujevac',       country: 'Serbia',      bbox: '43.9900,20.8600,44.1000,21.0400' },
  // ── Spain ────────────────────────────────────────────────────────────────────
  { name: 'Madrid',           country: 'Spain',       bbox: '40.2800,-3.8100,40.6400,-3.5000' },
  { name: 'Barcelona',        country: 'Spain',       bbox: '41.2800,2.0300,41.5000,2.2900' },
  { name: 'Valencia',         country: 'Spain',       bbox: '39.3800,-0.4800,39.5400,-0.2800' },
  { name: 'Seville',          country: 'Spain',       bbox: '37.3000,-6.1200,37.4700,-5.8600' },
  { name: 'Bilbao',           country: 'Spain',       bbox: '43.2000,-3.1300,43.3500,-2.8500' },
  { name: 'Zaragoza',         country: 'Spain',       bbox: '41.5600,-1.0700,41.7400,-0.7800' },
  { name: 'Málaga',           country: 'Spain',       bbox: '36.6400,-4.6400,36.7800,-4.3500' },
  { name: 'Alicante',         country: 'Spain',       bbox: '38.3200,-0.5700,38.4200,-0.4200' },
  // ── Germany ──────────────────────────────────────────────────────────────────
  { name: 'Berlin',           country: 'Germany',     bbox: '52.3200,13.0600,52.7000,13.8000' },
  { name: 'Munich',           country: 'Germany',     bbox: '48.0200,11.3400,48.2700,11.7500' },
  { name: 'Hamburg',          country: 'Germany',     bbox: '53.3800,9.6400,53.7400,10.4000' },
  { name: 'Frankfurt',        country: 'Germany',     bbox: '50.0000,8.5400,50.2300,8.8200' },
  { name: 'Cologne',          country: 'Germany',     bbox: '50.8200,6.7600,51.0900,7.1800' },
  { name: 'Stuttgart',        country: 'Germany',     bbox: '48.6400,9.0100,48.8800,9.3600' },
  { name: 'Düsseldorf',       country: 'Germany',     bbox: '51.1000,6.6900,51.3500,6.9600' },
  { name: 'Dresden',          country: 'Germany',     bbox: '50.9900,13.5900,51.1600,13.9100' },
  { name: 'Leipzig',          country: 'Germany',     bbox: '51.2600,12.2400,51.4300,12.5300' },
  { name: 'Hannover',         country: 'Germany',     bbox: '52.3100,9.6600,52.4800,9.9200' },
  { name: 'Nuremberg',        country: 'Germany',     bbox: '49.3800,11.0000,49.5200,11.2000' },
  { name: 'Bremen',           country: 'Germany',     bbox: '52.9900,8.6900,53.1600,9.0000' },
  // ── Poland ───────────────────────────────────────────────────────────────────
  { name: 'Warsaw',           country: 'Poland',      bbox: '52.0700,20.8400,52.4100,21.3100' },
  { name: 'Kraków',           country: 'Poland',      bbox: '49.9400,19.7900,50.1600,20.1400' },
  { name: 'Gdańsk',           country: 'Poland',      bbox: '54.2700,18.4400,54.4900,18.8100' },
  { name: 'Wrocław',          country: 'Poland',      bbox: '51.0200,16.8300,51.2300,17.1600' },
  { name: 'Poznań',           country: 'Poland',      bbox: '52.2900,16.6900,52.5100,17.1100' },
  { name: 'Łódź',             country: 'Poland',      bbox: '51.6700,19.2900,51.8900,19.6100' },
  { name: 'Katowice',         country: 'Poland',      bbox: '50.1800,18.9400,50.3100,19.1600' },
  { name: 'Lublin',           country: 'Poland',      bbox: '51.1400,22.5100,51.2600,22.6900' },
  { name: 'Szczecin',         country: 'Poland',      bbox: '53.3700,14.4000,53.5200,14.6500' },
  { name: 'Białystok',        country: 'Poland',      bbox: '53.0700,23.0500,53.1900,23.2500' },
  // ── USA ──────────────────────────────────────────────────────────────────────
  { name: 'New York',         country: 'USA',         bbox: '40.4770,-74.2590,40.9180,-73.7000' },
  { name: 'Los Angeles',      country: 'USA',         bbox: '33.7000,-118.6700,34.3400,-118.1500' },
  { name: 'Chicago',          country: 'USA',         bbox: '41.6450,-87.9400,42.0230,-87.5240' },
  { name: 'Houston',          country: 'USA',         bbox: '29.5230,-95.7900,30.1100,-95.0000' },
  { name: 'Philadelphia',     country: 'USA',         bbox: '39.8670,-75.2800,40.1380,-74.9550' },
  { name: 'Phoenix',          country: 'USA',         bbox: '33.2900,-112.3200,33.7500,-111.9200' },
  { name: 'San Antonio',      country: 'USA',         bbox: '29.2800,-98.6800,29.5700,-98.3500' },
  { name: 'Dallas',           country: 'USA',         bbox: '32.6200,-97.0500,33.0200,-96.5500' },
  { name: 'San Francisco',    country: 'USA',         bbox: '37.6980,-122.5100,37.8300,-122.3700' },
  { name: 'Seattle',          country: 'USA',         bbox: '47.4900,-122.4500,47.7300,-122.2200' },
  { name: 'Boston',           country: 'USA',         bbox: '42.2200,-71.2000,42.4200,-70.9000' },
  { name: 'Miami',            country: 'USA',         bbox: '25.6400,-80.4500,25.9600,-80.1000' },
  { name: 'Washington DC',    country: 'USA',         bbox: '38.7900,-77.1200,38.9900,-76.9000' },
  { name: 'Atlanta',          country: 'USA',         bbox: '33.6400,-84.5600,33.9000,-84.2400' },
  { name: 'Denver',           country: 'USA',         bbox: '39.6140,-105.1100,39.8500,-104.7600' },
  // ── Great Britain ─────────────────────────────────────────────────────────────
  { name: 'London',           country: 'Great Britain', bbox: '51.2800,-0.5500,51.7000,0.2400' },
  { name: 'Manchester',       country: 'Great Britain', bbox: '53.3500,-2.4500,53.6000,-1.9500' },
  { name: 'Birmingham',       country: 'Great Britain', bbox: '52.3700,-2.0200,52.5700,-1.7400' },
  { name: 'Glasgow',          country: 'Great Britain', bbox: '55.7800,-4.4000,55.9800,-4.0500' },
  { name: 'Edinburgh',        country: 'Great Britain', bbox: '55.8700,-3.4000,56.0200,-3.0500' },
  { name: 'Leeds',            country: 'Great Britain', bbox: '53.7100,-1.7500,53.8700,-1.4200' },
  { name: 'Liverpool',        country: 'Great Britain', bbox: '53.3500,-3.0500,53.4800,-2.8100' },
  { name: 'Sheffield',        country: 'Great Britain', bbox: '53.3400,-1.5900,53.4600,-1.3600' },
  { name: 'Bristol',          country: 'Great Britain', bbox: '51.3800,-2.6700,51.5300,-2.5000' },
  { name: 'Cardiff',          country: 'Great Britain', bbox: '51.4500,-3.3100,51.5600,-3.1100' },
];

// ─── Manual entries: private clinic networks & online platforms ───────────────
// These don't appear reliably in OSM — added explicitly.

interface ManualEntry {
  id: string;
  name: string;
  speciality: string;
  country: string;
  city: string;
  phone?: string;
  address?: string;
  isFree?: boolean;
  cost?: string;   // price range / description
  notes?: string;
}

const MANUAL_ENTRIES: ManualEntry[] = [
  // Ukraine — private clinic chains
  { id: 'dc-manual-dobrobut-ua',     name: 'Добробут',              speciality: 'Clinic',       country: 'Ukraine',     city: 'Kyiv',              isFree: false, cost: 'від 500 грн / consultation',  notes: 'Private multi-specialty clinic chain | Web: dobrobut.com' },
  { id: 'dc-manual-boris-ua',        name: 'Борис (BORIS)',         speciality: 'Hospital',     country: 'Ukraine',     city: 'Kyiv',              isFree: false, cost: 'від 700 грн / consultation',  notes: 'Private hospital | Web: borismedical.com' },
  { id: 'dc-manual-feofaniya-ua',    name: 'Феофанія',              speciality: 'Hospital',     country: 'Ukraine',     city: 'Kyiv',              isFree: false, notes: 'Clinical hospital with wide specialities | Web: feofaniya.com' },
  { id: 'dc-manual-onclinic-ua',     name: 'OnClinic Ukraine',      speciality: 'Clinic',       country: 'Ukraine',     city: 'Kyiv',              isFree: false, cost: 'від 400 грн / visit',         notes: 'Private clinic network | Web: onclinic.ua' },
  { id: 'dc-manual-oberig-ua',       name: 'Oberig Medical Center', speciality: 'Clinic',       country: 'Ukraine',     city: 'Kyiv',              isFree: false, notes: 'Private medical center | Web: oberig.com.ua' },
  { id: 'dc-manual-medicover-ua',    name: 'Medicover Ukraine',     speciality: 'Clinic',       country: 'Ukraine',     city: 'Kyiv',              isFree: false, cost: 'від 800 грн / visit',         notes: 'International private clinic | Web: medicover.ua' },
  // Ukraine — online platforms
  { id: 'dc-online-doc-ua',          name: 'DOC.UA',                speciality: 'Clinic',       country: 'Ukraine',     city: 'Online',            isFree: false, cost: 'від 300 грн / консультація',  notes: 'Online doctor booking platform | Web: doc.ua' },
  { id: 'dc-online-helsi-ua',        name: 'Helsi',                 speciality: 'Clinic',       country: 'Ukraine',     city: 'Online',            isFree: false, notes: 'Online appointment booking | Web: helsi.me' },
  { id: 'dc-online-likar-ua',        name: 'Likar.info',            speciality: 'Clinic',       country: 'Ukraine',     city: 'Online',            isFree: false, notes: 'Doctor search & appointments | Web: likar.info' },
  // Russia — private clinic chains
  { id: 'dc-manual-medsi-ru',        name: 'МЕДСИ',                 speciality: 'Clinic',       country: 'Russia',      city: 'Moscow',            isFree: false, cost: 'от 1 500 ₽ / приём',          notes: 'Private multi-specialty clinic chain | Web: medsi.ru' },
  { id: 'dc-manual-smclinic-ru',     name: 'СМ-Клиника',            speciality: 'Clinic',       country: 'Russia',      city: 'Moscow',            isFree: false, cost: 'от 1 200 ₽ / приём',          notes: 'Private clinic chain | Web: smclinic.ru' },
  { id: 'dc-manual-emc-ru',          name: 'Европейский Медицинский Центр', speciality: 'Hospital', country: 'Russia', city: 'Moscow',            isFree: false, cost: 'от 3 500 ₽ / консультация',   notes: 'Premium private hospital | Web: emcmos.ru' },
  { id: 'dc-manual-invitro-ru',      name: 'Инвитро',               speciality: 'Clinic',       country: 'Russia',      city: 'Moscow',            isFree: false, cost: 'от 200 ₽ / анализ',           notes: 'Lab & diagnostics network | Web: invitro.ru' },
  // Russia — online platforms
  { id: 'dc-online-sberhealth-ru',   name: 'СберЗдоровье',          speciality: 'Clinic',       country: 'Russia',      city: 'Online',            isFree: false, cost: 'от 500 ₽ / консультация',     notes: 'Online telemedicine platform | Web: sberzdorovie.ru' },
  { id: 'dc-online-docdoc-ru',       name: 'DocDoc.ru',             speciality: 'Clinic',       country: 'Russia',      city: 'Online',            isFree: false, cost: 'от 400 ₽ / консультация',     notes: 'Doctor search & online appointments | Web: docdoc.ru' },
  { id: 'dc-online-yandexhealth-ru', name: 'Яндекс Здоровье',       speciality: 'Clinic',       country: 'Russia',      city: 'Online',            isFree: false, cost: 'от 499 ₽ / консультация',     notes: 'Online doctor consultations | Web: health.yandex.ru' },
  // Turkey — private hospital chains
  { id: 'dc-manual-acibadem-tr',     name: 'Acıbadem Hospitals',    speciality: 'Hospital',     country: 'Turkey',      city: 'Istanbul',          isFree: false, cost: '300–1 500 TRY / consultation', notes: 'Premium private hospital chain | Web: acibadem.com.tr' },
  { id: 'dc-manual-memorial-tr',     name: 'Memorial Hospital',     speciality: 'Hospital',     country: 'Turkey',      city: 'Istanbul',          isFree: false, cost: '300–1 200 TRY / consultation', notes: 'Private hospital chain | Web: memorial.com.tr' },
  { id: 'dc-manual-medicana-tr',     name: 'Medicana Hospitals',    speciality: 'Hospital',     country: 'Turkey',      city: 'Istanbul',          isFree: false, cost: '200–1 000 TRY / consultation', notes: 'Private hospital chain | Web: medicana.com.tr' },
  { id: 'dc-manual-florence-tr',     name: 'Florence Nightingale',  speciality: 'Hospital',     country: 'Turkey',      city: 'Istanbul',          isFree: false, notes: 'Private hospital | Web: fnhastanesi.com.tr' },
  { id: 'dc-online-doktita-tr',      name: 'Doktita',               speciality: 'Clinic',       country: 'Turkey',      city: 'Online',            isFree: false, cost: '150–500 TRY / görüşme',        notes: 'Online doctor platform | Web: doktita.com' },
  // Germany
  { id: 'dc-manual-helios-de',       name: 'Helios Kliniken',       speciality: 'Hospital',     country: 'Germany',     city: 'Berlin',            isFree: false, notes: 'Large private hospital chain | Web: helios-gesundheit.de' },
  { id: 'dc-manual-asklepios-de',    name: 'Asklepios Kliniken',    speciality: 'Hospital',     country: 'Germany',     city: 'Hamburg',           isFree: false, notes: 'Private hospital network | Web: asklepios.com' },
  { id: 'dc-online-doctolib-de',     name: 'Doctolib Germany',      speciality: 'Clinic',       country: 'Germany',     city: 'Online',            isFree: false, notes: 'Doctor appointment platform | Web: doctolib.de' },
  { id: 'dc-online-jameda-de',       name: 'Jameda',                speciality: 'Clinic',       country: 'Germany',     city: 'Online',            isFree: false, notes: 'Doctor search & reviews | Web: jameda.de' },
  // Poland
  { id: 'dc-manual-lux-pl',          name: 'LUX MED',               speciality: 'Clinic',       country: 'Poland',      city: 'Warsaw',            isFree: false, cost: '100–400 PLN / wizyta',         notes: 'Private healthcare chain | Web: luxmed.pl' },
  { id: 'dc-manual-medicover-pl',    name: 'Medicover Poland',      speciality: 'Clinic',       country: 'Poland',      city: 'Warsaw',            isFree: false, cost: '120–350 PLN / wizyta',         notes: 'International private clinic | Web: medicover.pl' },
  // Spain
  { id: 'dc-manual-quiron-es',       name: 'Quirónsalud',           speciality: 'Hospital',     country: 'Spain',       city: 'Madrid',            isFree: false, cost: '60–200 EUR / visita',          notes: 'Private hospital chain | Web: quironsalud.es' },
  { id: 'dc-manual-sanitas-es',      name: 'Sanitas',               speciality: 'Clinic',       country: 'Spain',       city: 'Madrid',            isFree: false, cost: '50–150 EUR / consulta',        notes: 'Private healthcare & insurance | Web: sanitas.es' },
  { id: 'dc-online-doctolib-es',     name: 'Doctolib Spain',        speciality: 'Clinic',       country: 'Spain',       city: 'Online',            isFree: false, notes: 'Doctor appointment platform | Web: doctolib.es' },
  // Great Britain
  { id: 'dc-manual-bupa-gb',         name: 'Bupa Health Clinics',   speciality: 'Clinic',       country: 'Great Britain', city: 'London',          isFree: false, cost: '£80–250 / consultation',      notes: 'Private healthcare chain | Web: bupa.co.uk' },
  { id: 'dc-manual-nuffield-gb',     name: 'Nuffield Health',       speciality: 'Hospital',     country: 'Great Britain', city: 'London',          isFree: false, cost: '£100–300 / consultation',     notes: 'Private hospital & clinic chain | Web: nuffieldhealth.com' },
  { id: 'dc-online-pushdoctor-gb',   name: 'Push Doctor',           speciality: 'Clinic',       country: 'Great Britain', city: 'Online',          isFree: false, cost: '£20–50 / session',            notes: 'Online GP platform | Web: pushdoctor.co.uk' },
  { id: 'dc-online-babylon-gb',      name: 'Babylon Health',        speciality: 'Clinic',       country: 'Great Britain', city: 'Online',          isFree: false, notes: 'AI-powered online consultations | Web: babylonhealth.com' },
  // USA
  { id: 'dc-manual-mayo-us',         name: 'Mayo Clinic',           speciality: 'Hospital',     country: 'USA',         city: 'Rochester, MN',     isFree: false, notes: 'World-renowned medical center | Web: mayoclinic.org' },
  { id: 'dc-manual-clevelandclinic-us', name: 'Cleveland Clinic',   speciality: 'Hospital',     country: 'USA',         city: 'Cleveland, OH',     isFree: false, notes: 'Top-ranked hospital system | Web: clevelandclinic.org' },
  { id: 'dc-online-teladoc-us',      name: 'Teladoc Health',        speciality: 'Clinic',       country: 'USA',         city: 'Online',            isFree: false, cost: '$75–299 / visit',             notes: 'Telemedicine platform | Web: teladoc.com' },
  { id: 'dc-online-zocdoc-us',       name: 'ZocDoc',                speciality: 'Clinic',       country: 'USA',         city: 'Online',            isFree: false, notes: 'Doctor search & booking | Web: zocdoc.com' },
  { id: 'dc-online-mdlive-us',       name: 'MDLIVE',                speciality: 'Clinic',       country: 'USA',         city: 'Online',            isFree: false, cost: '$82–284 / visit',             notes: 'Online doctor & therapy | Web: mdlive.com' },
  // Psychological help — online platforms (international)
  { id: 'dc-online-betterhelp',      name: 'BetterHelp',            speciality: 'Psychologist', country: 'International', city: 'Online',          isFree: false, cost: '$60–100 / week (subscription)', notes: 'Online therapy platform | Web: betterhelp.com' },
  { id: 'dc-online-talkspace',       name: 'Talkspace',             speciality: 'Psychologist', country: 'International', city: 'Online',          isFree: false, cost: '$69–109 / week',              notes: 'Online therapy & psychiatry | Web: talkspace.com' },
  { id: 'dc-online-iampsycho-ua',    name: 'iAmPsycho',             speciality: 'Psychologist', country: 'Ukraine',     city: 'Online',            isFree: false, cost: 'від 800 грн / сесія',         notes: 'Ukrainian online psychology platform | Web: iampsycho.ua' },
  { id: 'dc-online-zigmund-ru',      name: 'Zigmund.Online',        speciality: 'Psychologist', country: 'Russia',      city: 'Online',            isFree: false, cost: 'от 2 500 ₽ / сессия',         notes: 'Online psychotherapy | Web: zigmund.online' },
  { id: 'dc-online-wunderhood-ru',   name: 'Wunderkind (psych)',    speciality: 'Psychologist', country: 'Russia',      city: 'Online',            isFree: false, notes: 'Child & family psychology online | Web: wunderkind.online' },
  // Kazakhstan & Central Asia
  { id: 'dc-manual-oleainvivo-kz',   name: 'Olea InVivo',           speciality: 'Clinic',       country: 'Kazakhstan',  city: 'Almaty',            isFree: false, notes: 'Private multi-specialty clinic | Web: oleainvivo.kz' },
  { id: 'dc-manual-central-uz',      name: 'Центральная клиника',   speciality: 'Hospital',     country: 'Uzbekistan',  city: 'Tashkent',          isFree: false, notes: 'Central clinical hospital of Tashkent' },
];

// ─── OSM data types ───────────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags: Record<string, string>;
}

// ─── Tag helpers ──────────────────────────────────────────────────────────────

function getSpeciality(tags: Record<string, string>): string {
  const rawSpec = (tags['healthcare:speciality'] ?? tags['speciality'] ?? '').toLowerCase().trim();
  if (rawSpec) {
    const mapped = OSM_TO_SPECIALITY[rawSpec];
    if (mapped) return mapped;
    const first = rawSpec.split(';')[0].trim();
    if (OSM_TO_SPECIALITY[first]) return OSM_TO_SPECIALITY[first];
  }
  const amenity = (tags['amenity'] ?? tags['healthcare'] ?? '').toLowerCase();
  if (amenity === 'hospital')  return 'Hospital';
  if (amenity === 'clinic')    return 'Clinic';
  if (amenity === 'dentist')   return 'Dentist';
  if (amenity === 'doctors')   return 'Therapist';
  if (amenity === 'doctor')    return 'Therapist';
  if (amenity === 'pharmacy')  return 'Clinic';
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
  return tags['name'] ?? tags['name:en'] ?? null;
}

/**
 * Returns true if the facility is free, false if paid, null if unknown.
 * OSM tags: fee=no → free, fee=yes → paid, access=free → free.
 */
function getIsFree(tags: Record<string, string>): boolean | null {
  const fee = (tags['fee'] ?? '').toLowerCase();
  if (fee === 'no')  return true;   // fee=no means no charge
  if (fee === 'yes') return false;  // fee=yes means costs money
  if ((tags['access'] ?? '').toLowerCase() === 'free') return true;
  return null;
}

/**
 * Returns a cost string from OSM charge/price tags, or null if absent.
 * Common tags: charge="10 EUR", fee:amount="5", healthcare:fee="consult 20 PLN".
 */
function getCost(tags: Record<string, string>): string | null {
  return (
    tags['charge'] ??
    tags['fee:amount'] ??
    tags['healthcare:fee'] ??
    tags['price'] ??
    null
  );
}

function getNotes(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  if (tags['opening_hours']) parts.push(`Hours: ${tags['opening_hours']}`);
  if (tags['website'] ?? tags['contact:website'])
    parts.push(`Web: ${tags['website'] ?? tags['contact:website']}`);
  if (tags['beds']) parts.push(`Beds: ${tags['beds']}`);
  if (tags['operator:type']) parts.push(tags['operator:type'] === 'public' ? 'Public' : 'Private');
  return parts.length > 0 ? parts.join(' | ') : null;
}

// ─── Overpass query ───────────────────────────────────────────────────────────

async function queryCity(city: City): Promise<OsmElement[]> {
  const query = `[out:json][timeout:120];
(
  node["amenity"~"^(hospital|clinic|doctors|dentist)$"]["name"](${city.bbox});
  way["amenity"~"^(hospital|clinic|doctors|dentist)$"]["name"](${city.bbox});
  node["healthcare"]["name"](${city.bbox});
  way["healthcare"]["name"](${city.bbox});
);
out center tags;`;

  const delays = [60_000, 120_000]; // wait 60s then 120s on 429
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (resp.status === 429) {
      if (attempt < delays.length) {
        const wait = delays[attempt];
        console.log(`[scraper] 429 rate limit — waiting ${wait / 1000}s before retry…`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw new Error('Overpass HTTP 429 (rate limited, giving up)');
    }
    if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
    const json = await resp.json() as { elements?: OsmElement[] };
    return json.elements ?? [];
  }
  return [];
}

// ─── DB upserts ───────────────────────────────────────────────────────────────

async function upsertOsm(pool: pg.Pool, city: City, el: OsmElement): Promise<boolean> {
  const tags = el.tags;
  const name = getName(tags);
  if (!name?.trim()) return false;

  const id         = `dc-osm-${el.type}-${el.id}`;
  const speciality = getSpeciality(tags);
  const address    = getAddress(tags);
  const cityName   = tags['addr:city'] ?? city.name;
  const country    = tags['addr:country'] ?? city.country;
  const phone      = getPhone(tags);
  const isFree     = getIsFree(tags);
  const cost       = getCost(tags);
  const notes      = getNotes(tags);
  const blob       = [name, speciality, cityName, country, address].filter(Boolean).join(' ');
  const now        = new Date().toISOString();

  await pool.query(
    `INSERT INTO doctors_catalog
       (id, name, speciality, phone, address, city, country, is_free, cost, notes, contributed_at, search_blob)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, speciality=$3, phone=$4, address=$5, city=$6,
       country=$7, is_free=$8, cost=$9, notes=$10, search_blob=$12`,
    [id, name, speciality, phone, address, cityName, country, isFree, cost, notes, now, blob],
  );
  return true;
}

async function upsertManual(pool: pg.Pool, entry: ManualEntry): Promise<void> {
  const blob = [entry.name, entry.speciality, entry.city, entry.country, entry.address]
    .filter(Boolean).join(' ');
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO doctors_catalog
       (id, name, speciality, phone, address, city, country, is_free, cost, notes, contributed_at, search_blob)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, speciality=$3, phone=$4, city=$6, country=$7,
       is_free=$8, cost=$9, notes=$10, search_blob=$12`,
    [
      entry.id, entry.name, entry.speciality,
      entry.phone ?? null, entry.address ?? null,
      entry.city, entry.country,
      entry.isFree ?? null, entry.cost ?? null,
      entry.notes ?? null, now, blob,
    ],
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ScrapeResult { inserted: number; skipped: number; }

/**
 * Runs the full scrape (manual entries + OSM). Accepts a pg.Pool so it can be
 * called from the scheduler without spawning a new process or connection pool.
 * Safe to await in the Express server — all work is async I/O, non-blocking.
 */
export async function runScrape(pool: pg.Pool): Promise<ScrapeResult> {
  console.log('[scraper] Starting — manual entries + OSM');

  // 0. Pick a reachable Overpass mirror
  await pickMirror();
  console.log(`[scraper] Using Overpass mirror: ${OVERPASS_URL}`);

  // 1. Manual entries
  let manualInserted = 0;
  for (const entry of MANUAL_ENTRIES) {
    try { await upsertManual(pool, entry); manualInserted++; }
    catch (e) { console.error(`  [scraper] ✗ ${entry.name}:`, e); }
  }
  console.log(`[scraper] Manual entries: ${manualInserted} seeded`);

  // 2. OSM per city
  let inserted = 0, skipped = 0;
  for (const city of CITIES) {
    try {
      process.stdout.write(`[scraper] ${city.name}, ${city.country} ... `);
      const elements = await queryCity(city);
      process.stdout.write(`${elements.length} found → `);

      let saved = 0;
      for (const el of elements) {
        try {
          if (await upsertOsm(pool, city, el)) { saved++; inserted++; } else skipped++;
        } catch { skipped++; }
      }
      console.log(`${saved} saved`);

      await new Promise(r => setTimeout(r, 10_000)); // Overpass rate limit — 10s between cities
    } catch (err) {
      console.error(`[scraper] ✗ ${(err as Error).message}`);
    }
  }

  console.log(`[scraper] Done. Manual: ${manualInserted}, OSM inserted: ${inserted}, skipped: ${skipped}`);
  return { inserted: manualInserted + inserted, skipped };
}

// ─── CLI entry-point ──────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('scrapeHospitals.ts') ||
    process.argv[1]?.endsWith('scrapeHospitals.js')) {
  const DB_URL = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/medikit';
  const cliPool = new pg.Pool({ connectionString: DB_URL });
  console.log('🏥  MediKit hospital scraper — OpenStreetMap + manual entries\n');
  runScrape(cliPool)
    .then(r => {
      console.log(`\n✅  Total OSM saved: ${r.inserted}, skipped: ${r.skipped}`);
      return cliPool.end();
    })
    .catch(err => { console.error(err); process.exit(1); });
}
