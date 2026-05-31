/**
 * Idempotent constraint + index setup.
 * Run once before any data is imported.
 *
 * Usage:
 *   node src/neo4j/constraints.js
 */

import "dotenv/config";
import { fileURLToPath } from "node:url";
import { getDriver, getDatabase, closeDriver } from "./client.js";

const CONSTRAINTS = [
  "CREATE CONSTRAINT artist_id   IF NOT EXISTS FOR (b:Artist)  REQUIRE b.id   IS UNIQUE",
  "CREATE CONSTRAINT person_url  IF NOT EXISTS FOR (p:Person)  REQUIRE p.url  IS UNIQUE",
  "CREATE CONSTRAINT release_url IF NOT EXISTS FOR (r:Release) REQUIRE r.url  IS UNIQUE",
  "CREATE CONSTRAINT label_url   IF NOT EXISTS FOR (l:Label)   REQUIRE l.url  IS UNIQUE",
  "CREATE CONSTRAINT genre_name  IF NOT EXISTS FOR (g:Genre)   REQUIRE g.name IS UNIQUE",
  "CREATE CONSTRAINT theme_name  IF NOT EXISTS FOR (t:Theme)   REQUIRE t.name IS UNIQUE",
  "CREATE CONSTRAINT country_code IF NOT EXISTS FOR (c:Country) REQUIRE c.code IS UNIQUE",
];

const INDEXES = [
  "CREATE FULLTEXT INDEX artistNames IF NOT EXISTS FOR (b:Artist) ON EACH [b.name]",
  "CREATE FULLTEXT INDEX personNames IF NOT EXISTS FOR (p:Person) ON EACH [p.name]",
];

export async function ensureConstraints() {
  const driver = getDriver();
  const session = driver.session({ database: getDatabase() });
  try {
    for (const cypher of [...CONSTRAINTS, ...INDEXES]) {
      await session.run(cypher);
    }
    console.log("  [neo4j] Constraints and indexes are up to date.");
  } finally {
    await session.close();
  }
}

// Allow running directly: node src/neo4j/constraints.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureConstraints()
    .then(() => closeDriver())
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
