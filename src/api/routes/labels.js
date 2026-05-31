import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { scrapeLabel } from "../../scrapers/scrapeLabel.js";
import { searchLabels } from "../../scrapers/search.js";
import { LabelDetailSchema } from "../../scrapers/schema/index.js";

const ErrorSchema = z.object({ error: z.string() });

const LabelSearchResultSchema = z.array(
  z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    country: z.string().nullable(),
    status: z.string().nullable(),
  })
);

const searchRoute = createRoute({
  method: "get",
  path: "/labels/search",
  tags: ["Labels"],
  summary: "Search labels by name",
  request: { query: z.object({ q: z.string().min(1) }) },
  responses: {
    200: {
      content: { "application/json": { schema: LabelSearchResultSchema } },
      description: "Matching labels",
    },
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/labels/{id}",
  tags: ["Labels"],
  summary: "Scrape full label detail by ID",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: LabelDetailSchema } },
      description: "Label detail",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Label not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Scrape error",
    },
  },
});

export const labelsRouter = new OpenAPIHono();

labelsRouter.openapi(searchRoute, async (c) => {
  const { q } = c.req.valid("query");
  const results = await searchLabels(q);
  return c.json(results);
});

labelsRouter.openapi(detailRoute, async (c) => {
  const { id } = c.req.valid("param");
  try {
    const label = await scrapeLabel({ id });
    return c.json(label);
  } catch (err) {
    if (err.message?.includes("404")) return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});
