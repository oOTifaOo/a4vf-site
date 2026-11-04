// So dist/deploy-manifest.json với bản đang chạy trên website, rồi chia file đã đổi thành các lô lftp trong thư mục upload/.
// Chạy: OLD_MANIFEST=old-manifest.json node scripts/upload-list.mjs
// Thứ tự: thư mục -> css, js -> HTML -> manifest. Mỗi lô assets-*, html-* chạy song song trên một kết nối riêng.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const REMOTE_ROOT = "public_html";
const WORKERS = 5;
const OUTPUT = "upload";

const fresh = JSON.parse(await readFile("dist/deploy-manifest.json", "utf8"));
let old = {};
try {
  old = JSON.parse(await readFile(process.env.OLD_MANIFEST, "utf8"));
} catch {
  console.error("Chưa có manifest cũ, tải toàn bộ.");
}

const changed = Object.keys(fresh).filter((path) => fresh[path] !== old[path]);
const quote = (text) => `"${text.replace(/(["\\])/g, "\\$1")}"`;
const put = (path) => `put -O ${quote(`${REMOTE_ROOT}/${dirname(path)}`)} ${quote(`dist/${path}`)}`;

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT);

async function writeBatches(name, paths) {
  const batches = Array.from({ length: WORKERS }, () => []);
  paths.forEach((path, index) => batches[index % WORKERS].push(put(path)));
  await Promise.all(batches.map((lines, index) => (
    lines.length ? writeFile(`${OUTPUT}/${name}-${index + 1}.lftp`, `${lines.join("\n")}\n`) : null
  )));
}

const folders = [...new Set(changed.map(dirname))].map((dir) => `mkdir -p -f ${quote(`${REMOTE_ROOT}/${dir}`)}`);
await writeFile(`${OUTPUT}/folders.lftp`, `${folders.join("\n")}\n`);
// HTML sau cùng: file css, js mới phải có mặt trước khi trang trỏ tới chúng.
await writeBatches("assets", changed.filter((path) => !path.endsWith(".html")));
await writeBatches("html", changed.filter((path) => path.endsWith(".html")));
await writeFile(`${OUTPUT}/manifest.lftp`, `put -O ${quote(REMOTE_ROOT)} dist/deploy-manifest.json\n`);
console.error(`${changed.length} file đổi trên tổng ${Object.keys(fresh).length}, chia ${WORKERS} luồng.`);
