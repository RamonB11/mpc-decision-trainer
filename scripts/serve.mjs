import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const root = process.cwd();

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const normalized = normalize(relative);

  if (normalized.startsWith("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const filePath = join(root, normalized);

  try {
    if (!statSync(filePath).isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type": types[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`MPC Decision Trainer test server: http://${host}:${port}`);
});
