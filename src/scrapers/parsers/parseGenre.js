// Canonical main genres. extractComponents tries longest input suffix first,
// so more-specific multi-word entries win over their shorter suffixes automatically.
const MAIN_GENRES = [
  // Compound genres that contain a shorter entry as a suffix — listed first
  // so the Set contains them; extractComponents handles priority via suffix length.
  "Funeral Doom Metal",
  "Post-Black Metal",
  "Dark Ambient",
  "Dungeon Synth",
  "Death 'n' Roll",
  "Rock 'n' Roll",
  "Power Electronics",
  "Martial Industrial",
  "Industrial Rock",
  "Folk Rock",
  // Metal
  "Black Metal",
  "Death Metal",
  "Thrash Metal",
  "Heavy Metal",
  "Power Metal",
  "Doom Metal",
  "Speed Metal",
  "Groove Metal",
  "Folk Metal",
  "Viking Metal",
  "Pagan Metal",
  "Symphonic Metal",
  "Gothic Metal",
  "Progressive Metal",
  "Nu Metal",
  "Glam Metal",
  "Sludge Metal",
  "Stoner Metal",
  "Drone Metal",
  "Alternative Metal",
  "Industrial Metal",
  "Electronic Metal",
  "Post-Metal",
  "Ambient Metal",
  "War Metal",
  "Noise Metal",
  "Space Metal",
  "Southern Metal",
  // Rock
  "Hard Rock",
  "Stoner Rock",
  "Punk Rock",
  "Noise Rock",
  "Post-Rock",
  "Gothic Rock",
  "Alternative Rock",
  "Classic Rock",
  "Psychedelic Rock",
  "Progressive Rock",
  // Neoclassical
  "Neoclassical Metal",
  // Other named genres
  "Darkwave",
  "Shoegaze",
  "Neofolk",
  "Synthwave",
  "EBM",
  "Electronica",
  "Techno",
  "Chiptune",
  "Dubstep",
  // Punk / Hardcore / Core
  "Crust Punk",
  "Hardcore Punk",
  "Post-Hardcore",
  "Metalcore",
  "Deathcore",
  "Grindcore",
  "Goregrind",
  "Cybergrind",
  "Hardcore",
  "Crossover",
  "Powerviolence",
  // Standalone roots (appear after slash-expansion or used as abbreviations)
  "Doom",
  "Sludge",
  "Drone",
  "Folk",
  "Metal",
  "Rock",
  "Punk",
  "Crust",
  "Noise",
  "Ambient",
  "Electronic",
  "Industrial",
  "Jazz",
  "Blues",
  "Fusion",
  "Shred",
  // Standalone-period genres (appear as sole genre in period, e.g. "AOR (later)")
  "AOR",
  "Grunge",
  "NWOBHM",
  "Noisegrind",
  "Grind 'n' Roll",
  "Rap Rock",
  "Glitch",
  // Special genre tags
  "Djent",
  "RAC",
];

// Normalize for lookup: lowercase and collapse hyphens to spaces.
// This makes "Nu-Metal" match "Nu Metal", "Post-Rock" match "Post Rock", etc.
const normalizeKey = (s) => s.toLowerCase().replace(/-/g, " ");
const MAIN_GENRES_SET = new Set(MAIN_GENRES.map(normalizeKey));
// Maps normalized key → canonical spelling (first entry wins for duplicates)
const MAIN_GENRES_CANONICAL = new Map(MAIN_GENRES.map((g) => [normalizeKey(g), g]));

// Words that signal a MULTI-WORD complete slash-segment during slash expansion.
// Single-word genres ("Doom", "Sludge", "Drone", ...) are handled by the
// words.length===1 path so they don't need to be listed here.
const GENRE_ROOTS = new Set([
  "Metal",
  "Core",
  "Rock",
  "Punk",
  "Jazz",
  "Blues",
  "Noise",
  "Electronic",
  "Industrial",
  "Ambient",
  "Crossover",
  "Folk",
  "Neofolk",
  "Synthwave",
  "EBM",
  "Electronica",
  "Darkwave",
]);

/**
 * Given a fully-expanded genre string like "Melodic Black Metal", find the
 * longest suffix that is a known main genre and split into genre + modifiers.
 *
 * "Melodic Black Metal"    → { genre: "Black Metal",  modifiers: ["Melodic"] }
 * "Experimental Grindcore" → { genre: "Grindcore",    modifiers: ["Experimental"] }
 * "Death Metal"            → { genre: "Death Metal",  modifiers: [] }
 * "Spaghetti Noise"        → { genre: "Spaghetti Noise", modifiers: [] }  (unknown)
 */
function extractComponents(str) {
  const words = str.trim().split(/\s+/);
  for (let len = words.length; len >= 1; len--) {
    const candidate = words.slice(words.length - len).join(" ");
    const key = normalizeKey(candidate);
    if (MAIN_GENRES_SET.has(key)) {
      return {
        genre: MAIN_GENRES_CANONICAL.get(key) ?? candidate,
        modifiers: words.slice(0, words.length - len).filter(Boolean),
      };
    }
  }
  return { genre: str.trim(), modifiers: [] };
}

/**
 * Expand slash-joined genre tokens into individual genre strings.
 *
 * "Brutal/Technical Death Metal"             → ["Brutal Death Metal", "Technical Death Metal"]
 * "Experimental Black/Death Metal/Grindcore" → ["Experimental Black Metal", "Death Metal", "Grindcore"]
 * "Technical Death Metal/Grindcore"          → ["Technical Death Metal", "Grindcore"]
 */
function expandSlash(token) {
  if (!token.includes("/")) return [token.trim()];
  const parts = token.split("/").map((p) => p.trim());
  const result = [];
  const pending = []; // items waiting for a suffix to combine with

  for (const part of parts) {
    const words = part.split(" ");
    const lastWord = words[words.length - 1];
    const partLower = normalizeKey(part);
    const isComplete = GENRE_ROOTS.has(lastWord) || MAIN_GENRES_SET.has(partLower);

    if (!isComplete || words.length === 1) {
      // Incomplete modifiers ("Brutal", "Symphonic") AND single-word complete tokens
      // ("Folk", "EBM", "Metal") all go to pending. Single-word complete tokens
      // wait in case a multi-word suffix can upgrade them (Folk → Folk Metal),
      // and will be flushed as-is at the end if nothing upgrades them.
      pending.push(part);
    } else {
      // Multi-word complete token — distribute its suffix to every pending item.
      const suffix = words.slice(1).join(" "); // always non-empty here
      for (const p of pending) {
        const combined = `${p} ${suffix}`;
        if (MAIN_GENRES_SET.has(normalizeKey(p))) {
          // p is already a standalone genre: combine only if the result is also known
          result.push(MAIN_GENRES_SET.has(normalizeKey(combined)) ? combined : p);
        } else {
          // p is a modifier: always combine
          result.push(combined);
        }
      }
      pending.length = 0;
      result.push(part);
    }
  }

  // Flush remaining pending items.
  // If the last pending item normalises to a known multi-word genre (e.g.
  // "Nu-Metal" → "Nu Metal"), infer its suffix and combine with earlier
  // pending items so that "Groove/Nu-Metal" → ["Groove Metal", "Nu Metal"].
  if (pending.length > 1) {
    const last = pending[pending.length - 1];
    const canonical = MAIN_GENRES_CANONICAL.get(normalizeKey(last));
    if (canonical) {
      const cWords = canonical.split(" ");
      if (cWords.length > 1) {
        const suffix = cWords.slice(1).join(" ");
        for (let i = 0; i < pending.length - 1; i++) {
          const p = pending[i];
          const combined = `${p} ${suffix}`;
          if (MAIN_GENRES_SET.has(normalizeKey(p))) {
            result.push(MAIN_GENRES_SET.has(normalizeKey(combined)) ? combined : p);
          } else {
            result.push(combined);
          }
        }
        result.push(canonical);
        pending.length = 0;
      }
    }
  }
  for (const p of pending) result.push(p);
  return result;
}

/**
 * Parse one genre segment (no semicolons) into { genres, modifiers, influences }.
 */
function parseSegment(segmentStr) {
  const withMatch = segmentStr.match(/^(.+?)\s+with\s+(.+?)\s+(?:influences?|elements)\s*$/i);
  const coreStr = withMatch ? withMatch[1].trim() : segmentStr;
  const influenceStr = withMatch ? withMatch[2].trim() : null;

  const expanded = coreStr
    .split(",")
    .flatMap((t) => expandSlash(t.trim()))
    .filter(Boolean);

  const genres = [];
  const modifiers = [];
  for (const e of expanded) {
    const { genre, modifiers: mods } = extractComponents(e);
    if (!genres.includes(genre)) genres.push(genre);
    for (const m of mods) {
      if (!modifiers.includes(m)) modifiers.push(m);
    }
  }

  const influences = influenceStr
    ? influenceStr
        .split(/,|\band\b/i)
        .flatMap((t) => expandSlash(t.trim()))
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return { genres, modifiers, influences };
}

/**
 * Parse a raw genre string from Metal Archives into a structured object.
 *
 * No evolution:
 *   "Experimental Black/Death Metal, Grindcore"
 *   → { _raw, changed: false, genres: ["Black Metal","Death Metal","Grindcore"], modifiers: ["Experimental"], influences: [] }
 *
 * With evolution:
 *   "Death Metal (early); Melodic Death Metal (later)"
 *   → { _raw, changed: true, periods: [
 *        { era: "early", genres: ["Death Metal"], modifiers: [], influences: [] },
 *        { era: "later", genres: ["Death Metal"], modifiers: ["Melodic"], influences: [] }
 *      ] }
 *
 * On error: []
 */
export function parseGenres(raw) {
  try {
    if (!raw) return null;

    const PERIOD_RE = /^(.+?)\s*\(([^)]+)\)\s*$/;
    const segments = raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    const parsed = segments.map((s) => {
      const m = PERIOD_RE.exec(s);
      const { genres, modifiers, influences } = parseSegment(m ? m[1] : s);
      return { era: m ? m[2].trim().toLowerCase() : null, genres, modifiers, influences };
    });

    const hasEras = parsed.some((p) => p.era !== null);

    if (hasEras) {
      return parsed.map(({ era, genres, modifiers, influences }) => ({
        era: era ?? "unknown",
        genres,
        modifiers,
        influences,
      }));
    }

    return [
      {
        era: "current",
        genres: [...new Set(parsed.flatMap((p) => p.genres))],
        modifiers: [...new Set(parsed.flatMap((p) => p.modifiers))],
        influences: [...new Set(parsed.flatMap((p) => p.influences))],
      },
    ];
  } catch {
    return [];
  }
}
