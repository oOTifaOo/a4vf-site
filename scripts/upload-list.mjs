// So dist/deploy-manifest.json với bản đang chạy trên website, rồi ghi lệnh lftp chỉ cho các file đã đổi.
// Chạy: OLD_MANIFEST=old-manifest.json node scripts/upload-list.mjs > upload.lftp
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

const REMOTE_ROOT = "public_html";
const fresh = JSON.parse(await readFile("dist/deploy-manifest.json", "utf8"));
let old = {};
try {
  old = JSON.parse(await readFile(process.env.OLD_MANIFEST, "utf8"));
} catch {
  console.error("Chưa có manifest cũ, tải toàn bộ.");
}

const changed = Object.keys(fresh).filter((path) => fresh[path] !== old[path]);
const quote = (text) => `"${text.replace(/(["\\])/g, "\\$1")}"`;
const lines = [];
for (const dir of new Set(changed.map(dirname))) lines.push(`mkdir -p -f ${quote(`${REMOTE_ROOT}/${dir}`)}`);
// HTML cuối cùng: file css, js mới phải có mặt trước khi trang trỏ tới chúng.
const order = (path) => (path.endsWith(".html") ? 1 : 0);
for (const path of changed.sort((a, b) => order(a) - order(b))) {
  lines.push(`put -O ${quote(`${REMOTE_ROOT}/${dirname(path)}`)} ${quote(`dist/${path}`)}`);
}
lines.push(`put -O ${quote(REMOTE_ROOT)} dist/deploy-manifest.json`);
console.log(lines.join("\n"));
console.error(`${changed.length} file đổi trên tổng ${Object.keys(fresh).length}.`);
