const LABEL_NULL_VALUES = new Set(["unsigned/independent", "unsigned", "independent"]);

/**
 * Normalise a label name + url into { id, name, url } or null.
 * Unsigned/independent variants resolve to null.
 *
 * @param {string|null} name
 * @param {string|null} url
 */
export function parseLabel(name, url) {
  const trimmed = name?.trim() ?? null;
  if (!trimmed || LABEL_NULL_VALUES.has(trimmed.toLowerCase())) return null;
  // Label URLs end with the numeric ID: /labels/Name/12345
  const cleanUrl = url ? url.split("#")[0] : null;
  const id = cleanUrl ? ((cleanUrl.match(/\/([0-9]+)\/?$/) ?? [])[1] ?? null) : null;
  return { id, name: trimmed };
}
