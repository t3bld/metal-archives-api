import { browserFetch } from "./browserSession.js";
import { parseGenres } from "./parsers/index.js";

const BASE = process.env.METAL_ARCHIVES_BASE_URL;

async function metalArchivesFetch(url) {
  try {
    return await browserFetch(url);
  } catch (err) {
    throw new Error(`Metal Archives search failed: ${err.message}`);
  }
}

/**
 * Search for artists by name.
 *
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<ArtistSearchResult[]>}
 */
export async function searchArtists(query, { limit = 200 } = {}) {
  const url = new URL(`${BASE}/search/ajax-band-search/`);
  url.searchParams.set("field", "name");
  url.searchParams.set("query", query);
  url.searchParams.set("sEcho", "1");
  url.searchParams.set("iColumns", "3");
  url.searchParams.set("iDisplayStart", "0");
  url.searchParams.set("iDisplayLength", String(limit));

  const json = await metalArchivesFetch(url);

  // Row: ["<a href='.../bands/Name/ID'>Name</a> <!-- score -->", "genre", "country"]
  return (json.aaData ?? [])
    .map(([nameCell, genre, country]) => {
      const match = nameCell.match(/href="([^"]+)"[^>]*>([^<]+)</);
      const href = match?.[1] ?? null;
      const name = match?.[2]?.trim() ?? null;
      const id = href?.match(/\/(\d+)\s*$/)?.[1] ?? null;
      return {
        id,
        name,
        genres: parseGenres(genre?.trim() ?? null),
        country: country?.trim() ?? null,
      };
    })
    .filter((r) => r.id && r.name)
    .slice(0, limit);
}

/**
 * Search for releases by title.
 *
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<ReleaseSearchResult[]>}
 */
export async function searchReleases(query, { limit = 200 } = {}) {
  const url = new URL(`${BASE}/search/ajax-advanced/searching/albums/`);
  url.searchParams.set("releaseTitle", query);
  url.searchParams.set("sEcho", "1");
  url.searchParams.set("iColumns", "3");
  url.searchParams.set("iDisplayStart", "0");
  url.searchParams.set("iDisplayLength", String(limit));

  const json = await metalArchivesFetch(url);

  // Row: [artistCell, releaseCell, type]
  // artistCell: <a href=".../bands/Name/ArtistId" title="Name (Country)">Name</a>
  // releaseCell: <a href=".../albums/Name/Title/ReleaseId">Title</a>
  return (json.aaData ?? [])
    .map(([artistCell, releaseCell, type]) => {
      const artistMatch = artistCell.match(/href="([^"]+\/(\d+))"[^>]*>([^<]+)</);
      const releaseMatch = releaseCell.match(/href="[^"]+\/(\d+)"[^>]*>([^<]+)</);
      return {
        id: releaseMatch?.[1] ?? null,
        title: releaseMatch?.[2]?.trim() ?? null,
        artist: {
          id: artistMatch?.[2] ?? null,
          name: artistMatch?.[3]?.trim() ?? null,
          url: artistMatch?.[1] ?? null,
        },
        type: type?.trim() ?? null,
      };
    })
    .filter((r) => r.id && r.title)
    .slice(0, limit);
}

/**
 * Search for persons by pseudonym or real name.
 *
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<PersonSearchResult[]>}
 */
export async function searchPersons(query, { limit = 200 } = {}) {
  const url = new URL(`${BASE}/search/ajax-advanced/searching/artists/`);
  url.searchParams.set("artistName", query);
  url.searchParams.set("sEcho", "1");
  url.searchParams.set("iColumns", "4");
  url.searchParams.set("iDisplayStart", "0");
  url.searchParams.set("iDisplayLength", String(limit));

  const json = await metalArchivesFetch(url);

  // Row: [personCell, realName, country, bandsCell]
  // personCell: <a href=".../artists/Name/ID">Pseudonym</a>
  return (json.aaData ?? [])
    .map(([personCell, realName, country]) => {
      const match = personCell.match(/href="([^"]+)"[^>]*>([^<]+)</);
      const href = match?.[1] ?? null;
      const pseudonym = match?.[2]?.trim() ?? null;
      const id = href?.match(/\/(\d+)\s*$/)?.[1] ?? null;
      return {
        id,
        pseudonym,
        name: realName?.trim() || null,
        country: country?.trim() || null,
      };
    })
    .filter((r) => r.id && r.pseudonym)
    .slice(0, limit);
}

/**
 * Search for labels by name.
 *
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<LabelSearchResult[]>}
 */
export async function searchLabels(query, { limit = 200 } = {}) {
  const url = new URL(`${BASE}/search/ajax-advanced/searching/labels/`);
  url.searchParams.set("labelName", query);
  url.searchParams.set("sEcho", "1");
  url.searchParams.set("iColumns", "3");
  url.searchParams.set("iDisplayStart", "0");
  url.searchParams.set("iDisplayLength", String(limit));

  const json = await metalArchivesFetch(url);

  // Row: [nameCel, country, status]
  // nameCell: <a href=".../labels/Name/ID">Name</a>
  return (json.aaData ?? [])
    .map(([nameCell, country, status]) => {
      const match = nameCell.match(/href="([^"]+)"[^>]*>([^<]+)</);
      const href = match?.[1] ?? null;
      const name = match?.[2]?.trim() ?? null;
      const id = href?.match(/\/(\d+)\s*$/)?.[1] ?? null;
      return { id, name, country: country?.trim() || null, status: status?.trim() || null };
    })
    .filter((r) => r.id && r.name)
    .slice(0, limit);
}
