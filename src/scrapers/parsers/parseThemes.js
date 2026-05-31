const THEMES_NULL_VALUES = new Set(["n/a", "none", "-"]);

/**
 * Parse a "Themes" string into { _raw, values }.
 * "Ancient Egyptian mythology, Death, Rituals" → { _raw, values: ["Ancient Egyptian mythology", "Death", "Rituals"] }
 * "N/A" → null
 */
export function parseThemes(raw) {
  if (!raw) return null;
  if (THEMES_NULL_VALUES.has(raw.trim().toLowerCase())) return null;
  try {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return { values: [] };
  }
}
