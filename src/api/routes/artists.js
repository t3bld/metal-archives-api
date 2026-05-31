import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { scrapeArtist } from "../../scrapers/scrapeArtist.js";
import { searchArtists } from "../../scrapers/search.js";
import { ArtistSchema, ParsedGenresSchema } from "../../scrapers/schema/index.js";

const ErrorSchema = z.object({ error: z.string() });

const ArtistSearchResultSchema = z.array(
  z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    genres: ParsedGenresSchema.nullable(),
    country: z.string().nullable(),
  })
);

const searchRoute = createRoute({
  method: "get",
  path: "/artists/search",
  tags: ["Artists"],
  summary: "Search artists by name",
  request: { query: z.object({ q: z.string().min(1) }) },
  responses: {
    200: {
      content: { "application/json": { schema: ArtistSearchResultSchema } },
      description: "Matching artists",
    },
  },
});

const detailRoute = createRoute({
  method: "get",
  path: "/artists/{id}",
  tags: ["Artists"],
  summary: "Scrape full artist detail by ID",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: ArtistSchema } },
      description: "Artist detail",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Artist not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Scrape error",
    },
  },
});

export const artistsRouter = new OpenAPIHono();

artistsRouter.openapi(searchRoute, async (c) => {
  const { q } = c.req.valid("query");
  const results = await searchArtists(q);
  return c.json(results);
});

artistsRouter.openapi(detailRoute, async (c) => {
  const { id } = c.req.valid("param");
  try {
    const artist = await scrapeArtist({ id });
    return c.json(artist);
  } catch (err) {
    if (err.message?.includes("404")) return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});
