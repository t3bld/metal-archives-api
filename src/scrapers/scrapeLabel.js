import { createBrowser } from "./browserSession.js";
import { LabelDetailSchema } from "./schema/index.js";
import { parsePageTimestamps, normalizeNA } from "./parsers/index.js";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;

export async function scrapeLabel({ id, url } = {}) {
  if (!id && !url) throw new Error("scrapeLabel requires id or url");

  // Redirects /labels/name/<id> to the full slug URL.
  const canonicalUrl = id ? `${BASE}/labels/label/${id}` : url;

  const { browser, context } = await createBrowser();
  const page = await context.newPage();

  try {
    console.log(`  Navigating to ${canonicalUrl} …`);
    await page.goto(canonicalUrl, { waitUntil: "load", timeout: 60_000 });
    const resolvedUrl = page.url();

    const notFound = await page.evaluate(() =>
      /Error\s*404/.test(document.querySelector("h3")?.textContent ?? "")
    );
    if (notFound) throw new Error(`Label ${id ?? url} does not exist (404).`);

    console.log("  Extracting label info…");
    const info = await extractLabelInfo(page);

    console.log("  Extracting roster…");
    const roster = await extractRoster(page);

    console.log("  Extracting timestamps…");
    const { lastModifiedAtMetalArchives, createdAtMetalArchives } = await parsePageTimestamps(page);

    const label = normalizeNA({
      ...info,
      roster,
      lastModifiedAtMetalArchives,
      createdAtMetalArchives,
    });

    const validation = LabelDetailSchema.safeParse(label);
    if (!validation.success) {
      console.warn(`  [schema] Validation issues for ${resolvedUrl}:`);
      for (const issue of validation.error.issues) {
        console.warn(`    ${issue.path.join(".")} — ${issue.message}`);
      }
    }

    return label;
  } finally {
    await browser.close();
  }
}

async function extractLabelInfo(page) {
  return page.evaluate(() => {
    const name = document.querySelector("h1.label_name")?.textContent?.trim() ?? null;

    const fields = {};
    const links = {};
    document.querySelectorAll("#label_info dl").forEach((dl) => {
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

    // Sub-labels are listed as a comma-separated set of links inside a dd.
    const subLabelDd = [...document.querySelectorAll("#label_info dt")].find((dt) =>
      dt.textContent.includes("Sub-label")
    )?.nextElementSibling;
    const subLabels = subLabelDd
      ? [...subLabelDd.querySelectorAll("a")].map((a) => ({
          name: a.textContent.trim(),
          id: (a.href.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null,
        }))
      : [];

    // Website link — appears as a plain <a> outside the dl, under the info block.
    const websiteAnchor = document.querySelector("#label_info .label_website a, #label_links a");
    const website = websiteAnchor?.href ?? null;

    const onlineRaw = fields["Online shopping"] ?? "";
    const onlineShopping =
      onlineRaw.toLowerCase() === "yes" ? true : onlineRaw.toLowerCase() === "no" ? false : null;

    return {
      name,
      address: fields["Address"] ?? null,
      country: fields["Country"] ?? null,
      phone: fields["Phone number"] ?? null,
      status: fields["Status"] ?? null,
      specialties: fields["Styles/specialties"] ?? null,
      foundingDate: fields["Founding date"]?.trim() ?? null,
      onlineShopping,
      website,
      subLabels,
    };
  });
}

async function extractRoster(page) {
  const roster = [];

  const currentTab = page.locator("#label_tabs a").filter({ hasText: /Current roster/i });
  if ((await currentTab.count()) > 0) {
    await currentTab.click();
    await page
      .waitForSelector("#label_tab_current_roster table tbody tr", { timeout: 10_000 })
      .catch(() => {});

    const currentBands = await page.evaluate(() =>
      [...document.querySelectorAll("#label_tab_current_roster table tbody tr")]
        .map((tr) => {
          const anchor = tr.querySelector("td a");
          return anchor
            ? {
                bandName: anchor.textContent.trim(),
                bandId: (anchor.href.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null,
                section: "current",
              }
            : null;
        })
        .filter(Boolean)
    );
    roster.push(...currentBands);
  }

  const pastTab = page.locator("#label_tabs a").filter({ hasText: /Past roster/i });
  if ((await pastTab.count()) > 0) {
    await pastTab.click();
    await page
      .waitForSelector("#label_tab_past_roster table tbody tr", { timeout: 10_000 })
      .catch(() => {});

    const pastBands = await page.evaluate(() =>
      [...document.querySelectorAll("#label_tab_past_roster table tbody tr")]
        .map((tr) => {
          const anchor = tr.querySelector("td a");
          return anchor
            ? {
                bandName: anchor.textContent.trim(),
                bandId: (anchor.href.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null,
                section: "past",
              }
            : null;
        })
        .filter(Boolean)
    );
    roster.push(...pastBands);
  }

  return roster;
}
