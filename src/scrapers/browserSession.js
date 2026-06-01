import { chromium } from "playwright";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;
const BD_WS = process.env.BRIGHTDATA_WS_ENDPOINT;

let browser = null;
let page = null;

// When BRIGHTDATA_WS_ENDPOINT is set, connect to BrightData's Scraping Browser
// via CDP — it handles Cloudflare Bot Management on residential IPs.
// Without it, fall back to a local headless Chromium (works for local dev).
async function ensureSession() {
  if (page) return page;

  if (BD_WS) {
    browser = await chromium.connectOverCDP(BD_WS);
  } else {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }

  const context = BD_WS
    ? browser.contexts()[0] ?? (await browser.newContext())
    : await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      });

  page = await context.newPage();
  await page.goto(`${BASE}/browse/bands`, { waitUntil: "load", timeout: 120_000 });
  // Give Cloudflare challenge JS time to complete and set cookies
  if (!BD_WS) await page.waitForTimeout(3000);
  return page;
}

export async function closeBrowserSession() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

// Execute fetch from inside the browser so Cloudflare cookies are sent automatically.
export async function browserFetch(url, headers = {}) {
  const p = await ensureSession();
  const result = await p.evaluate(
    async ({ fetchUrl, fetchHeaders }) => {
      const res = await fetch(fetchUrl, { headers: fetchHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res.json();
    },
    { fetchUrl: url.toString(), fetchHeaders: headers }
  );
  return result;
}
