/**
 * Strip HTML tags from a string and decode common entities.
 * Returns null for empty/whitespace-only results.
 *
 * @param {string|null} html
 */
export function htmlToText(html) {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}
