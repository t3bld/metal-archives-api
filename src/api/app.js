import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { artistsRouter } from "./routes/artists.js";
import { releasesRouter } from "./routes/releases.js";
import { personsRouter } from "./routes/persons.js";
import { labelsRouter } from "./routes/labels.js";
import { countryRouter } from "./routes/country.js";

const API_KEY = process.env.API_KEY;

export function createApp() {
  const app = new OpenAPIHono();

  // Protect all /api/* routes with a Bearer token if API_KEY is set.
  // Set API_KEY in Railway environment variables to enable auth.
  if (API_KEY) {
    app.use("/api/*", async (c, next) => {
      const auth = c.req.header("Authorization");
      if (auth === `Bearer ${API_KEY}`) return next();
      return c.json({ error: "Unauthorized" }, 401);
    });
  }

  app.route("/api", artistsRouter);
  app.route("/api", releasesRouter);
  app.route("/api", personsRouter);
  app.route("/api", labelsRouter);
  app.route("/api", countryRouter);

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Metal Archives API",
      version: "1.0.0",
      description: "REST API over the Encyclopedia Metallum scraper",
    },
  });

  app.get("/docs", swaggerUI({ url: "/openapi.json" }));

  return app;
}
