import "dotenv/config";
import fs from "node:fs";
import { resolveCountry, scrapeBands } from "./scrapers/fetchArtistsByCountry.js";
import { scrapeArtist } from "./scrapers/scrapeArtist.js";
import { searchArtists, searchReleases, searchPersons, searchLabels } from "./scrapers/search.js";
import { scrapeRelease } from "./scrapers/scrapeRelease.js";
import { scrapePerson } from "./scrapers/scrapePerson.js";
import { scrapeLabel } from "./scrapers/scrapeLabel.js";

function parseArgs(argv) {
  const args = {
    country: null,
    artist: null,
    release: null,
    person: null,
    label: null,
    output: null,
    limit: 200,
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
    "--limit": (v) => {
      args.limit = parseInt(v, 10);
      return true;
    },
    "--releases": (v) => {
      if (v && /^\d+$/.test(v)) {
        args.release = v;
        return true;
      }
      return false;
    },
    "--persons": (v) => {
      if (v && /^\d+$/.test(v)) {
        args.person = v;
        return true;
      }
      return false;
    },
    "--labels": (v) => {
      if (v && /^\d+$/.test(v)) {
        args.label = v;
        return true;
      }
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

function output(args, detail, label) {
  if (args.output) {
    fs.writeFileSync(args.output, JSON.stringify(detail, null, 2), "utf8");
    console.log(`Saved ${label.toLowerCase()} detail to '${args.output}'.`);
  } else {
    console.log(JSON.stringify(detail, null, 2));
  }
}

async function handleArtist(args) {
  const id = await resolveId(args.artist, {
    entity: "artist",
    flag: "--artist",
    searchFn: (q) => searchArtists(q, { limit: args.limit }),
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
  output(args, detail, "Artist");
}

async function handleRelease(args) {
  const id = await resolveId(args.release, {
    entity: "release",
    flag: "--releases",
    searchFn: (q) => searchReleases(q, { limit: args.limit }),
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
  output(args, detail, "Release");
}

async function handlePerson(args) {
  const id = await resolveId(args.person, {
    entity: "person",
    flag: "--persons",
    searchFn: (q) => searchPersons(q, { limit: args.limit }),
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
  output(args, detail, "Person");
}

async function handleLabel(args) {
  const id = await resolveId(args.label, {
    entity: "label",
    flag: "--labels",
    searchFn: (q) => searchLabels(q, { limit: args.limit }),
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
  output(args, detail, "Label");
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
  if (args.country) return handleCountry(args);

  console.error("No command given. See README.md for CLI usage.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
