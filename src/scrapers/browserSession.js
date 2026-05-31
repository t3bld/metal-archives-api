import { chromium } from "playwright";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;

let browser = null;
let page = null;

// Navigate to a real browse page so Cloudflare issues cf_clearance before any
// AJAX calls are made. The browse/bands path is known to load cleanly.
async function ensureSession() {
  if (page) return page;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`${BASE}/browse/bands`, { waitUntil: "networkidle", timeout: 60_000 });
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
