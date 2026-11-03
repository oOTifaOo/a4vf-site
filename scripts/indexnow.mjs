// Báo cho Bing và các công cụ dùng IndexNow biết trang nào vừa đổi. Google không dùng IndexNow.
// Chạy sau khi deploy xong: node scripts/indexnow.mjs
// So sánh dist/sitemap.xml với sitemap đang chạy trên website trước khi deploy (biến OLD_SITEMAP).
import { readFile } from "node:fs/promises";
import { SITE_URL } from "../js/config.js";

const MAX_URLS = 10_000;
const entries = (xml) => new Map([...xml.matchAll(/<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => [m[1], m[2] ?? ""]));

const key = (await readFile(new URL("../deploy/indexnow-key.txt", import.meta.url), "utf8")).trim();
const next = entries(await readFile(new URL("../dist/sitemap.xml", import.meta.url), "utf8"));
const previous = entries(process.env.OLD_SITEMAP ? await readFile(process.env.OLD_SITEMAP, "utf8").catch(() => "") : "");
const changed = [...next].filter(([url, date]) => previous.get(url) !== date).map(([url]) => url).slice(0, MAX_URLS);

if (!changed.length) {
  console.log("IndexNow: không có trang mới.");
} else {
  const host = new URL(SITE_URL).hostname;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList: changed }),
  });
  // Không làm hỏng lần deploy nếu IndexNow lỗi: trang vẫn được tìm thấy qua sitemap.
  console.log(`IndexNow: gửi ${changed.length} trang, kết quả ${res.status}.`);
}
