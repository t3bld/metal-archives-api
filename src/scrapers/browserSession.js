import { chromium } from "playwright";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;
const BD_WS = process.env.BRIGHTDATA_WS_ENDPOINT;
const USE_BD = process.env.USE_BRIGHTDATA === "true";

const LOCAL_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
const LOCAL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Shared browser + page used by browserFetch (search/AJAX calls).
let sharedBrowser = null;
let sharedPage = null;

// Navigate to a real browse page so Cloudflare issues cf_clearance before any
// AJAX calls are made. The browse/bands path is known to load cleanly.
async function ensureSession() {
  if (sharedPage) return sharedPage;
  const { browser, context } = await createBrowser();
  sharedBrowser = browser;
  sharedPage = await context.newPage();
  await sharedPage.goto(`${BASE}/browse/bands`, { waitUntil: "load", timeout: 120_000 });
  if (!USE_BD) await sharedPage.waitForTimeout(3000);
  return sharedPage;
}

export async function closeBrowserSession() {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
    sharedPage = null;
  }
}

// Execute fetch from inside the browser so Cloudflare cookies are sent automatically.
export async function browserFetch(url, headers = {}) {
  const p = await ensureSession();
  return p.evaluate(
    async ({ fetchUrl, fetchHeaders }) => {
      const res = await fetch(fetchUrl, { headers: fetchHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res.json();
    },
    { fetchUrl: url.toString(), fetchHeaders: headers }
  );
}

// Creates a browser + context for use by individual page scrapers.
// When BRIGHTDATA_WS_ENDPOINT is set, connects to BrightData's Scraping Browser
// via CDP — Cloudflare is handled transparently at the infrastructure level.
// Without it, launches a local headless Chromium (dev only).
export async function createBrowser() {
  if (USE_BD && BD_WS) {
    const browser = await chromium.connectOverCDP(BD_WS);
    const context = await browser.newContext();
    return { browser, context };
  }
  const browser = await chromium.launch({ headless: true, args: LOCAL_ARGS });
  const context = await browser.newContext({ userAgent: LOCAL_UA });
  return { browser, context };
}
