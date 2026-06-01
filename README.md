# Metal Archives Scraper

Scrapes [Encyclopaedia Metallum](https://www.metal-archives.com) and exposes the data via a REST API or CLI tool.

> **Fair use notice:**
> This tool is intended for personal, non-commercial use. Please be respectful of the Metal Archives team and their infrastructure — use reasonable delays, avoid hammering the site and do not run large-scale scraping jobs without consideration for the impact. The Metal Archives database is a labour of love by a dedicated community.

## Technology Stack

- Node.js, Hono, Zod, Playwright
- Railway (Hosting #optional)
- Brightdata (Scraper Proxy #optional)

## Getting Started

```bash
npm install
cp .env.example .env
```

Afterwards configure your environment. Leave `BRIGHTDATA_ENABLED=false` for local use.

### Use REST API

```bash
npm run start:api
```

Swagger UI available at `http://localhost:3000/docs`.

### Use CLI

```
node src/index.js --<object> <id|name> [--output <file>] [--limit <n>]
```

| Flag | `<id\|name>` | Description |
|---|---|---|
| `--artist` | required | Scrape an artist |
| `--releases` | required | Scrape a release |
| `--persons` | required | Scrape a person |
| `--labels` | required | Scrape a label |
| `--country` | `<code\|name>` | Scrape artist list for a country (e.g. `DE`, `Germany`) |

| Flag | Description |
|---|---|
| `--output <file>` | Write result to a JSON file (default: stdout) |
| `--limit <n>` | Max search results to return (default: 200) |

**Examples**

```bash
node src/index.js --artist "Metallica"
node src/index.js --artist 125
node src/index.js --releases "Master of Puppets"
node src/index.js --persons "James Hetfield"
node src/index.js --labels "Nuclear Blast"
node src/index.js --country DE --output bands.json
```

## Cloud Proxy Notice

Running this scraper in a cloud environment e.g. Railway requires a proxy service like [BrightData](https://brightdata.com) to route requests through a residential IP. This is necessary because cloud server IPs are blocked by the site's bot protection.

**This is not recommended for large-scale use.** Running thousands of requests through a paid proxy service is expensive and puts unnecessary load on Metal Archives. If you just need to look something up, use the CLI locally — no proxy is required.

This is configured via the `.env` file:

```env
# Set to true only when running through a proxy is required
BRIGHTDATA_ENABLED=false
BRIGHTDATA_WS_ENDPOINT=wss://brd-customer-...@brd.superproxy.io:9222
```