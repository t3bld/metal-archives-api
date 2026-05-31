export async function parsePageTimestamps(page) {
  return page.evaluate(() => {
    const ts = (el) => el?.textContent.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)?.[1] ?? null;
    const tds = Array.from(document.querySelectorAll("td"));
    return {
      lastModifiedAtMetalArchives: ts(tds.find((t) => t.textContent.includes("Last modified"))),
      createdAtMetalArchives: ts(tds.find((t) => t.textContent.trim().startsWith("Added on:"))),
    };
  });
}
