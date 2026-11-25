// Servidor estático mínimo para testar a versão local (simula GitHub Pages com subpasta).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(process.argv[2] ?? "out");
const BASE = process.env.BASE ?? "";
const PORT = Number(process.env.PORT ?? 3300);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain", ".ico": "image/x-icon", ".woff2": "font/woff2" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (BASE && !p.startsWith(BASE)) { res.writeHead(404); return res.end("fora da base"); }
  p = p.slice(BASE.length) || "/";
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith("/")) { res.writeHead(301, { Location: `${BASE}${p}/` }); return res.end(); }
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file)) { res.writeHead(404, { "Content-Type": "text/html" }); return res.end(fs.existsSync(path.join(ROOT, "404.html")) ? fs.readFileSync(path.join(ROOT, "404.html")) : "404"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`servindo ${ROOT} em http://localhost:${PORT}${BASE}/`));
