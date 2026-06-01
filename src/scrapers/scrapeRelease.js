import { createBrowser } from "./browserSession.js";
import { ReleaseDetailSchema } from "./schema/index.js";
import { parseReleaseDate, parsePageTimestamps, normalizeNA } from "./parsers/index.js";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;

export async function scrapeRelease({ id, url } = {}) {
  if (!id && !url) throw new Error("scrapeRelease requires id or url");

  // Use a stable, slug-agnostic URL when an id is available.
  const canonicalUrl = id ? `${BASE}/albums/band/album/${id}` : url;

  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    console.log(`  Navigating to ${canonicalUrl} …`);
    await page.goto(canonicalUrl, { waitUntil: "load", timeout: 60_000 });
    // After redirect the browser lands on the full slug URL — record it.
    const resolvedUrl = page.url();

    const notFound = await page.evaluate(() =>
      /Error\s*404/.test(document.querySelector("h3")?.textContent ?? "")
    );
    if (notFound) throw new Error(`Release ${id ?? url} does not exist (404).`);

    console.log("  Extracting release info…");
    const info = await extractReleaseInfo(page);

    console.log("  Extracting tracklist…");
    const { tracks, totalDuration } = await extractTracks(page);

    console.log("  Extracting lineup…");
    const lineup = await extractLineup(page);

    console.log("  Extracting timestamps…");
    const { lastModifiedAtMetalArchives, createdAtMetalArchives } = await parsePageTimestamps(page);

    const release = normalizeNA({
      ...info,
      releaseDate: parseReleaseDate(info.releaseDate),
      totalDuration,
      tracks,
      lineup,
      lastModifiedAtMetalArchives,
      createdAtMetalArchives,
    });

    const validation = ReleaseDetailSchema.safeParse(release);
    if (!validation.success) {
      console.warn(`  [schema] Validation issues for ${url}:`);
      for (const issue of validation.error.issues) {
        console.warn(`    ${issue.path.join(".")} — ${issue.message}`);
      }
    }

    return release;
  } finally {
    await browser.close();
  }
}

async function extractReleaseInfo(page) {
  return page.evaluate(() => {
    const fields = {};
    const links = {};
    document.querySelectorAll("#album_info dl").forEach((dl) => {
      const dts = [...dl.querySelectorAll("dt")];
      const dds = [...dl.querySelectorAll("dd")];
      dts.forEach((dt, i) => {
        const key = dt.textContent.replace(/:$/, "").trim();
        const dd = dds[i];
        fields[key] = dd?.textContent?.trim() ?? null;
        const anchor = dd?.querySelector("a");
        if (anchor) links[key] = { href: anchor.href, text: anchor.textContent.trim() };
      });
    });

    const titleEl = document.querySelector("h1.album_name, h1");
    const bandLink = document.querySelector("#band_name_strong a, h2 a");
    const labelEntry = links["Label"] ?? null;

    return {
      title: titleEl?.textContent?.trim() ?? null,
      artist: bandLink
        ? {
            name: bandLink.textContent?.trim() ?? null,
            id: (bandLink.href?.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null,
          }
        : null,
      type: fields["Type"] ?? null,
      releaseDate: fields["Release date"] ?? null,
      catalogId: fields["Catalog ID"] ?? null,
      versionDesc: fields["Version desc."] ?? null,
      label: labelEntry
        ? {
            name: labelEntry.text,
            id: (labelEntry.href?.split("#")[0]?.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null,
          }
        : null,
      format: fields["Format"] ?? null,
    };
  });
}

async function extractTracks(page) {
  // Songs is the default active tab on album pages — content is present on initial load.
  // Clicking when already active triggers a re-AJAX-load that can race with the evaluate.
  const alreadyLoaded = (await page.locator("table#table_songs tbody tr").count()) > 0;
  if (!alreadyLoaded) {
    const tabHandle = await page.$("#album_tabs a[href*='tracklist']");
    if (!tabHandle) return { tracks: [], totalDuration: null };
    await page.evaluate((el) => el.click(), tabHandle);
    await page.waitForSelector("table#table_songs tbody tr", { timeout: 12_000 }).catch(() => null);
  }

  return await page.evaluate(() => {
    const tracks = [];
    const rows = document.querySelectorAll("table#table_songs tbody tr");

    for (const row of rows) {
      const cells = [...row.querySelectorAll("td")];
      if (cells.length < 2) continue;

      const posText = cells[0]?.textContent?.replace(".", "").trim() ?? "";
      const position = parseInt(posText, 10);
      if (isNaN(position)) continue;

      const titleCell = cells[1];
      // Lyrics toggle may use class "viewLyrics" or an id like "lyricsButton{id}".
      const hasLyrics =
        !!row.querySelector("[id^='lyricsButton']") || !!row.querySelector(".viewLyrics");
      // Strip any inline anchor/span children to isolate the track name.
      const titleClone = titleCell?.cloneNode(true);
      titleClone?.querySelectorAll("a, span").forEach((el) => el.remove());
      const title = (titleClone?.textContent?.trim() || titleCell?.textContent?.trim()) ?? "";

      const duration = cells[2]?.textContent?.trim() || null;

      tracks.push({ position, title, duration, hasLyrics });
    }

    const totalDuration =
      document.querySelector("table#table_songs tfoot")?.textContent?.trim() || null;

    return { tracks, totalDuration };
  });
}

async function extractLineup(page) {
  // Lineup is in a tab that is loaded via AJAX on click.
  const lineupTab = page.locator("#album_tabs a").filter({ hasText: /^Lineup$/ });
  if ((await lineupTab.count()) === 0) return [];

  await lineupTab.click();

  // Wait until at least one performer cell appears inside the lineup tab panel.
  await page.waitForSelector("#album_tabs_lineup td", { timeout: 8_000 }).catch(() => null);

  return await page.evaluate(() => {
    const INVOLVEMENT_MAP = {
      "band members": "member",
      "guest/session": "guest",
      "guest/session musicians": "guest",
      "miscellaneous staff": "staff",
      "other staff": "staff",
    };

    const SECTION_IDS = [
      { id: "album_members_lineup", involvement: "member" },
      { id: "album_members_guest", involvement: "guest" },
      { id: "album_members_misc", involvement: "staff" },
    ];

    function parseRows(root, defaultInvolvement) {
      const performers = [];
      let involvement = defaultInvolvement;

      for (const row of root.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td")];

        // Section header rows have a single cell with no anchor.
        if (cells.length === 1 && !cells[0].querySelector("a")) {
          const text = cells[0].textContent.trim().toLowerCase();
          involvement = INVOLVEMENT_MAP[text] ?? involvement;
          continue;
        }

        if (cells.length < 2) continue;

        const anchor = cells[0].querySelector("a");
        const name = anchor?.textContent.trim() ?? cells[0].textContent.trim();
        const url = anchor?.href ?? null;
        const id = url?.match(/\/(\d+)\/?$/)?.[1] ?? null;
        if (!name) continue;

        const rolesRaw = cells[1].textContent.trim();
        const roles = rolesRaw
          .split(/,\s*(?=[A-Z])/)
          .map((r) => r.trim())
          .filter(Boolean);

        performers.push({ name, id, roles, involvement });
      }
      return performers;
    }

    // Prefer "Complete lineup" block — it has all entries with embedded section headers.
    const complete = document.querySelector("#album_all_members_lineup");
    if (complete) return parseRows(complete, "member");

    // Fall back to individual section blocks when there's no complete lineup tab.
    return SECTION_IDS.flatMap(({ id, involvement }) => {
      const el = document.getElementById(id);
      return el ? parseRows(el, involvement) : [];
    });
  });
}
