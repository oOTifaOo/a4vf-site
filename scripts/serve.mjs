// Máy chủ web nhỏ để chạy thử trên máy: node scripts/serve.mjs [cổng]
// Không cần cài thêm gì ngoài Node.js. Mở http://localhost:8080
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, sep } from "node:path";
import { exec } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2]) || 8080;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};
// Chỉ phục vụ các file của website, không lộ script, file cấu hình, link Sheet...
const allowed = (p) => p === "index.html" || p === "data.js" || ["logos", "css", "js"].some((d) => p.startsWith(d + sep));

http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = normalize(join(root, rel));
    const sub = file.slice(root.length + 1);
    if (!file.startsWith(root + sep) || !allowed(sub)) { res.writeHead(404); return res.end("404"); }
    if (!(await stat(file)).isFile()) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, {
      "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store", // chạy thử: luôn lấy bản mới nhất
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end("404");
  }
}).listen(port, "127.0.0.1", () => {
  const url = `http://localhost:${port}`;
  console.log(`Đang chạy tại ${url}  (nhấn Ctrl+C để dừng)`);
  const open = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(open, () => {});
}).on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Cổng ${port} đang được dùng. Thử: node scripts/serve.mjs 8081` : e.message);
  process.exit(1);
});
