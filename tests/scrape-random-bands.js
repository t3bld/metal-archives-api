/**
 * Random artist scrape test.
 *
 * Scrapes --count random artists (IDs 1–122000) and reports any failures.
 *
 * Usage:
 *   node tests/scrape-random-bands.js --count 10
 */

import { scrapeArtist } from "../src/scrapers/scrapeArtist.js";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const countIdx = args.indexOf("--count");
const count = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 5;

if (isNaN(count) || count < 1) {
  console.error("Usage: node tests/scrape-random-bands.js --count <number>");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randomId() {
  return String(Math.floor(Math.random() * 122_000) + 1);
}

function formatDuration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const ids = Array.from({ length: count }, randomId);

console.log(`\nTesting ${count} random band(s): ${ids.join(", ")}\n${"─".repeat(60)}`);

const results = [];

for (const id of ids) {
  const start = Date.now();
  process.stdout.write(`  Band ${id} … `);
  try {
    const band = await scrapeArtist({ id });
    const duration = formatDuration(Date.now() - start);

    if (!band.name) {
      console.log(`SKIP (${duration}) — band ID ${id} does not exist`);
      results.push({ id, ok: true, skipped: true, duration });
      continue;
    }

    // Basic sanity checks
    const warnings = [];
    if (!band.genres) warnings.push("missing genres");
    if (!band.discography) warnings.push("missing discography");

    if (warnings.length) {
      console.log(`WARN (${duration}) — ${band.name} [${warnings.join(", ")}]`);
    } else {
      console.log(`OK   (${duration}) — ${band.name}`);
    }
    results.push({ id, ok: true, name: band.name, duration, warnings });
  } catch (err) {
    const duration = formatDuration(Date.now() - start);
    console.log(`FAIL (${duration}) — ${err.message}`);
    results.push({ id, ok: false, error: err.message, duration });
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const passed = results.filter((r) => r.ok && !r.skipped && r.warnings?.length === 0);
const warned = results.filter((r) => r.ok && !r.skipped && r.warnings?.length > 0);
const skipped = results.filter((r) => r.skipped);
const failed = results.filter((r) => !r.ok);

console.log(`\n${"─".repeat(60)}`);
console.log(
  `Results: ${passed.length} OK  |  ${warned.length} WARN  |  ${failed.length} FAIL  |  ${skipped.length} SKIP (not found)  (of ${count})`
);

if (warned.length) {
  console.log("\nWarnings:");
  for (const r of warned) {
    console.log(`  Band ${r.id} (${r.name}): ${r.warnings.join(", ")}`);
  }
}

if (failed.length) {
  console.log("\nFailures:");
  for (const r of failed) {
    console.log(`  Band ${r.id}: ${r.error}`);
  }
  process.exit(1);
}
