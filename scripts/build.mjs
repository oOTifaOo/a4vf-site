// Dựng bản tĩnh của website vào thư mục dist: mỗi trang là một file HTML có sẵn nội dung,
// nên công cụ tìm kiếm không chạy JavaScript vẫn đọc được. Nội dung chụp từ chính ứng dụng,
// vì vậy người xem và công cụ tìm kiếm luôn thấy cùng một thứ.
// Cần: npm i --no-save playwright && npx playwright install chromium
// Chạy: node scripts/build.mjs
import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { PLATFORM_PAGES, SITE_URL } from "../js/config.js";
import { normalizeCatalog } from "../js/domain/catalog.js";
import { airingOf } from "../js/domain/shows.js";
import { hasVietnameseRelease, PATHS, platformPath, seasonPath, showPath } from "../js/lib/paths.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const PORT = Number(process.env.BUILD_PORT) || 8199;
const ORIGIN = `http://localhost:${PORT}`;
const STATIC_FILES = ["robots.txt", "favicon.ico", "og-image.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "data.js"];
const now = Date.now();
const today = new Date(now).toISOString().slice(0, 10);

const escapeXml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const escapeAttr = (text) => String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function loadCatalog() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${await readFile(join(root, "data.js"), "utf8")};this.seasons=SEASONS;this.shows=SHOWS;`, context);
  return normalizeCatalog(context.seasons, context.shows);
}

const isIndexable = (show) => hasVietnameseRelease(show.filterLanguages, show.nsfw);

/** Ngày gần nhất nội dung trang phim đổi thật sự: tập mới nhất đã chiếu. */
function lastChange(show) {
  const airing = airingOf(show, now);
  const time = airing.aired ? airing.timeOf(airing.aired) : Date.parse(show.firstAiredAt);
  return new Date(Math.min(time, now)).toISOString().slice(0, 10);
}

function sitemap({ seasons, shows }) {
  const listed = shows.filter(isIndexable);
  const keys = new Set(listed.map((show) => show.season));
  const entries = [
    [PATHS.home, today], [PATHS.search, today], [PATHS.about, ""],
    ...PLATFORM_PAGES.map((platform) => [platformPath(platform.slug), today]),
    ...seasons.filter((season) => keys.has(season.key)).map((season) => [seasonPath(season.key), today]),
    ...listed.map((show) => [showPath(show.id, show.title), lastChange(show)]),
  ];
  const urls = entries.map(([path, date]) =>
    `  <url><loc>${escapeXml(SITE_URL + path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

function setHead(template, seo) {
  const metaName = (html, name, value) => html.replace(new RegExp(`<meta name="${name}"[^>]*>`), `<meta name="${name}" content="${escapeAttr(value)}">`);
  const metaProp = (html, name, value) => html.replace(new RegExp(`<meta property="og:${name}"[^>]*>`), `<meta property="og:${name}" content="${escapeAttr(value)}">`);
  let html = template.replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(seo.title)}</title>`);
  html = metaName(html, "description", seo.description);
  html = metaName(html, "robots", seo.robots);
  for (const name of ["title", "description", "url", "image", "type"]) html = metaProp(html, name, seo[`og_${name}`]);
  html = html.replace(/<link rel="canonical"[^>]*>/, seo.canonical ? `<link rel="canonical" href="${escapeAttr(seo.canonical)}">` : "");
  if (seo.jsonLd) html = html.replace("</head>", `  <script type="application/ld+json" id="page-jsonld">${seo.jsonLd.replace(/</g, "\\u003c")}</script>\n</head>`);
  return html;
}

const setMain = (template, content) => template.replace(/(<main[^>]*>)[\s\S]*?(<\/main>)/, (_, open, close) => `${open}${content}${close}`);

function outputFile(path) {
  if (path === "/") return "index.html";
  return `${path.slice(1)}.html`;
}

/** Ứng dụng chạy thật trong Chromium, mỗi đường dẫn được đọc lại từ DOM. */
async function capture(paths) {
  const server = spawn("node", ["scripts/serve.mjs", String(PORT)], { cwd: root, env: { ...process.env, NO_OPEN: "1" }, stdio: "ignore" });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
  const page = await context.newPage();
  // Chỉ cần nội dung: không tải ảnh, font, Bootstrap. Tooltip không ảnh hưởng nội dung nên dùng bản giả.
  await page.addInitScript(() => {
    class Stub { static getInstance() { return null; } static getOrCreateInstance() { return new Stub(); } show() {} hide() {} dispose() {} }
    window.bootstrap = new Proxy({}, { get: () => Stub });
  });
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  page.on("pageerror", (error) => { throw error; });
  await page.goto(`${ORIGIN}/`);
  await page.waitForSelector("#main h1", { state: "attached" });
  const pages = [];
  for (const path of paths) {
    const seo = await page.evaluate(async (target) => {
      history.pushState(null, "", target);
      dispatchEvent(new PopStateEvent("popstate"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const meta = (selector) => document.head.querySelector(selector)?.getAttribute("content") ?? "";
      // Đồng hồ đếm ngược chỉ có nghĩa khi đang chạy, không đưa con số đứng yên vào HTML tĩnh.
      const main = document.querySelector("#main").cloneNode(true);
      main.querySelectorAll("#countdown").forEach((box) => box.replaceChildren());
      return {
        title: document.title,
        description: meta('meta[name="description"]'),
        robots: meta('meta[name="robots"]'),
        canonical: document.head.querySelector('link[rel="canonical"]')?.href ?? "",
        og_title: meta('meta[property="og:title"]'), og_description: meta('meta[property="og:description"]'),
        og_url: meta('meta[property="og:url"]'), og_image: meta('meta[property="og:image"]'), og_type: meta('meta[property="og:type"]'),
        jsonLd: document.head.querySelector("#page-jsonld")?.textContent ?? "",
        main: main.innerHTML,
      };
    }, path);
    pages.push({ path, seo });
  }
  await browser.close();
  server.kill();
  return pages;
}

async function main() {
  const catalog = await loadCatalog();
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  const version = (process.env.GITHUB_SHA || String(now)).slice(0, 8);
  const template = (await readFile(join(root, "index.html"), "utf8")).replace(/\?v=[^"]+/g, `?v=${version}`);

  await Promise.all(["css", "js", "logos", "images"].map((dir) => cp(join(root, dir), join(dist, dir), { recursive: true })));
  await Promise.all(STATIC_FILES.map((file) => cp(join(root, file), join(dist, file))));
  // Khi đã dựng bản tĩnh, data.js nằm ngay trên website nên không cần đọc từ GitHub Pages nữa.
  const config = await readFile(join(dist, "js/config.js"), "utf8");
  await writeFile(join(dist, "js/config.js"), config.replace(/REMOTE_DATA_URL = '[^']*'/, "REMOTE_DATA_URL = ''"));
  const key = (await readFile(join(root, "deploy/indexnow-key.txt"), "utf8")).trim();
  await writeFile(join(dist, `${key}.txt`), key);
  await writeFile(join(dist, ".nojekyll"), "");
  await writeFile(join(dist, "CNAME"), `${new URL(SITE_URL).hostname}\n`);
  await writeFile(join(dist, "sitemap.xml"), sitemap(catalog));

  const paths = [
    PATHS.home, PATHS.seasons, PATHS.search, PATHS.about,
    ...PLATFORM_PAGES.map((platform) => platformPath(platform.slug)),
    ...catalog.seasons.map((season) => seasonPath(season.key)),
    ...catalog.shows.map((show) => showPath(show.id, show.title)),
    PATHS.mine, // để cuối vì trang này bật bộ lọc "Phim của tôi"
    "/404",
  ];
  const pages = await capture(paths);
  for (const { path, seo } of pages) {
    const notFound = path === "/404";
    const file = join(dist, notFound ? "404.html" : outputFile(path));
    const head = setHead(template, notFound ? { ...seo, canonical: "" } : seo);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, setMain(head, seo.main));
  }
  console.log(`Đã dựng ${pages.length} trang, trong đó ${catalog.shows.filter(isIndexable).length} trang phim đưa vào sitemap.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
