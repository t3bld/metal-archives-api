import { chromium } from "playwright";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;
const BD_WS = process.env.BRIGHTDATA_WS_ENDPOINT;
const BRIGHTDATA_ENABLED = process.env.BRIGHTDATA_ENABLED === "true";

const LOCAL_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
const LOCAL_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Shared browser + page used by browserFetch (search/AJAX calls).
let sharedBrowser = null;
let sharedPage = null;

// Initialise the shared page. When using BrightData, no warm-up is needed —
// BrightData handles Cloudflare transparently at the infrastructure level.
// Locally, we warm up on browse/bands first so Cloudflare issues cf_clearance.
async function ensureSession() {
  if (sharedPage) return sharedPage;
  const { browser, context } = await createBrowser();
  sharedBrowser = browser;
  sharedPage = await context.newPage();
  if (!BRIGHTDATA_ENABLED) {
    await sharedPage.goto(`${BASE}/browse/bands`, { waitUntil: "load", timeout: 120_000 });
    await sharedPage.waitForTimeout(3000);
  }
  return sharedPage;
}

export async function closeBrowserSession() {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
    sharedPage = null;
  }
}

// Fetch via page.goto() so all requests route through BrightData's network.
// BrightData CDP forbids overriding Accept / X-Requested-With — no custom headers.
export async function browserFetch(url) {
  const p = await ensureSession();
  const response = await p.goto(url.toString(), { waitUntil: "load", timeout: 60_000 });
  if (!response.ok()) throw new Error(`HTTP ${response.status()} ${response.statusText()}`);
  return response.json();
}

// Creates a browser + context for use by individual page scrapers.
// When BRIGHTDATA_WS_ENDPOINT is set, connects to BrightData's Scraping Browser
// via CDP — Cloudflare is handled transparently at the infrastructure level.
// Without it, launches a local headless Chromium (dev only).
export async function createBrowser() {
  if (BRIGHTDATA_ENABLED && BD_WS) {
    const browser = await chromium.connectOverCDP(BD_WS);
    const context = await browser.newContext();
    return { browser, context };
  }
  const browser = await chromium.launch({ headless: true, args: LOCAL_ARGS });
  const context = await browser.newContext({ userAgent: LOCAL_UA });
  return { browser, context };
}
