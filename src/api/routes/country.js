import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { scrapeBands, resolveCountry } from "../../scrapers/fetchArtistsByCountry.js";
import { ArtistSummarySchema } from "../../scrapers/schema/index.js";

const ErrorSchema = z.object({ error: z.string() });

const countryRoute = createRoute({
  method: "get",
  path: "/country/{code}",
  tags: ["Country"],
  summary: "Scrape all bands for a country by ISO-2 code or full name",
  request: { params: z.object({ code: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(ArtistSummarySchema) } },
      description: "All bands for the country",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unknown country code or name",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Scrape error",
    },
  },
});

export const countryRouter = new OpenAPIHono();

countryRouter.openapi(countryRoute, async (c) => {
  const { code } = c.req.valid("param");
  let resolved;
  try {
    resolved = resolveCountry(code);
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
  try {
    const bands = await scrapeBands(resolved.code);
    return c.json(bands);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});
