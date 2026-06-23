import { createServer } from "node:http";
import { parse } from "node:url";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

for (const file of envFiles(dev)) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) loadDotenv({ path, override: false });
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  await app.prepare();

  const [{ createSignalingServer }, { verifySessionToken }, { verifyChildToken }] = await Promise.all([
    import("./src/realtime/signalingServer"),
    import("./src/lib/auth"),
    import("./src/lib/childToken")
  ]);

  const server = createServer((request, response) => {
    const parsedUrl = parse(request.url ?? "/", true);
    void handle(request, response, parsedUrl);
  });

  createSignalingServer({
    server,
    path: "/ws",
    verifyAdminToken: async (token) => {
      const payload = await verifySessionToken(token);
      return payload ? { id: payload.adminId, email: payload.email } : null;
    },
    verifyChildToken
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Signaling WebSocket ready on ws://localhost:${port}/ws`);
  });
}

function envFiles(isDev: boolean) {
  return isDev
    ? [".env.development.local", ".env.local", ".env.development", ".env"]
    : [".env.production.local", ".env.local", ".env.production", ".env"];
}
