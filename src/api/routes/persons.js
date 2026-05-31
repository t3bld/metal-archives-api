import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { scrapePerson } from "../../scrapers/scrapePerson.js";
import { searchPersons } from "../../scrapers/search.js";
import { PersonDetailSchema } from "../../scrapers/schema/index.js";

const ErrorSchema = z.object({ error: z.string() });

const PersonSearchResultSchema = z.array(
  z.object({
    id: z.string().nullable(),
    pseudonym: z.string().nullable(),
    name: z.string().nullable(),
    country: z.string().nullable(),
  })
);

const searchRoute = createRoute({
  method: "get",
  path: "/persons/search",
  tags: ["Persons"],
  summary: "Search persons by name or pseudonym",
  request: { query: z.object({ q: z.string().min(1) }) },
  responses: {
    200: {
      content: { "application/json": { schema: PersonSearchResultSchema } },
      description: "Matching persons",
    },
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/persons/{id}",
  tags: ["Persons"],
  summary: "Scrape full person detail by ID",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: PersonDetailSchema } },
      description: "Person detail",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Person not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Scrape error",
    },
  },
});

export const personsRouter = new OpenAPIHono();

personsRouter.openapi(searchRoute, async (c) => {
  const { q } = c.req.valid("query");
  const results = await searchPersons(q);
  return c.json(results);
});

personsRouter.openapi(detailRoute, async (c) => {
  const { id } = c.req.valid("param");
  try {
    const person = await scrapePerson({ id });
    return c.json(person);
  } catch (err) {
    if (err.message?.includes("404")) return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});
