/**
 * Merges into the stub Person node that importArtist.js already created,
 * enriching it with personal info.
 * Sets `scrapedAt` so the person is not re-processed by getPendingPersons.
 */

import neo4j from "neo4j-driver";
import { getDriver, getDatabase } from "./client.js";

export async function importPerson(person) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (p:Person {url: $url})
         ON CREATE SET p.createdAt = datetime()
         ON MATCH SET  p.updatedAt = datetime()
         SET p.pseudonym     = $pseudonym,
             p.name          = $name,
             p.age           = $age,
             p.birthDate     = $birthDate,
             p.birthCity      = $birthCity,
             p.birthRegion    = $birthRegion,
             p.birthTerritory = $birthTerritory,
             p.birthCountry   = $birthCountry,
             p.gender        = $gender,
             p.scrapedAt     = datetime()`,
        {
          url: person.url,
          pseudonym: person.pseudonym,
          name: person.name,
          age: person.age != null ? neo4j.int(person.age) : null,
          birthDate: person.birth?.date ?? null,
          birthCity: person.birth?.city ?? null,
          birthRegion: person.birth?.region ?? null,
          birthTerritory: person.birth?.territory ?? null,
          birthCountry: person.birth?.country ?? null,
          gender: person.gender,
        }
      );

      if (person.birth?.country) {
        await tx.run(
          `MERGE (c:Country {code: $code})
           ON CREATE SET c.createdAt = datetime()
           WITH c
           MATCH (p:Person {url: $personUrl})
           MERGE (p)-[:BORN_IN]->(c)`,
          { code: person.birth.country, personUrl: person.url }
        );
      }
    });
  } finally {
    await session.close();
  }
}

export async function getPendingPersons(limit = 50) {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });
  try {
    const result = await session.run(
      `MATCH (p:Person)
       WHERE p.scrapedAt IS NULL AND (p.personId IS NOT NULL OR p.url IS NOT NULL)
       RETURN p.personId AS id, p.url AS url
       LIMIT $limit`,
      { limit: neo4j.int(limit) }
    );
    return result.records.map((r) => ({ id: r.get("id"), url: r.get("url") }));
  } finally {
    await session.close();
  }
}
