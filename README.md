# Metal Archives Scraper

Scrapes [Encyclopaedia Metallum](https://www.metal-archives.com) and exposes the data via a REST API or CLI tool.

> **Fair use notice**
> This tool is intended for personal, non-commercial use. Please be respectful of the Metal Archives team and their infrastructure — use reasonable delays, avoid hammering the site, and do not run large-scale scraping jobs without consideration for the impact. The Metal Archives database is a labour of love by a dedicated community.

## Tech Stack

- Node.js, Zod
- Playwright
- Hono (REST API)
- Railway (Hosting)

## Cloud Proxy Notice

Running this scraper in a cloud environment (e.g. Railway) requires a proxy service like [BrightData](https://brightdata.com) to route requests through a residential IP. This is necessary because cloud server IPs are blocked by the site's bot protection.

**This is not recommended for large-scale use.** Running thousands of requests through a paid proxy service is expensive and puts unnecessary load on Metal Archives. If you just need to look something up, use the CLI locally — no proxy is required.

This is configured via the `.env` file:

```env
# Set to true only when running in a cloud environment
BRIGHTDATA_ENABLED=false
BRIGHTDATA_WS_ENDPOINT=wss://brd-customer-...@brd.superproxy.io:9222
```

## Getting Started

```bash
npm install
cp .env.example .env
```

Fill in `METAL_ARCHIVES_BASE_URL=https://www.metal-archives.com` in `.env`. Leave `BRIGHTDATA_ENABLED=false` for local use.

### Use REST API

```bash
npm run start:api
```

Swagger UI available at `http://localhost:3000/docs`.

### Use CLI

```
node src/index.js --<object> <id|name> [--output <file>] [--limit <n>] [--delay <s>]
```

| Flag | `<id\|name>` | Description |
|---|---|---|
| `--artist` | required | Scrape an artist (band) |
| `--releases` | required | Scrape a release |
| `--persons` | required | Scrape a person (musician profile) |
| `--labels` | required | Scrape a label |
| `--country` | `<code\|name>` | Scrape artist list for a country (e.g. `DE`, `Germany`) |

| Flag | Description |
|---|---|
| `--output <file>` | Write result to a JSON file (default: stdout) |
| `--limit <n>` | Max items in list results (default: 50) |
| `--delay <s>` | Seconds to wait between requests (default: 1) |

**Examples**

```bash
node src/index.js --artist "Metallica"
node src/index.js --artist 125
node src/index.js --releases "Master of Puppets"
node src/index.js --persons "James Hetfield"
node src/index.js --labels "Nuclear Blast"
node src/index.js --country DE --output bands.json
```

