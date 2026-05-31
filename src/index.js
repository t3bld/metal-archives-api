import "dotenv/config";
import fs from "node:fs";
import { resolveCountry, scrapeBands } from "./scrapers/fetchArtistsByCountry.js";
import { scrapeArtist } from "./scrapers/scrapeArtist.js";
import { searchArtists, searchReleases, searchPersons, searchLabels } from "./scrapers/search.js";
import { scrapeRelease } from "./scrapers/scrapeRelease.js";
import { scrapePerson } from "./scrapers/scrapePerson.js";
import { scrapeLabel } from "./scrapers/scrapeLabel.js";
import {
  ensureConstraints,
  importArtist,
  importRelease,
  getPendingReleases,
  importPerson,
  getPendingPersons,
  importLabel,
  getPendingLabels,
  closeDriver,
} from "./model/index.js";

function parseArgs(argv) {
  const args = {
    country: null,
    artist: null,
    release: null,
    person: null,
    label: null,
    output: null,
    delay: 1,
    limit: 50,
    neo4j: false,
    releases: false,
    persons: false,
    labels: false,
  };

  const flags = {
    "--country": (v) => {
      args.country = v;
      return true;
    },
    "--artist": (v) => {
      args.artist = v;
      return true;
    },
    "--output": (v) => {
      args.output = v;
      return true;
    },
    "--delay": (v) => {
      args.delay = parseFloat(v);
      return true;
    },
    "--limit": (v) => {
      args.limit = parseInt(v, 10);
      return true;
    },
    "--neo4j": () => {
      args.neo4j = true;
      return false;
    },
    "--releases": (v) => {
      if (v && /^\d+$/.test(v)) {
        args.release = v;
        return true;
      }
      args.releases = true;
      return false;
    },
    "--persons": (v) => {
      if (v && /^\d+$/.test(v)) {
        args.person = v;
        return true;
      }
      args.persons = true;
      return false;
    },
    "--labels": (v) => {
      if (v && /^\d+$/.test(v)) {
        args.label = v;
        return true;
      }
      args.labels = true;
      return false;
    },
  };

  for (let i = 2; i < argv.length; i++) {
    const handle = flags[argv[i]];
    if (handle?.(argv[i + 1])) i++;
  }

  return args;
}

async function resolveId(raw, { entity, flag, searchFn, listRow, found }) {
  if (/^\d+$/.test(raw)) return raw;

  console.log(`Searching for ${entity}: "${raw}"…`);
  const results = await searchFn(raw);

  if (results.length === 0) {
    console.error(`No ${entity}s found for "${raw}".`);
    process.exit(1);
  }
  if (results.length > 1) {
    console.log(`Found ${results.length} matches. Use ${flag} <id> to scrape a specific one:\n`);
    for (const r of results) console.log(listRow(r));
    process.exit(0);
  }

  console.log(`Found: ${found(results[0])}`);
  return results[0].id;
}

async function persistAndOutput(args, detail, { importFn, label }) {
  if (args.neo4j) {
    console.log("  Persisting to Neo4j…");
    await ensureConstraints();
    await importFn(detail);
    console.log(`  [neo4j] ${label} saved.`);
    await closeDriver();
  }
  if (args.output) {
    fs.writeFileSync(args.output, JSON.stringify(detail, null, 2), "utf8");
    console.log(`Saved ${label.toLowerCase()} detail to '${args.output}'.`);
  } else if (!args.neo4j) {
    console.log(JSON.stringify(detail, null, 2));
  }
}

async function runQueue(args, { entity, getPendingFn, scrapeFn, importFn, displayName }) {
  console.log(`Fetching pending ${entity} URLs from Neo4j…`);
  await ensureConstraints();
  const pending = await getPendingFn(args.limit);

  if (pending.length === 0) {
    console.log(`  No pending ${entity}s found. Run --artist --neo4j first to populate stubs.`);
    await closeDriver();
    return;
  }

  console.log(`  Found ${pending.length} pending ${entity}(s). Scraping…`);
  let ok = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const detail = await scrapeFn({ id: item.id, url: item.url });
      await importFn(detail);
      console.log(`  OK  ${displayName(detail, item)}`);
      ok++;
    } catch (err) {
      console.error(`  FAIL ${item.url ?? item.id}: ${err.message}`);
      failed++;
    }
    if (args.delay > 0) await new Promise((r) => setTimeout(r, args.delay * 1_000));
  }

  console.log(`Done. ${ok} OK | ${failed} failed (of ${pending.length})`);
  await closeDriver();
}

async function handleArtist(args) {
  const id = await resolveId(args.artist, {
    entity: "artist",
    flag: "--artist",
    searchFn: searchArtists,
    listRow: (r) => `  ${r.id.padEnd(8)} ${r.name.padEnd(40)} ${r.genre} — ${r.country}`,
    found: (r) => `${r.name} (ID ${r.id})`,
  });

  console.log(`Scraping detail for artist ID: ${id}`);
  let detail;
  try {
    detail = await scrapeArtist({ id });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  await persistAndOutput(args, detail, { importFn: importArtist, label: "Artist" });
}

async function handleRelease(args) {
  const id = await resolveId(args.release, {
    entity: "release",
    flag: "--releases",
    searchFn: searchReleases,
    listRow: (r) => `  ${r.id.padEnd(8)} ${r.title.padEnd(40)} ${r.type} — ${r.artistName}`,
    found: (r) => `${r.title} by ${r.artistName} (ID ${r.id})`,
  });

  console.log(`Scraping detail for release ID: ${id}`);
  let detail;
  try {
    detail = await scrapeRelease({ id });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  await persistAndOutput(args, detail, { importFn: importRelease, label: "Release" });
}

async function handlePerson(args) {
  const id = await resolveId(args.person, {
    entity: "person",
    flag: "--persons",
    searchFn: searchPersons,
    listRow: (r) =>
      `  ${r.id.padEnd(8)} ${r.pseudonym.padEnd(30)} ${r.name ?? ""} — ${r.country ?? ""}`,
    found: (r) => `${r.pseudonym} (ID ${r.id})`,
  });

  console.log(`Scraping detail for person ID: ${id}`);
  let detail;
  try {
    detail = await scrapePerson({ id });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  await persistAndOutput(args, detail, { importFn: importPerson, label: "Person" });
}

async function handleLabel(args) {
  const id = await resolveId(args.label, {
    entity: "label",
    flag: "--labels",
    searchFn: searchLabels,
    listRow: (r) =>
      `  ${r.id.padEnd(8)} ${r.name.padEnd(40)} ${r.status ?? ""} — ${r.country ?? ""}`,
    found: (r) => `${r.name} (ID ${r.id})`,
  });

  console.log(`Scraping detail for label ID: ${id}`);
  let detail;
  try {
    detail = await scrapeLabel({ id });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  await persistAndOutput(args, detail, { importFn: importLabel, label: "Label" });
}

async function handleReleasesQueue(args) {
  await runQueue(args, {
    entity: "release",
    getPendingFn: getPendingReleases,
    scrapeFn: scrapeRelease,
    importFn: importRelease,
    displayName: (d, item) => d.title ?? item.url,
  });
}

async function handlePersonsQueue(args) {
  await runQueue(args, {
    entity: "person",
    getPendingFn: getPendingPersons,
    scrapeFn: scrapePerson,
    importFn: importPerson,
    displayName: (d, item) => d.pseudonym ?? item.url,
  });
}

async function handleLabelsQueue(args) {
  await runQueue(args, {
    entity: "label",
    getPendingFn: getPendingLabels,
    scrapeFn: scrapeLabel,
    importFn: importLabel,
    displayName: (d, item) => d.name ?? item.url,
  });
}

async function handleCountry(args) {
  let code, name;
  try {
    ({ code, name } = resolveCountry(args.country));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  console.log(`Scraping bands for: ${name} (${code})`);
  const bands = await scrapeBands(code, {
    delay: args.delay * 1000,
    onPage: (start, total) => {
      const end = start + 500;
      const label = total ? `/ ${total}` : "";
      console.log(`  Fetching records ${start + 1}–${end} ${label}…`);
    },
  });

  console.log(`Total bands found: ${bands.length}`);
  if (args.output) {
    fs.writeFileSync(args.output, JSON.stringify(bands, null, 2), "utf8");
    console.log(`Saved ${bands.length} artists to '${args.output}'.`);
  } else {
    for (const band of bands) console.log(band.name);
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.artist) return handleArtist(args);
  if (args.release) return handleRelease(args);
  if (args.person) return handlePerson(args);
  if (args.label) return handleLabel(args);
  if (args.releases) return handleReleasesQueue(args);
  if (args.persons) return handlePersonsQueue(args);
  if (args.labels) return handleLabelsQueue(args);
  if (args.country) return handleCountry(args);

  console.error("No command given. See README.md for CLI usage.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
