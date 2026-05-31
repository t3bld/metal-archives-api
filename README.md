# Metal Archives Scraper

Scrapes [Encyclopaedia Metallum](https://www.metal-archives.com), provides a REST API layer and builds a graph database.

## Techstack

- Node.js, Hono, Zod
- Playwright
- Neo4j

## Getting Started

```bash
npm install
cp .env.example .env
```

### Use REST API

Start the server:

```bash
npm run start:api
```

### Use CLI Commands

```
node src/index.js --<object> <id|name> [--output <file>] [--neo4j] [--limit <n>] [--delay <s>]
```

| Flag | `<id\|name>` | Description |
|---|---|---|
| `--artist` | required | Scrape an artist (band) |
| `--releases` | required | Scrape a release |
| `--persons` | required | Scrape a person (musician profile) |
| `--labels` | required | Scrape a label |
| `--releases` | — | Queue mode: enrich all pending release stubs in Neo4j |
| `--persons` | — | Queue mode: enrich all pending person stubs in Neo4j |
| `--labels` | — | Queue mode: enrich all pending label stubs in Neo4j |
| `--country` | `<code\|name>` | Scrape artist list for a country (e.g. `DE`, `Germany`) |


| Flag | Description |
|---|---|
| `--neo4j` | Persist result to Neo4j |
| `--output <file>` | Write result to a JSON file |
| `--limit <n>` | Max items to process in queue mode (default: 50) |
| `--delay <s>` | Seconds to wait between requests (default: 1) |

**Examples**

```bash
node src/index.js --artist "Metallica" 
node src/index.js --artist 125
node src/index.js --releases "Master of Puppets"
node src/index.js --persons "James Hetfield"
node src/index.js --labels "Nuclear Blast"
```
