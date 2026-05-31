import "dotenv/config";
import { chromium } from "playwright";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;

export const COUNTRIES = {
  AD: "Andorra",
  AE: "United Arab Emirates",
  AF: "Afghanistan",
  AL: "Albania",
  AM: "Armenia",
  AO: "Angola",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  AW: "Aruba",
  AX: "Åland Islands",
  AZ: "Azerbaijan",
  BA: "Bosnia and Herzegovina",
  BB: "Barbados",
  BD: "Bangladesh",
  BE: "Belgium",
  BG: "Bulgaria",
  BH: "Bahrain",
  BN: "Brunei",
  BO: "Bolivia",
  BR: "Brazil",
  BW: "Botswana",
  BY: "Belarus",
  BZ: "Belize",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  CW: "Curaçao",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DE: "Germany",
  DK: "Denmark",
  DO: "Dominican Republic",
  DZ: "Algeria",
  EC: "Ecuador",
  EE: "Estonia",
  EG: "Egypt",
  ES: "Spain",
  ET: "Ethiopia",
  FI: "Finland",
  FO: "Faroe Islands",
  FR: "France",
  GB: "United Kingdom",
  GE: "Georgia",
  GG: "Guernsey",
  GI: "Gibraltar",
  GL: "Greenland",
  GR: "Greece",
  GT: "Guatemala",
  GU: "Guam",
  GY: "Guyana",
  HN: "Honduras",
  HR: "Croatia",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IM: "Isle of Man",
  IN: "India",
  IQ: "Iraq",
  IR: "Iran",
  IS: "Iceland",
  IT: "Italy",
  JE: "Jersey",
  JM: "Jamaica",
  JO: "Jordan",
  JP: "Japan",
  KE: "Kenya",
  KG: "Kyrgyzstan",
  KH: "Cambodia",
  KR: "Korea, South",
  KW: "Kuwait",
  KZ: "Kazakhstan",
  LA: "Laos",
  LB: "Lebanon",
  LI: "Liechtenstein",
  LK: "Sri Lanka",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  LY: "Libya",
  MA: "Morocco",
  MC: "Monaco",
  MD: "Moldova",
  ME: "Montenegro",
  MG: "Madagascar",
  MK: "Macedonia (FYROM)",
  MM: "Myanmar",
  MN: "Mongolia",
  MT: "Malta",
  MU: "Mauritius",
  MV: "Maldives",
  MX: "Mexico",
  MY: "Malaysia",
  MZ: "Mozambique",
  NA: "Namibia",
  NC: "New Caledonia",
  NI: "Nicaragua",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NZ: "New Zealand",
  OM: "Oman",
  PA: "Panama",
  PE: "Peru",
  PF: "French Polynesia",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PR: "Puerto Rico",
  PT: "Portugal",
  PY: "Paraguay",
  QA: "Qatar",
  RE: "Reunion",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  SA: "Saudi Arabia",
  SE: "Sweden",
  SG: "Singapore",
  SI: "Slovenia",
  SJ: "Svalbard",
  SK: "Slovakia",
  SM: "San Marino",
  SR: "Suriname",
  SV: "El Salvador",
  SY: "Syria",
  TH: "Thailand",
  TJ: "Tajikistan",
  TM: "Turkmenistan",
  TN: "Tunisia",
  TR: "Turkey",
  TT: "Trinidad and Tobago",
  TW: "Taiwan",
  UA: "Ukraine",
  UG: "Uganda",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VE: "Venezuela",
  VN: "Vietnam",
  XX: "International",
  ZA: "South Africa",
  ZZ: "Unknown",
};

const NAME_TO_ISO_CODE = Object.fromEntries(
  Object.entries(COUNTRIES).map(([code, name]) => [name.toLowerCase(), code])
);

const BASE_URL = `${BASE}/browse/ajax-country/c/{cid}/json/1/`;
const PAGE_SIZE = 500;

const NAME_RE = /<a href='([^']+)'>([^<]+)<\/a>/;
const STATUS_RE = /<span class="[^"]*">([^<]+)<\/span>/;
const BAND_ID_RE = /https:\/\/www\.metal-archives\.com\/bands\/[^/]+\/(\d+)/;

/**
 * Resolve a country code or name to { code, name }.
 * @param {string} value  ISO-2 code (e.g. "DE") or full name (e.g. "Germany")
 * @returns {{ code: string, name: string }}
 * @throws {Error} if the country cannot be found
 */
export function resolveCountry(value) {
  const upper = value.trim().toUpperCase();
  if (COUNTRIES[upper]) return { code: upper, name: COUNTRIES[upper] };

  const lower = value.trim().toLowerCase();
  if (NAME_TO_ISO_CODE[lower]) {
    const code = NAME_TO_ISO_CODE[lower];
    return { code, name: COUNTRIES[code] };
  }

  throw new Error(
    `Unknown country '${value}'. ` +
      "Pass a 2-letter ISO code (e.g. DE) or full country name (e.g. Germany)."
  );
}

/**
 * Scrape all bands for the given ISO-2 country code.
 * Launches a headless Chromium browser to pass the Cloudflare challenge,
 * then paginates through the AJAX endpoint inside the browser context.
 *
 * @param {string} countryCode  e.g. "DE"
 * @param {{ delay?: number, onPage?: (fetched: number, total: number|null) => void }} [options]
 * @returns {Promise<Array<{ name: string, id: string, genre: string, location: string, status: string, url: string }>>}
 */
export async function scrapeBands(countryCode, options = {}) {
  const { delay = 1000, onPage } = options;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the browse page — Cloudflare challenge is handled by the
    // real browser automatically before we reach networkidle.
    console.log("  Launching browser and passing Cloudflare challenge…");
    await page.goto(`${BASE}/browse/country`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });

    const bands = [];
    let displayStart = 0;

    while (true) {
      onPage?.(displayStart, null);

      const url = new URL(BASE_URL.replace("{cid}", countryCode));
      url.searchParams.set("sEcho", "1");
      url.searchParams.set("iDisplayStart", String(displayStart));
      url.searchParams.set("iDisplayLength", String(PAGE_SIZE));

      // Execute fetch inside the browser — all cookies (incl. cf_clearance)
      // are sent automatically since we're in the same browser session.
      const data = await page.evaluate(async (fetchUrl) => {
        const res = await fetch(fetchUrl, {
          headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }, url.toString());

      const total = data.iTotalRecords ?? 0;
      const rows = data.aaData ?? [];

      onPage?.(displayStart, total);

      for (const row of rows) {
        bands.push(parseRow(row));
      }

      displayStart += PAGE_SIZE;
      if (displayStart >= total) break;

      await sleep(delay);
    }

    return bands;
  } finally {
    await browser.close();
  }
}

function parseRow(row) {
  const nameMatch = NAME_RE.exec(row[0]);
  const statusMatch = STATUS_RE.exec(row[3]);

  const website = nameMatch ? nameMatch[1] : "";
  const name = nameMatch ? nameMatch[2] : row[0];
  const status = statusMatch ? statusMatch[1] : "";

  const bandIdMatch = BAND_ID_RE.exec(website);
  const id = bandIdMatch ? bandIdMatch[1] : "";

  return { name, id, genre: row[1], location: row[2], status, url: website };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
