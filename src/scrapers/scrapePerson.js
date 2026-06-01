import { createBrowser } from "./browserSession.js";
import { PersonDetailSchema } from "./schema/index.js";
import { parseBirthDate, parsePageTimestamps, normalizeNA } from "./parsers/index.js";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;

export async function scrapePerson({ id, url } = {}) {
  if (!id && !url) throw new Error("scrapePerson requires id or url");

  const canonicalUrl = id ? `${BASE}/artists/artist/${id}` : url;

  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    console.log(`  Navigating to ${canonicalUrl} …`);
    await page.goto(canonicalUrl, { waitUntil: "load", timeout: 60_000 });
    const resolvedUrl = page.url();

    const notFound = await page.evaluate(() =>
      /Error\s*404/.test(document.querySelector("h3")?.textContent ?? "")
    );
    if (notFound) throw new Error(`Person ${id ?? url} does not exist (404).`);

    console.log("  Extracting artist info…");
    const info = await extractArtistInfo(page);
    if (info.birth?.date) info.birth.date = parseBirthDate(info.birth.date);

    console.log("  Extracting artist credits…");
    const artists = await extractBandCredits(page);

    console.log("  Extracting timestamps…");
    const { lastModifiedAtMetalArchives, createdAtMetalArchives } = await parsePageTimestamps(page);

    const person = normalizeNA({
      ...info,
      artists,
      lastModifiedAtMetalArchives,
      createdAtMetalArchives,
    });

    const validation = PersonDetailSchema.safeParse(person);
    if (!validation.success) {
      console.warn(`  [schema] Validation issues for ${resolvedUrl}:`);
      for (const issue of validation.error.issues) {
        console.warn(`    ${issue.path.join(".")} — ${issue.message}`);
      }
    }

    return person;
  } finally {
    await browser.close();
  }
}

async function extractArtistInfo(page) {
  return page.evaluate(() => {
    const name = document.querySelector("h1.band_member_name")?.textContent?.trim() ?? null;

    const fields = {};
    const links = {};
    document.querySelectorAll("#member_info dl").forEach((dl) => {
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

    // "Age: 51 (born Jun 6th, 1974)" — the dd may contain separate elements
    // for age and birth date. MA renders them in a single dd with a <span>.
    const ageRaw = fields["Age"] ?? null;
    const ageMatch = ageRaw?.match(/(\d+)/);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : null;

    const birthDateRaw = ageRaw?.match(/born (.+?)\)/)?.[1]?.trim() ?? null;

    // Place of birth: "United Kingdom (Leytonstone, London, England)"
    // Outer part = country; inner comma-separated parts = city, region, territory
    const birthFull = fields["Place of birth"] ?? null;
    const placeMatch = birthFull?.match(/^(.+?)\s*\((.+)\)\s*$/);
    const country = placeMatch ? placeMatch[1].trim() : (birthFull ?? null);
    const placeParts =
      (placeMatch ? placeMatch[2] : null)
        ?.split(",")
        .map((p) => p.trim())
        .filter(Boolean) ?? [];
    const city = placeParts[0] ?? null;
    const region = placeParts[1] ?? null;
    const territory = placeParts[2] ?? null;

    return {
      pseudonym: name,
      name: fields["Real/full name"] ?? null,
      age,
      birth: {
        date: birthDateRaw,
        city,
        region,
        territory,
        country,
      },
      gender: fields["Gender"] ?? null,
    };
  });
}

async function extractBandCredits(page) {
  // Expand any truncated album lists by clicking all "show all" toggles.
  // These are pure JS DOM toggles — no network request, so a short wait suffices.
  await page.evaluate(() => {
    document.querySelectorAll(".toggleAlbums").forEach((a) => a.click());
  });
  await page.waitForTimeout(300);

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

    function parseAlbums(bandEl) {
      return [...bandEl.querySelectorAll("tr[id^='memberInAlbum_']")].map((tr) => {
        const cells = [...tr.querySelectorAll("td")];
        const year = cells[0]?.textContent?.trim() ?? null;
        const albumCell = cells[1];
        const anchor = albumCell?.querySelector("a");
        const albumUrl = anchor?.href?.split("#")[0] ?? null;
        const albumId = (albumUrl?.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null;
        const albumTitle = anchor?.textContent?.trim() ?? null;
        // "(Single)" / "(EP)" etc. appears after the link text
        const cellText = albumCell?.textContent?.trim() ?? "";
        const typeMatch = cellText
          .replace(albumTitle ?? "", "")
          .trim()
          .match(/^\(([^)]+)\)$/);
        const type = typeMatch ? typeMatch[1] : null;
        const rolesRaw = cells[2]?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const roles = rolesRaw
          .split(/,\s*/)
          .map((r) => r.trim())
          .filter(Boolean);
        return { year, title: albumTitle, id: albumId, type, roles };
      });
    }

    function parseBandSection(sectionId, type) {
      const section = document.getElementById(sectionId);
      if (!section) return [];
      return [...section.querySelectorAll(".member_in_band")].flatMap((el) => {
        const anchor = el.querySelector("h3.member_in_band_name a, h2 a");
        if (!anchor) return [];
        const name = anchor.textContent.trim();
        const url = anchor.href?.split("#")[0] ?? null;
        const id = (url?.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null;

        // "Bass (1975-present)" → roles + yearsActive
        const roleRaw =
          el
            .querySelector("p.member_in_band_role")
            ?.textContent?.replace(/\u00a0/g, " ")
            .trim() ?? "";
        // Strip "As Real Name:" prefix (e.g. 'As David "Arkas":') before parsing roles
        const cleanRoleRaw = roleRaw.replace(/^As\s+[^:\n]+:\s*/i, "").trim();
        const roleMatch = cleanRoleRaw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        const roleStr = roleMatch ? roleMatch[1].trim() : cleanRoleRaw;
        const yearsStr = roleMatch ? roleMatch[2].trim() : null;
        const roles = roleStr
          ? roleStr
              .split(/,\s*/)
              .map((r) => r.trim())
              .filter(Boolean)
          : [];

        return [
          {
            type,
            name,
            id,
            roles,
            yearsActive: parseYearsActive(yearsStr),
            albums: parseAlbums(el),
          },
        ];
      });
    }

    function parseMiscSection(sectionId) {
      const section = document.getElementById(sectionId);
      if (!section) return [];
      return [...section.querySelectorAll(".member_in_band")].flatMap((el) => {
        const anchor = el.querySelector("h3.member_in_band_name a, h2 a");
        if (!anchor) return [];
        const name = anchor.textContent.trim();
        const url = anchor.href?.split("#")[0] ?? null;
        const id = (url?.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null;
        return [
          { type: "misc", name, url, id, roles: [], yearsActive: [], albums: parseAlbums(el) },
        ];
      });
    }

    return [
      ...parseBandSection("artist_tab_active", "active"),
      ...parseBandSection("artist_tab_past", "past"),
      ...parseBandSection("artist_tab_guest", "guest"),
      ...parseMiscSection("artist_tab_misc"),
    ];
  });
}
