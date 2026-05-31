import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { scrapeRelease } from "../../scrapers/scrapeRelease.js";
import { searchReleases } from "../../scrapers/search.js";
import { ReleaseDetailSchema } from "../../scrapers/schema/index.js";

const ErrorSchema = z.object({ error: z.string() });

const ReleaseSearchResultSchema = z.array(
  z.object({
    id: z.string().nullable(),
    title: z.string().nullable(),
    artist: z.object({
      id: z.string().nullable(),
      name: z.string().nullable(),
    }),
    type: z.string().nullable(),
  })
);

const searchRoute = createRoute({
  method: "get",
  path: "/releases/search",
  tags: ["Releases"],
  summary: "Search releases by title",
  request: { query: z.object({ q: z.string().min(1) }) },
  responses: {
    200: {
      content: { "application/json": { schema: ReleaseSearchResultSchema } },
      description: "Matching releases",
    },
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/releases/{id}",
  tags: ["Releases"],
  summary: "Scrape full release detail by ID",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: ReleaseDetailSchema } },
      description: "Release detail",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Release not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Scrape error",
    },
  },
});

export const releasesRouter = new OpenAPIHono();

releasesRouter.openapi(searchRoute, async (c) => {
  const { q } = c.req.valid("query");
  const results = await searchReleases(q);
  return c.json(results);
});

releasesRouter.openapi(detailRoute, async (c) => {
  const { id } = c.req.valid("param");
  try {
    const release = await scrapeRelease({ id });
    return c.json(release);
  } catch (err) {
    if (err.message?.includes("404")) return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});
