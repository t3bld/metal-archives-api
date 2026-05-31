const MONTHS = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Parse MA birth date strings into ISO 8601.
 * "Feb 10th, 1980"      → "1980-02-10"
 * "February 10th, 1980" → "1980-02-10"
 * "February 1980"       → "1980-02"
 * "1980"                → "1980"
 * null                  → null
 *
 * @param {string|null} raw
 * @returns {string|null}
 */
export function parseBirthDate(raw) {
  if (!raw) return null;
  // Full: "Month DDth, YYYY" (abbreviated or full month name)
  const m = raw.match(/^([A-Za-z]+)\s+(\d+)(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!month) return raw;
    const day = m[2].padStart(2, "0");
    return `${m[3]}-${month}-${day}`;
  }
  // "Month YYYY" (no day)
  const mMonth = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (mMonth) {
    const month = MONTHS[mMonth[1].slice(0, 3).toLowerCase()];
    if (!month) return raw;
    return `${mMonth[2]}-${month}`;
  }
  // Bare year
  if (/^\d{4}$/.test(raw)) return raw;
  return raw;
}
