import "dotenv/config";
import fs from "node:fs";
import { resolveCountry, scrapeBands } from "./scrapers/fetchArtistsByCountry.js";
import { scrapeArtist } from "./scrapers/scrapeArtist.js";
import { searchArtists, searchReleases, searchPersons, searchLabels } from "./scrapers/search.js";
import { closeBrowserSession } from "./scrapers/browserSession.js";
import { scrapeRelease } from "./scrapers/scrapeRelease.js";
import { scrapePerson } from "./scrapers/scrapePerson.js";
import { scrapeLabel } from "./scrapers/scrapeLabel.js";

function parseArgs(argv) {
  const args = {
    country: null,
    artist: null,
    artists: null,
    release: null,
    releases: null,
    person: null,
    persons: null,
    label: null,
    labels: null,
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
    "--artists": (v) => {
      args.artists = v;
      return true;
    },
    "--release": (v) => {
      args.release = v;
      return true;
    },
    "--releases": (v) => {
      args.releases = v;
      return true;
    },
    "--person": (v) => {
      args.person = v;
      return true;
    },
    "--persons": (v) => {
      args.persons = v;
      return true;
    },
    "--label": (v) => {
      args.label = v;
      return true;
    },
    "--labels": (v) => {
      args.labels = v;
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
  };

  for (let i = 2; i < argv.length; i++) {
    const handle = flags[argv[i]];
    if (handle?.(argv[i + 1])) i++;
  }

  return args;
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
  const raw = args.artist;
  if (!/^\d+$/.test(raw)) {
    console.error(`--artist requires a numeric ID. To search by name use --artists "<name>".`);
    process.exit(1);
  }
  console.log(`Scraping detail for artist ID: ${raw}`);
  let detail;
  try {
    detail = await scrapeArtist({ id: raw });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  output(args, detail, "Artist");
}

async function handleArtists(args) {
  const results = await searchArtists(args.artists, { limit: args.limit });
  if (results.length === 0) {
    console.error("No artists found.");
    process.exit(1);
  }
  output(args, results, "Artists");
}

async function handleRelease(args) {
  const raw = args.release;
  if (!/^\d+$/.test(raw)) {
    console.error(`--release requires a numeric ID. To search by name use --releases "<name>".`);
    process.exit(1);
  }
  console.log(`Scraping detail for release ID: ${raw}`);
  let detail;
  try {
    detail = await scrapeRelease({ id: raw });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  output(args, detail, "Release");
}

async function handleReleases(args) {
  const results = await searchReleases(args.releases, { limit: args.limit });
  if (results.length === 0) {
    console.error("No releases found.");
    process.exit(1);
  }
  output(args, results, "Releases");
}

async function handlePerson(args) {
  const raw = args.person;
  if (!/^\d+$/.test(raw)) {
    console.error(`--person requires a numeric ID. To search by name use --persons "<name>".`);
    process.exit(1);
  }
  console.log(`Scraping detail for person ID: ${raw}`);
  let detail;
  try {
    detail = await scrapePerson({ id: raw });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  output(args, detail, "Person");
}

async function handlePersons(args) {
  const results = await searchPersons(args.persons, { limit: args.limit });
  if (results.length === 0) {
    console.error("No persons found.");
    process.exit(1);
  }
  output(args, results, "Persons");
}

async function handleLabel(args) {
  const raw = args.label;
  if (!/^\d+$/.test(raw)) {
    console.error(`--label requires a numeric ID. To search by name use --labels "<name>".`);
    process.exit(1);
  }
  console.log(`Scraping detail for label ID: ${raw}`);
  let detail;
  try {
    detail = await scrapeLabel({ id: raw });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  output(args, detail, "Label");
}

async function handleLabels(args) {
  const results = await searchLabels(args.labels, { limit: args.limit });
  if (results.length === 0) {
    console.error("No labels found.");
    process.exit(1);
  }
  output(args, results, "Labels");
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
  if (args.artists) return handleArtists(args);
  if (args.release) return handleRelease(args);
  if (args.releases) return handleReleases(args);
  if (args.person) return handlePerson(args);
  if (args.persons) return handlePersons(args);
  if (args.label) return handleLabel(args);
  if (args.labels) return handleLabels(args);
  if (args.country) return handleCountry(args);

  console.error("No command given. See README.md for CLI usage.");
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closeBrowserSession());
