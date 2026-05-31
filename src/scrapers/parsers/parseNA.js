const NA_VALUES = new Set(["n/a", "none", "-", ""]);

const isNA = (v) => typeof v === "string" && NA_VALUES.has(v.trim().toLowerCase());

export const nullIfNA = (v) => (isNA(v) ? null : v);

export function normalizeNA(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return nullIfNA(value);
  if (Array.isArray(value)) return value.map(normalizeNA);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeNA(v);
    return out;
  }
  return value;
}
