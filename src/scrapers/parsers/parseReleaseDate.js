const MONTHS = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/**
 * Parse MA release date strings to ISO 8601.
 * "September 24th, 1998" → "1998-09-24"
 * "September 1998"       → "1998-09"
 * "1998"                 → "1998"
 * Unknown / null         → null
 *
 * @param {string|null} raw
 * @returns {string|null}
 */
export function parseReleaseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  // Full: "Month DDth, YYYY"
  const full = s.match(/^(\w+)\s+(\d+)(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (full) {
    const month = MONTHS[full[1].toLowerCase()];
    if (month) {
      const day = full[2].padStart(2, "0");
      return `${full[3]}-${month}-${day}`;
    }
  }
  // Month + year: "Month YYYY"
  const monthYear = s.match(/^(\w+)\s+(\d{4})$/i);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${month}`;
  }
  // Year only: "YYYY"
  if (/^\d{4}$/.test(s)) return s;
  return null;
}
