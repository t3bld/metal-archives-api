/**
 * Parse a location string into an array of { city, region, period } entries.
 *
 * "Berlin"
 *   → [{ city: "Berlin", region: null, period: null }]
 * "Greenville, South Carolina"
 *   → [{ city: "Greenville", region: "South Carolina", period: null }]
 * "Washington, D.C. (early); Shinjuku, Tokyo, Japan (later)"
 *   → [
 *       { city: "Washington", region: "D.C.",        period: "early" },
 *       { city: "Shinjuku",   region: "Tokyo, Japan", period: "later" },
 *     ]
 */
export function parseLocation(raw) {
  if (!raw) return null;
  try {
    const parts = raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.map((part) => {
      // Extract trailing "(period label)" annotation
      const periodMatch = part.match(/\(([^)]+)\)\s*$/);
      const period = periodMatch ? periodMatch[1].trim() : null;
      const loc = periodMatch ? part.slice(0, periodMatch.index).trim() : part;

      // Split on first comma for city / region
      const commaIdx = loc.indexOf(",");
      if (commaIdx === -1) {
        return { city: loc || null, region: null, period };
      }
      return {
        city: loc.slice(0, commaIdx).trim() || null,
        region: loc.slice(commaIdx + 1).trim() || null,
        period,
      };
    });
  } catch {
    return [];
  }
}
