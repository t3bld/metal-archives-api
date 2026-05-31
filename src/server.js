import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./api/app.js";
import { closeBrowserSession } from "./scrapers/browserSession.js";

const app = createApp();
const port = parseInt(process.env.PORT ?? "3000", 10);

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`Server started on http://localhost:${port}/docs`);
});

const shutdown = async () => {
  await closeBrowserSession();
  server.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
