/**
 * Every statement uses MERGE so re-importing is safe (idempotent).
 * Similar-artist edges are deferred — call importSimilarArtistEdges()
 * separately once all artists are in the database.
 */

import neo4j from "neo4j-driver";
import { getDriver, getDatabase } from "./client.js";

function int(v) {
  return v != null ? neo4j.int(v) : null;
}

export async function importArtist(band) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (b:Artist {id: $id})
         ON CREATE SET b.createdAt = datetime()
         ON MATCH SET  b.updatedAt = datetime()
         SET b.name      = $name,
             b.url       = $url,
             b.status    = $status,
             b.formedIn  = $formedIn,
             b.scrapedAt = datetime()`,
        {
          id: band.id,
          name: band.name,
          url: band.url,
          status: band.status,
          formedIn: band.formedIn,
        }
      );

      if (band.country) {
        await tx.run(
          `MERGE (c:Country {code: $code})
           ON CREATE SET c.createdAt = datetime()
           WITH c
           MATCH (b:Artist {id: $artistId})
           MERGE (b)-[:FORMED_IN]->(c)`,
          { code: band.country, artistId: band.id }
        );
      }

      if (band.label) {
        const labelKey = band.label.url ?? `name:${band.label.name}`;
        await tx.run(
          `MERGE (l:Label {url: $url})
           ON CREATE SET l.createdAt = datetime()
           ON MATCH SET  l.updatedAt = datetime()
           SET l.name    = $name,
               l.labelId = $labelId
           WITH l
           MATCH (b:Artist {id: $artistId})
           MERGE (b)-[:SIGNED_TO]->(l)`,
          {
            url: labelKey,
            name: band.label.name,
            labelId: band.label.id ?? null,
            artistId: band.id,
          }
        );
      }

      if (band.genres) {
        const entries = band.genres.flatMap((p) =>
          p.genres.map((g) => ({
            name: g,
            modifiers: p.modifiers,
            influences: p.influences,
            period: p.era,
          }))
        );

        for (const entry of entries) {
          await tx.run(
            `MERGE (g:Genre {name: $name})
             ON CREATE SET g.createdAt = datetime()
             WITH g
             MATCH (b:Artist {id: $artistId})
             MERGE (b)-[r:PLAYS_GENRE {period: $period}]->(g)
             SET r.modifiers  = $modifiers,
                 r.influences = $influences`,
            {
              name: entry.name,
              artistId: band.id,
              period: entry.period,
              modifiers: entry.modifiers,
              influences: entry.influences,
            }
          );
        }
      }

      if (band.themes) {
        for (const theme of band.themes) {
          await tx.run(
            `MERGE (t:Theme {name: $name})
             ON CREATE SET t.createdAt = datetime()
             WITH t
             MATCH (b:Artist {id: $artistId})
             MERGE (b)-[:HAS_THEME]->(t)`,
            { name: theme, artistId: band.id }
          );
        }
      }

      const allMembers = [
        ...band.members.current.map((m) => ({ ...m, memberType: "current" })),
        ...band.members.past.map((m) => ({ ...m, memberType: "past" })),
        ...band.members.live.map((m) => ({ ...m, memberType: "live" })),
      ];

      for (const member of allMembers) {
        if (!member.url) continue;

        await tx.run(
          `MERGE (p:Person {url: $url})
           ON CREATE SET p.name = $name, p.personId = $personId, p.createdAt = datetime()
           ON MATCH SET  p.updatedAt = datetime()
           WITH p
           MATCH (b:Artist {id: $artistId})
           MERGE (p)-[r:PLAYED_IN {memberType: $memberType}]->(b)
           SET r.roles       = $roles,
               r.yearsActive = $yearsActive`,
          {
            url: member.url,
            name: member.name,
            personId: member.id ?? null,
            artistId: band.id,
            memberType: member.memberType,
            roles: member.roles,
            yearsActive: member.yearsActive.map((y) => `${y.from ?? "?"}–${y.to ?? "?"}`),
          }
        );
      }

      for (const album of band.discography) {
        if (!album.url && !album.id) continue;
        await tx.run(
          `MERGE (r:Release {url: $url})
           ON CREATE SET r.createdAt = datetime()
           ON MATCH SET  r.updatedAt = datetime()
           SET r.title   = $title,
               r.albumId = $albumId
           WITH r
           MATCH (b:Artist {id: $artistId})
           MERGE (b)-[:RELEASED]->(r)`,
          {
            url: album.url ?? album.id,
            title: album.title,
            albumId: album.id ?? null,
            artistId: band.id,
          }
        );
      }
    });
  } finally {
    await session.close();
  }
}

/**
 * Add SIMILAR_TO edges between Artist nodes already in the database.
 * Call this after all artists have been imported.
 *
 * @param {Band} band
 */
export async function importSimilarArtistEdges(band) {
  if (!band.similarArtists?.length) return;

  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });

  try {
    await session.executeWrite(async (tx) => {
      for (const similar of band.similarArtists) {
        if (!similar.url) continue;
        await tx.run(
          `MATCH (source:Artist {id: $artistId})
           MATCH (target:Artist {url: $targetUrl})
           MERGE (source)-[r:SIMILAR_TO]->(target)
           SET r.score = $score`,
          {
            artistId: band.id,
            targetUrl: similar.url,
            score: int(similar.score),
          }
        );
      }
    });
  } finally {
    await session.close();
  }
}

export async function getPendingArtists(limit = 50) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });
  try {
    const result = await session.run(
      `MATCH (b:Artist)
       WHERE b.scrapedAt IS NULL AND b.id IS NOT NULL
       RETURN b.id AS id, b.url AS url
       LIMIT $limit`,
      { limit: neo4j.int(limit) }
    );
    return result.records.map((r) => ({ id: r.get("id"), url: r.get("url") }));
  } finally {
    await session.close();
  }
}
