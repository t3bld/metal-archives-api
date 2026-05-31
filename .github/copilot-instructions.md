# Development Principles

## Language & Runtime
- Plain JavaScript, ESM (`"type": "module"`). No TypeScript.
- Node.js native APIs where possible. No polyfills.
- `import "dotenv/config"` at entry points only.

## Code Style
- Prettier enforces formatting — run `npm run format` after edits.
- Read the .prettierrc.json settings for formatting rules
- Prefer `const` and arrow functions. Avoid `var`.

## Comments
- **Keep** comments that explain *why* — non-obvious decisions, external quirks (Cloudflare, AJAX tab loading, DOM structure), constraint reasons.
- **Remove** comments that explain *what* or *how* — the code itself should be readable.
- No section banners (`// --- Helpers ---`), no numbered steps (`// 1. Artist node`), no `@typedef` blocks.

## Architecture
- Scrapers validate output with Zod `safeParse` — warn on failure, never throw.
- Neo4j writes use `MERGE` (idempotent). Always `executeWrite` for mutations.
- Extract shared utilities to `src/scrapers/parsers/` and re-export from its `index.js` barrel.
- Keep entry-point (`src/index.js`) as a thin dispatcher. Business logic lives in scrapers and model files.

