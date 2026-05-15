import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};
const localEnv = await readLocalEnv();

async function readLocalEnv() {
  try {
    const content = await readFile(".env", "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        })
    );
  } catch {
    return {};
  }
}

createServer(async (request, response) => {
  try {
    if ((request.url || "").startsWith("/api/bgm")) {
      response.writeHead(302, {
        Location: "http://jihoo125.it.kr/audio/001.mp3",
        "Cache-Control": "no-store"
      });
      response.end();
      return;
    }

    if ((request.url || "").startsWith("/api/config")) {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      });
      response.end(
        JSON.stringify({
          supabaseUrl: process.env.SUPABASE_URL || localEnv.SUPABASE_URL || "",
          supabaseAnonKey: process.env.SUPABASE_ANON_KEY || localEnv.SUPABASE_ANON_KEY || ""
        })
      );
      return;
    }

    let urlPath = decodeURIComponent(new URL(request.url || "/", `http://${request.headers.host}`).pathname);
    if (urlPath === "/") urlPath = "/index.html";

    const filePath = resolve(join(root, urlPath));
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const data = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`Arrows preview: http://localhost:${port}`);
});
