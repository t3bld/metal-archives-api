/**
 * Merges into the stub Release node that importArtist.js already created,
 * enriching it with full metadata, a label edge, and lineup edges.
 * Sets `scrapedAt` so the release is not re-processed by getPendingReleases.
 */

import neo4j from "neo4j-driver";
import { getDriver, getDatabase } from "./client.js";

function int(v) {
  return v != null ? neo4j.int(v) : null;
}

export async function importRelease(album) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (r:Release {url: $url})
         ON CREATE SET r.createdAt  = datetime()
         ON MATCH SET  r.updatedAt  = datetime()
         SET r.title        = $title,
             r.type         = $type,
             r.releaseDate  = $releaseDate,
             r.catalogId    = $catalogId,
             r.versionDesc  = $versionDesc,
             r.format       = $format,
             r.reviewCount  = $reviewCount,
             r.reviewScore  = $reviewScore,
             r.tracks       = $tracks,
             r.scrapedAt    = datetime()`,
        {
          url: album.url,
          title: album.title,
          type: album.type,
          releaseDate: album.releaseDate,
          catalogId: album.catalogId,
          versionDesc: album.versionDesc,
          format: album.format,
          reviewCount: int(album.reviewCount),
          reviewScore: int(album.reviewScore),
          // Neo4j doesn't support arrays of maps as properties; store as JSON.
          tracks: JSON.stringify(album.tracks),
        }
      );

      if (album.label) {
        const labelKey = album.label.url ?? `name:${album.label.name}`;
        await tx.run(
          `MERGE (l:Label {url: $url})
           ON CREATE SET l.createdAt = datetime()
           ON MATCH SET  l.updatedAt = datetime()
           SET l.name = $name
           WITH l
           MATCH (r:Release {url: $releaseUrl})
           MERGE (r)-[:RELEASED_BY]->(l)`,
          { url: labelKey, name: album.label.name, releaseUrl: album.url }
        );
      }

      for (const performer of album.lineup) {
        if (!performer.url) continue;
        await tx.run(
          `MERGE (p:Person {url: $url})
           ON CREATE SET p.name = $name, p.createdAt = datetime()
           ON MATCH SET  p.updatedAt = datetime()
           WITH p
           MATCH (r:Release {url: $releaseUrl})
           MERGE (p)-[rel:PERFORMED_ON]->(r)
           SET rel.roles   = $roles,
               rel.section = $section`,
          {
            url: performer.url,
            name: performer.name,
            releaseUrl: album.url,
            roles: performer.roles,
            section: performer.section,
          }
        );
      }
    });
  } finally {
    await session.close();
  }
}

export async function getPendingReleases(limit = 50) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });
  try {
    const result = await session.run(
      `MATCH (r:Release)
       WHERE r.scrapedAt IS NULL AND (r.albumId IS NOT NULL OR r.url IS NOT NULL)
       RETURN r.albumId AS id, r.url AS url
       LIMIT $limit`,
      { limit: neo4j.int(limit) }
    );
    return result.records.map((r) => ({ id: r.get("id"), url: r.get("url") }));
  } finally {
    await session.close();
  }
}
