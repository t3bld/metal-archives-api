/**
 * Neo4j driver singleton.
 *
 * Reads connection details from environment variables:
 *   NEO4J_URI      — bolt://localhost:7687
 *   NEO4J_USERNAME — neo4j
 *   NEO4J_PASSWORD — (required)
 *   NEO4J_DATABASE — neo4j  (optional)
 */

import neo4j from "neo4j-driver";

let _driver = null;

export function getDriver() {
  if (_driver) return _driver;

  const uri = process.env.NEO4J_URI ?? "bolt://localhost:7687";
  const username = process.env.NEO4J_USERNAME ?? "neo4j";
  const password = process.env.NEO4J_PASSWORD;

  if (!password) {
    throw new Error(
      "NEO4J_PASSWORD environment variable is required. " + "Set it or use a .env file."
    );
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  return _driver;
}

export function getDatabase() {
  return process.env.NEO4J_DATABASE ?? "neo4j";
}

export async function closeDriver() {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}
