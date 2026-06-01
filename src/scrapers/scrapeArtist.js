import { createBrowser } from "./browserSession.js";
import {
  parseGenres,
  parseLabel,
  parseLocation,
  parseThemes,
  parseYearsActive,
  parsePageTimestamps,
  normalizeNA,
} from "./parsers/index.js";
import { ArtistSchema } from "./schema/index.js";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;

export async function scrapeArtist({ id, name = "band" }) {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    const slug = name.replace(/\s+/g, "_");
    const bandUrl = `${BASE}/bands/${slug}/${id}`;

    console.log(`  Navigating to ${bandUrl} …`);
    await page.goto(bandUrl, { waitUntil: "load", timeout: 60_000 });
    const finalUrl = page.url();

    const notFound = await page.evaluate(() =>
      /Error\s*404/.test(document.querySelector("h3")?.textContent ?? "")
    );
    if (notFound) throw new Error(`Artist ${id} does not exist (404).`);

    console.log("  Extracting basic info…");
    const info = await extractBasicInfo(page);

    console.log("  Extracting discography…");
    const discography = await extractDiscography(page);

    console.log("  Extracting members…");
    const members = await extractMembers(page);

    console.log("  Extracting similar artists…");
    const similarArtists = await extractSimilarArtists(page, id);

    console.log("  Extracting related links…");
    const relatedLinks = await extractRelatedLinks(page, id);

    console.log("  Extracting timestamps…");
    const { lastModifiedAtMetalArchives, createdAtMetalArchives } = await parsePageTimestamps(page);

    const artist = normalizeNA({
      id,
      url: finalUrl,
      ...info,
      discography,
      members,
      similarArtists,
      relatedLinks,
      lastModifiedAtMetalArchives,
      createdAtMetalArchives,
    });

    const validation = ArtistSchema.safeParse(artist);
    if (!validation.success) {
      console.warn("  [schema] Validation issues detected:");
      for (const issue of validation.error.issues) {
        console.warn(`    ${issue.path.join(".")} — ${issue.message}`);
      }
    }

    return artist;
  } finally {
    await browser.close();
  }
}

export const BAND_STATUSES = /** @type {const} */ ([
  "Active",
  "Split-up",
  "Changed name",
  "On hold",
  "Unknown",
  "Disputed",
]);

async function extractBasicInfo(page) {
  const info = await page.evaluate(() => {
    const name =
      document.querySelector("h1.band_name a")?.textContent?.trim() ??
      document.querySelector("h1.band_name")?.textContent?.trim() ??
      null;

    const fields = {};
    const links = {};
    document.querySelectorAll("#band_stats dl").forEach((dl) => {
      const dts = [...dl.querySelectorAll("dt")];
      const dds = [...dl.querySelectorAll("dd")];
      dts.forEach((dt, i) => {
        const key = dt.textContent.replace(/:$/, "").trim();
        const dd = dds[i];
        fields[key] = dd?.textContent?.trim() ?? null;
        const anchor = dd?.querySelector("a");
        if (anchor) links[key] = anchor.href;
      });
    });

    return {
      name,
      country: fields["Country of origin"] ?? null,
      location: fields["Location"] ?? null,
      status: fields["Status"] ?? null,
      formedIn: fields["Formed in"] ?? null,
      yearsActive: fields["Years active"] ?? null,
      genre: fields["Genre"] ?? null,
      themes: fields["Themes"] ?? fields["Lyrical themes"] ?? null,
      label: fields["Current label"] ?? fields["Last label"] ?? null,
      labelUrl: links["Current label"] ?? links["Last label"] ?? null,
    };
  });
  const { genre, yearsActive, themes, location, label, labelUrl, ...rest } = info;
  const labelName = label?.trim() ?? null;
  const parsedYearsActive = parseYearsActive(yearsActive);
  if (parsedYearsActive?.length && rest.name) {
    for (const range of parsedYearsActive) {
      if (range.as === null) range.as = rest.name;
    }
  }
  return {
    ...rest,
    location: parseLocation(location),
    label: parseLabel(labelName, labelUrl),
    yearsActive: parsedYearsActive,
    themes: parseThemes(themes),
    genres: parseGenres(genre),
  };
}

async function extractDiscography(page) {
  const tabHandle = await page.$('a[href="#band_tab_discography"]');
  if (tabHandle) {
    await page.evaluate((el) => el.click(), tabHandle);
    // Click the "All" sub-tab which loads all release types via AJAX
    await page
      .waitForSelector('a[href*="/band/discography/"][href*="/tab/all"]', { timeout: 10_000 })
      .catch(() => {});
    const allTab = await page.$('a[href*="/band/discography/"][href*="/tab/all"]');
    if (allTab) {
      await page.evaluate((el) => el.click(), allTab);
    }
    await page
      .waitForSelector("#band_tab_discography table tbody tr", { timeout: 15_000 })
      .catch(() => {});
  }

  return page.evaluate(() => {
    return [...document.querySelectorAll("#band_tab_discography table tbody tr")]
      .map((tr) => {
        const cells = [...tr.querySelectorAll("td")];
        const anchor = cells[0]?.querySelector("a");
        const url = anchor?.href ?? null;
        const id = url ? ((url.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null) : null;
        return {
          id,
          title: anchor?.textContent?.trim() ?? cells[0]?.textContent?.trim() ?? null,
          url,
        };
      })
      .filter((r) => r.title);
  });
}

async function extractMembers(page) {
  const tabHandle = await page.$('a[href="#band_tab_members"]');
  if (tabHandle) {
    await page.evaluate((el) => el.click(), tabHandle);
    await page.waitForSelector(".lineupRow", { timeout: 15_000 }).catch(() => {});
  }

  return page.evaluate(() => {
    function parseYearsActive(str) {
      if (!str) return [];
      return str.split(", ").map((range) => {
        const dashIdx = range.indexOf("-");
        if (dashIdx === -1) {
          const y = range.trim() || null;
          return { from: y, to: y };
        }
        const from = range.slice(0, dashIdx).trim() || null;
        const toRaw = range.slice(dashIdx + 1).trim();
        const to = toRaw === "" ? null : toRaw === "present" ? "present" : toRaw || null;
        return { from, to };
      });
    }

    function parseSection(sectionId, type) {
      const section = document.getElementById(sectionId);
      if (!section) return [];

      const rows = [...section.querySelectorAll("tr")];
      const members = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (!row.classList.contains("lineupRow")) continue;

        const cells = [...row.querySelectorAll("td")];
        const anchor = cells[0]?.querySelector("a");
        const memberName = anchor?.textContent?.trim() ?? cells[0]?.textContent?.trim() ?? null;
        if (!memberName) continue;

        // Role cell: e.g. "Guitars, Vocals\u00a0(1983-2002, 2004-present)"
        // The LAST parenthetical may be a year range or a role qualifier like "(lead)".
        const rawRole = cells[1]?.textContent?.replace(/\u00a0/g, " ").trim() ?? null;
        const roleMatch = rawRole?.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        const rawParens = roleMatch ? roleMatch[2].trim() : null;
        // Only treat as years if the content contains digits or "present"
        const isYears = rawParens != null && /\d|present/i.test(rawParens);
        const roleStr = roleMatch && isYears ? roleMatch[1].trim() : rawRole;
        const yearsStr = isYears ? rawParens : null;

        const member = {
          status: type,
          name: memberName,
          url: anchor?.href ?? null,
          id: anchor ? ((anchor.href.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null) : null,
          roles: roleStr
            ? roleStr
                .split(", ")
                .map((r) => r.trim())
                .filter(Boolean)
            : [],
          yearsActive: parseYearsActive(yearsStr),
          otherArtistInvolvements: [],
        };

        const nextRow = rows[i + 1];
        if (nextRow?.classList.contains("lineupBandsRow")) {
          i++;
          const cell = nextRow.querySelector("td");
          if (cell) {
            const activities = [];
            const childNodes = [...cell.childNodes];
            let isEx = false;

            for (const node of childNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                // Strip "See also:" prefix which can appear in the same text node as "ex-"
                const cleaned = node.textContent.replace(/see also:?/i, "");
                const parts = cleaned
                  .split(",")
                  .map((p) => p.trim())
                  .filter(Boolean);
                for (const part of parts) {
                  if (/^ex-$/i.test(part)) {
                    isEx = true;
                  } else {
                    const exMatch = part.match(/^ex-(.+)$/i);
                    if (exMatch) {
                      activities.push({
                        name: exMatch[1].trim(),
                        id: null,
                        url: null,
                        status: "past",
                      });
                    } else {
                      activities.push({
                        name: part,
                        id: null,
                        url: null,
                        status: isEx ? "past" : "active",
                      });
                      isEx = false;
                    }
                  }
                }
              } else if (node.nodeName === "A") {
                const href = node.href;
                const id = (href.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null;
                activities.push({
                  name: node.textContent.trim(),
                  id,
                  url: href,
                  status: isEx ? "past" : "active",
                });
                isEx = false;
              }
            }

            member.otherArtistInvolvements = activities;
          }
        }

        members.push(member);
      }

      return members;
    }

    return [
      ...parseSection("band_tab_members_current", "current"),
      ...parseSection("band_tab_members_past", "past"),
      ...parseSection("band_tab_members_live", "live"),
    ];
  });
}

async function extractRelatedLinks(page, id) {
  return page.evaluate(
    async ({ bandId, baseUrl }) => {
      const res = await fetch(`${baseUrl}/link/ajax-list/type/band/id/${bandId}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;

      const result = [];
      let currentCategory = null;

      for (const tr of wrapper.querySelectorAll("tr")) {
        // Category header row: <tr id="header_Official"><td colspan="2">Official</td></tr>
        if (tr.id?.startsWith("header_")) {
          currentCategory = tr.querySelector("td")?.textContent?.trim() ?? null;
          continue;
        }
        const anchor = tr.querySelector("a");
        if (!anchor) continue;
        result.push({
          category: currentCategory,
          title: anchor.textContent.trim() || null,
          url: anchor.href || null,
        });
      }
      return result;
    },
    { bandId: id, baseUrl: BASE }
  );
}

async function extractSimilarArtists(page, id) {
  async function fetchRows(url) {
    return page.evaluate(async (fetchUrl) => {
      const res = await fetch(fetchUrl, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      return [...wrapper.querySelectorAll("#artist_list tbody tr")].map((tr) => {
        const cells = [...tr.querySelectorAll("td")];
        const anchor = cells[0]?.querySelector("a");
        const scoreText = cells[3]?.textContent?.trim() ?? null;
        return {
          name: anchor?.textContent?.trim() ?? cells[0]?.textContent?.trim() ?? null,
          url: anchor?.href ?? null,
          country: cells[1]?.textContent?.trim() ?? null,
          genre: cells[2]?.textContent?.trim() ?? null,
          score: scoreText ? parseInt(scoreText, 10) : null,
        };
      });
    }, url);
  }

  let rows = await fetchRows(`${BASE}/band/ajax-recommendations/id/${id}`);

  const hasSeeMore = rows.some(
    (r) => !r.name || r.name.toLowerCase() === "see more" || r.url?.includes("showMoreSimilar")
  );

  if (hasSeeMore) {
    console.log("  Fetching full similar artists list…");
    rows = await fetchRows(`${BASE}/band/ajax-recommendations/id/${id}/showMoreSimilar/1`);
  }

  const filtered = rows.filter(
    (r) =>
      r.name &&
      r.name.toLowerCase() !== "see more" &&
      !r.url?.includes("showMoreSimilar") &&
      !r.url?.includes("/content/help")
  );
  return filtered.map(({ genre, ...r }) => ({
    ...r,
    id: r.url ? ((r.url.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null) : null,
    genres: genre ? parseGenres(genre) : null,
  }));
}
