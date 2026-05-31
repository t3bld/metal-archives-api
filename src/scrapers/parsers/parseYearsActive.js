/**
 * Parse a "Years active" string into { _raw, ranges }.
 * Each range: { from, to, as }
 *   - from/to are year strings ("1993"), "present", or null (unknown/?)
 *   - as is the band name from "(as Bandname)" annotations, or null
 *
 * "1993-present"                          → { ranges: [{ from: "1993", to: "present", as: null }] }
 * "1993-2005"                             → { ranges: [{ from: "1993", to: "2005",    as: null }] }
 * "1988-1991, 1994-present"               → { ranges: [{ from: "1988", to: "1991",    as: null }, { from: "1994", to: "present", as: null }] }
 * "2011-?, ?-present (as Acidcore Orch)"  → { ranges: [{ from: "2011", to: null,      as: null }, { from: null,   to: "present", as: "Acidcore Orch" }] }
 * "1999 (as Black Shadows), 1999-present" → { ranges: [{ from: "1999", to: "1999",    as: "Black Shadows" }, { from: "1999", to: "present", as: null }] }
 *
 * On error: { ranges: [] }
 */
export function parseYearsActive(raw) {
  if (!raw) return null;
  try {
    const ranges = raw.split(",").map((segment) => {
      // Extract "(as Bandname)" annotation before stripping
      const asMatch = segment.match(/\(as\s+([^)]+)\)/i);
      const as = asMatch ? asMatch[1].trim() : null;
      // Strip all parenthetical annotations
      const clean = segment.replace(/\([^)]*\)/g, "").trim();
      const dashIdx = clean.indexOf("-");
      const parseYear = (s) => {
        if (!s || s === "?") return null;
        if (/present/i.test(s)) return "present";
        const n = parseInt(s, 10);
        return isNaN(n) ? null : String(n);
      };
      if (dashIdx === -1) {
        // Single year: "1999" → { from: "1999", to: "1999" }
        const year = parseYear(clean);
        return { from: year, to: year, as };
      }
      const fromStr = clean.slice(0, dashIdx).trim();
      const toStr = clean.slice(dashIdx + 1).trim();
      return { from: parseYear(fromStr), to: parseYear(toStr), as };
    });
    return ranges;
  } catch {
    return [];
  }
}
