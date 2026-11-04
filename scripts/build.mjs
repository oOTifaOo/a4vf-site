// Dựng bản tĩnh của website vào thư mục dist: mỗi trang là một file HTML có sẵn nội dung,
// nên công cụ tìm kiếm không chạy JavaScript vẫn đọc được. Nội dung chụp từ chính ứng dụng,
// vì vậy người xem và công cụ tìm kiếm luôn thấy cùng một thứ.
// Cần: npm i --no-save playwright && npx playwright install chromium
// Chạy: node scripts/build.mjs
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
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
const STATIC_FILES = ["robots.txt", "favicon.ico", "og-image.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "manifest.webmanifest", "anh.php"];
/** Số mùa gần nhất tính cả mùa hiện tại giữ trong data.js. Phim cũ hơn vào kho tra cứu. */
const RECENT_SEASONS = 4;
const now = Date.now();
const today = new Date(now).toISOString().slice(0, 10);

const escapeXml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const escapeAttr = (text) => String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function loadCatalog() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${await readFile(join(root, "data.js"), "utf8")};this.seasons=SEASONS;this.shows=SHOWS;`, context);
  return { ...normalizeCatalog(context.seasons, context.shows), rawSeasons: context.seasons, rawShows: context.shows };
}

const SEASON_FAMILIES = ["winter", "spring", "summer", "fall"];
const seasonIndex = (key) => {
  const [family, year] = key.split("-");
  return Number(year) * 4 + SEASON_FAMILIES.indexOf(family);
};

/** data.js chỉ giữ mùa gần đây và phim còn đang chiếu; phim cũ tách thành chỉ mục và từng file theo mùa. */
async function writeData({ rawSeasons, rawShows, shows }) {
  const date = new Date(now);
  const cutoff = date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3) - RECENT_SEASONS + 1;
  const isRecent = (raw, index) => seasonIndex(raw.s) >= cutoff || airingOf(shows[index], now).status !== "done";
  const recent = rawShows.filter(isRecent);
  const older = rawShows.filter((raw, index) => !isRecent(raw, index) && !raw.nsfw);

  await writeFile(join(dist, "data.js"), `/* Tạo tự động. */\nconst SEASONS=${JSON.stringify(rawSeasons)};\nconst SHOWS=${JSON.stringify(recent)};\n`);
  await writeFile(join(dist, "kho.json"), JSON.stringify(older.map((raw) => ({
    id: raw.id, s: raw.s, t: raw.t, ...(raw.en ? { en: raw.en } : {}), alt: raw.alt, ...(raw.img ? { img: raw.img } : {}), g: raw.g,
    p: [...new Set(raw.ps.filter((platform) => !/eng/i.test(platform.lang)).map((platform) => platform.n))],
    f: [...new Set(raw.ps.filter((platform) => platform.free).map((platform) => platform.n))],
  }))));
  await mkdir(join(dist, "du-lieu"), { recursive: true });
  for (const key of new Set(older.map((raw) => raw.s))) {
    await writeFile(join(dist, "du-lieu", `mua-${key}.json`), JSON.stringify(older.filter((raw) => raw.s === key)));
  }
  console.log(`data.js: ${recent.length} phim; kho tra cứu: ${older.length} phim.`);
}

const sha = (data) => createHash("sha256").update(data).digest("hex");

/** Phiên bản theo nội dung css và js, để lần dựng chỉ đổi dữ liệu không làm đổi mọi trang. */
async function codeVersion() {
  const parts = await Promise.all(["css", "js"].map(async (dir) => {
    const files = (await readdir(join(root, dir), { recursive: true })).filter((file) => /\.(css|js)$/.test(file)).sort();
    return Promise.all(files.map((file) => readFile(join(root, dir, file))));
  }));
  return sha(Buffer.concat(parts.flat())).slice(0, 8);
}

async function writeManifest() {
  const entries = await readdir(dist, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile())
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .filter((file) => ![".nojekyll", "CNAME", "deploy-manifest.json"].includes(file));
  const manifest = {};
  for (const file of files.sort()) manifest[file] = sha(await readFile(join(dist, file))).slice(0, 16);
  await writeFile(join(dist, "deploy-manifest.json"), JSON.stringify(manifest));
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
    [PATHS.home, today], [PATHS.search, today], [PATHS.tierList, ""], [PATHS.about, ""],
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
  const version = await codeVersion();
  // css và js nằm trong thư mục riêng của từng phiên bản. Khi tải lên host, file mới không đè file cũ,
  // nên trang cũ vẫn chạy trọn vẹn và mỗi trang chỉ đổi sang phiên bản mới khi HTML của nó được thay.
  const assets = `v/${version}`;
  const template = (await readFile(join(root, "index.html"), "utf8"))
    .replace(/"\/(css|js)\/(tokens\.css|app\.css|app\.js)\?v=[^"]+"/g, `"/${assets}/$1/$2"`);

  await Promise.all(["logos", "images"].map((dir) => cp(join(root, dir), join(dist, dir), { recursive: true })));
  await Promise.all(["css", "js"].map((dir) => cp(join(root, dir), join(dist, assets, dir), { recursive: true })));
  await mkdir(join(dist, "js"), { recursive: true });
  await cp(join(root, "js/theme-init.js"), join(dist, "js/theme-init.js"));
  await Promise.all(STATIC_FILES.map((file) => cp(join(root, file), join(dist, file))));
  // Khi đã dựng bản tĩnh, data.js nằm ngay trên website nên không cần đọc từ GitHub Pages nữa.
  const config = await readFile(join(dist, assets, "js/config.js"), "utf8");
  await writeFile(join(dist, assets, "js/config.js"), config.replace(/REMOTE_DATA_URL = '[^']*'/, "REMOTE_DATA_URL = ''"));
  await writeFile(join(dist, "sw.js"), (await readFile(join(root, "sw.js"), "utf8")).replace("__VERSION__", version));
  await writeData(catalog);
  const key = (await readFile(join(root, "deploy/indexnow-key.txt"), "utf8")).trim();
  await writeFile(join(dist, `${key}.txt`), key);
  await writeFile(join(dist, ".nojekyll"), "");
  await writeFile(join(dist, "CNAME"), `${new URL(SITE_URL).hostname}\n`);
  await writeFile(join(dist, "sitemap.xml"), sitemap(catalog));

  const paths = [
    PATHS.home, PATHS.seasons, PATHS.search, PATHS.tierList, PATHS.about,
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
  await writeManifest();
  console.log(`Đã dựng ${pages.length} trang, trong đó ${catalog.shows.filter(isIndexable).length} trang phim đưa vào sitemap.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
