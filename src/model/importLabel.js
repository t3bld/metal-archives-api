/**
 * Merges into the stub Label node that importBand.js already created,
 * enriching it with full metadata and sub-label edges.
 * Sets `scrapedAt` so the label is not re-processed by getPendingLabels.
 */

import neo4j from "neo4j-driver";
import { getDriver, getDatabase } from "./client.js";

export async function importLabel(label) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (l:Label {url: $url})
         ON CREATE SET l.createdAt = datetime()
         ON MATCH SET  l.updatedAt = datetime()
         SET l.name           = $name,
             l.address        = $address,
             l.phone          = $phone,
             l.status         = $status,
             l.specialties    = $specialties,
             l.foundingDate   = $foundingDate,
             l.onlineShopping = $onlineShopping,
             l.website        = $website,
             l.scrapedAt      = datetime()`,
        {
          url: label.url,
          name: label.name,
          address: label.address,
          phone: label.phone,
          status: label.status,
          specialties: label.specialties,
          foundingDate: label.foundingDate,
          onlineShopping: label.onlineShopping,
          website: label.website,
        }
      );

      if (label.country) {
        await tx.run(
          `MERGE (c:Country {code: $code})
           ON CREATE SET c.createdAt = datetime()
           WITH c
           MATCH (l:Label {url: $labelUrl})
           MERGE (l)-[:BASED_IN]->(c)`,
          { code: label.country, labelUrl: label.url }
        );
      }

      for (const sub of label.subLabels) {
        if (!sub.url) continue;
        const subId = (sub.url.match(/\/([0-9]+)\/?(?:#.*)?$/) ?? [])[1] ?? null;
        await tx.run(
          `MERGE (s:Label {url: $subUrl})
           ON CREATE SET s.name = $subName, s.labelId = $subId, s.createdAt = datetime()
           ON MATCH SET  s.updatedAt = datetime()
           WITH s
           MATCH (p:Label {url: $parentUrl})
           MERGE (s)-[:SUB_LABEL_OF]->(p)`,
          { subUrl: sub.url, subName: sub.name, subId, parentUrl: label.url }
        );
      }
    });
  } finally {
    await session.close();
  }
}

export async function getPendingLabels(limit = 50) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });
  try {
    const result = await session.run(
      `MATCH (l:Label)
       WHERE l.scrapedAt IS NULL AND (l.labelId IS NOT NULL OR l.url IS NOT NULL)
       RETURN l.labelId AS id, l.url AS url
       LIMIT $limit`,
      { limit: neo4j.int(limit) }
    );
    return result.records.map((r) => ({ id: r.get("id"), url: r.get("url") }));
  } finally {
    await session.close();
  }
}
