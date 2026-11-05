// Kiểm tra link xem phim trong data.js rồi ghi báo cáo vào data/bao-cao-link.md.
// Chỉ đọc và báo cáo, không tự sửa Datasheet. Lỗi mạng không bao giờ bị tính là link hỏng.
// Chạy: node scripts/check-links.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { normalizeCatalog } from "../js/domain/catalog.js";
import { episodeFromTitle } from "../js/domain/latest-episodes.js";
import { airingOf, languageKind } from "../js/domain/shows.js";
import { normalizeText } from "../js/lib/text.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = join(root, "data", "bao-cao-link.md");
const SUMMARY = join(root, "data", ".tom-tat-link.txt");
const DAY_MS = 864e5;
const TIMEOUT_MS = 15000;
const WORKERS = 4;
const PAUSE_MS = 150;
/** Tập chiếu quá 2 ngày mà chưa có link mới đáng báo, quá 14 ngày thì không còn là tập mới. */
const MISSING_AFTER_MS = 2 * DAY_MS;
const MISSING_WITHIN_MS = 14 * DAY_MS;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "vi,en;q=0.8",
  Cookie: "SOCS=CAI",
};
/** Link chắc chắn không tồn tại, dùng để biết nền tảng có báo lỗi khi link chết hay không. */
const DEAD_LINKS = {
  "FPT Play": "https://fptplay.vn/xem-video/a4vf-kiem-tra-khong-ton-tai-000000000000000000000000",
  "Bilibili TV": "https://www.bilibili.tv/vi/play/9999999999",
};
const COMMON_WORDS = new Set(["anime", "season", "part", "the", "and", "vietsub", "long", "tieng", "tap", "mua", "phan",
  "cua", "cho", "mot", "nhung", "muse", "viet", "nam", "ani", "one", "pops", "kids", "movie", "full", "ban", "episode"]);
const NOT_AN_EPISODE = /trailer|teaser|preview|\bpv\b|tổng hợp|siêu clip|superclip/i;
const PLAYLIST_ERROR = /(?:playlist does not exist|playlist is private|playlist type is unviewable|danh sách phát (?:này )?không tồn tại|danh sách phát (?:này )?ở chế độ riêng tư)/i;

export const playlistId = (url) => /[?&]list=([\w-]+)/.exec(url)?.[1] ?? /\/show\/VL([\w-]+)/.exec(url)?.[1] ?? null;

const decodeXml = (text) => text
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, "&");

function videosFromFeed(xml) {
  return [...xml.matchAll(/<entry>[\s\S]*?<yt:videoId>([\w-]{11})<\/yt:videoId>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
    .map(([, id, title]) => ({ id, title: decodeXml(title) }));
}

function videosFromPage(page) {
  const patterns = [
    /"playlistVideoRenderer":\{"videoId":"([\w-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g,
    /"contentId":"([\w-]{11})"[\s\S]{0,4000}?"title":\{"content":"((?:[^"\\]|\\.)*)"/g,
  ];
  for (const pattern of patterns) {
    const videos = [...page.matchAll(pattern)].map(([, id, title]) => {
      try { return { id, title: JSON.parse(`"${title}"`) }; } catch { return { id, title }; }
    });
    if (videos.length) return videos;
  }
  return [];
}

async function download(url, fetcher, redirect = "follow") {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetcher(url, { headers: HEADERS, redirect, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return { status: response.status, body: await response.text() };
    } catch (error) {
      if (attempt) return { status: 0, body: "", error: error.message };
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

/** ok: đọc được video. broken: YouTube nói rõ playlist không còn. unknown: chưa kết luận được. */
export async function checkPlaylist(id, fetcher = fetch) {
  const feed = await download(`https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`, fetcher);
  const fromFeed = feed.status === 200 ? videosFromFeed(feed.body) : [];
  if (fromFeed.length) return { state: "ok", videos: fromFeed };

  const page = await download(`https://www.youtube.com/playlist?hl=vi&list=${id}`, fetcher);
  const fromPage = page.status === 200 ? videosFromPage(page.body) : [];
  if (fromPage.length) return { state: "ok", videos: fromPage };
  if (page.status === 404 || (page.status === 200 && PLAYLIST_ERROR.test(page.body))) return { state: "broken", videos: [] };
  return { state: "unknown", videos: [], reason: page.error ?? `feed ${feed.status}, trang ${page.status}` };
}

export async function checkPage(url, fetcher = fetch) {
  const { status, error } = await download(url, fetcher);
  if (status === 404 || status === 410) return { state: "broken", reason: `HTTP ${status}` };
  if (status >= 200 && status < 400) return { state: "ok" };
  return { state: "unknown", reason: error ?? `HTTP ${status}` };
}

const wordsOf = (text) => normalizeText(text ?? "").split(/[^a-z0-9]+/)
  .filter((word) => word.length >= 3 && !COMMON_WORDS.has(word) && !/^\d+$/.test(word));

/** Không video nào có chung từ với tên phim: có thể gắn nhầm playlist. Chỉ là gợi ý để xem lại. */
export function looksMismatched(show, videos) {
  if (!videos.length) return false;
  const names = new Set([show.title, show.altTitle, show.englishTitle, ...show.series.map(({ title }) => title)].flatMap(wordsOf));
  if (!names.size) return false;
  return !videos.some(({ title }) => wordsOf(title).some((word) => names.has(word)));
}

export function missingEpisodes(show, platform, now) {
  if (!Object.keys(platform.milestones ?? {}).length && !(platform.firstAiredAt || show.firstAiredAt)) return [];
  const airing = airingOf(show, now, platform);
  const missing = [];
  for (let episode = airing.aired; episode >= 1; episode -= 1) {
    const age = now - airing.timeOf(episode);
    if (age > MISSING_WITHIN_MS) break;
    if (age >= MISSING_AFTER_MS && !platform.episodeLinks[episode]) missing.push(episode);
  }
  return missing.reverse();
}

async function eachLimited(items, work) {
  let next = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  }));
}

/** Gom link cần kiểm tra: chỉ bản Vietsub và lồng tiếng của phim còn bản quyền. */
export function collectLinks(shows) {
  const playlists = new Map();
  const pages = new Map();
  const empty = [];
  for (const show of shows) {
    if (show.unavailable) continue;
    for (const platform of [...show.platforms, ...show.otherPlatforms]) {
      if (languageKind(platform.language) === "en") continue;
      if (!platform.url) {
        empty.push({ show, platform });
        continue;
      }
      const id = /youtube\.com/.test(platform.url) ? playlistId(platform.url) : null;
      if (id) {
        if (!playlists.has(id)) playlists.set(id, []);
        playlists.get(id).push({ show, platform });
      } else if (DEAD_LINKS[platform.name]) {
        if (!pages.has(platform.url)) pages.set(platform.url, []);
        pages.get(platform.url).push({ show, platform });
      }
    }
  }
  return { playlists, pages, empty };
}

export async function runChecks(shows, now = Date.now(), fetcher = fetch) {
  const { playlists, pages, empty } = collectLinks(shows);
  const found = { broken: [], mismatch: [], missing: [], shared: [], unknown: [] };

  await eachLimited([...playlists], async ([id, uses]) => {
    const result = await checkPlaylist(id, fetcher);
    const url = `https://www.youtube.com/playlist?list=${id}`;
    if (result.state === "broken") found.broken.push({ uses, url, reason: "YouTube báo playlist không còn hoặc đã riêng tư" });
    if (result.state === "unknown") found.unknown.push({ uses, url, reason: result.reason });
    if (result.state !== "ok") return;

    for (const use of uses) {
      if (looksMismatched(use.show, result.videos)) {
        found.mismatch.push({ ...use, url, sample: result.videos[0].title });
      }
      const episodes = missingEpisodes(use.show, use.platform, now);
      if (episodes.length) {
        const listed = new Set(result.videos.filter(({ title }) => !NOT_AN_EPISODE.test(title))
          .map(({ title }) => episodeFromTitle(title) - use.platform.episodeOffset));
        found.missing.push({ ...use, url, episodes, uploaded: episodes.filter((episode) => listed.has(episode)) });
      }
    }
  });

  await eachLimited([...pages], async ([url, uses]) => {
    const result = await checkPage(url, fetcher);
    if (result.state === "broken") found.broken.push({ uses, url, reason: result.reason });
    if (result.state === "unknown") found.unknown.push({ uses, url, reason: result.reason });
  });

  for (const [id, uses] of playlists) {
    const titles = [...new Set(uses.map(({ show }) => show.title))];
    if (titles.length > 1) found.shared.push({ url: `https://www.youtube.com/playlist?list=${id}`, titles });
  }

  // Thử một link giả để biết nền tảng có trả lỗi khi link chết không.
  const detection = {};
  for (const [name, url] of Object.entries(DEAD_LINKS)) detection[name] = (await checkPage(url, fetcher)).state;

  return { ...found, empty, detection, counts: { playlists: playlists.size, pages: pages.size } };
}

const useLine = ({ show, platform }) => `${show.title} (${platform.name}, id ${show.id})`;
const uniqueTitles = (uses) => [...new Set(uses.map(useLine))].join("; ");

const DETECTION_TEXT = {
  broken: "có báo lỗi 404 khi link chết, nên kết quả tin được",
  ok: "vẫn trả trang bình thường cho link không tồn tại, nên chưa phát hiện được link chết của nền tảng này",
  unknown: "không trả lời máy kiểm tra, nên chưa kết luận được",
};

export function buildReport(result, now = Date.now()) {
  const date = new Date(now + 7 * 36e5).toISOString().slice(0, 16).replace("T", " ");
  const { broken, mismatch, missing, shared, unknown, empty, detection, counts } = result;
  const lines = [
    "# Báo cáo kiểm tra link", "",
    `Chạy lúc ${date} giờ Việt Nam. Đã kiểm tra ${counts.playlists} playlist YouTube và ${counts.pages} trang FPT Play, Bilibili TV.`, "",
    `- Link hỏng: ${broken.length}`,
    `- Thiếu link tập mới: ${missing.length}`,
    `- Có thể gắn nhầm phim: ${mismatch.length}`,
    `- Một playlist gắn nhiều phim: ${shared.length}`,
    `- Chưa có link: ${empty.length}`,
    `- Không kiểm tra được: ${unknown.length}`, "",
  ];
  const section = (title, note, rows) => {
    if (!rows.length) return;
    lines.push(`## ${title}`, "", ...(note ? [note, ""] : []), ...rows.map((row) => `- ${row}`), "");
  };
  section("Link hỏng", "Sửa cột link_xem hoặc đánh dấu het_ban_quyen trong Datasheet.",
    broken.map(({ uses, url, reason }) => `${uniqueTitles(uses)}: ${reason}. ${url}`));
  section("Thiếu link tập mới", "Tập đã chiếu hơn 2 ngày mà chưa có link riêng. Người xem vẫn được mở playlist.",
    missing.map(({ url, episodes, uploaded, ...use }) => {
      const state = uploaded.length ? `playlist đã có tập ${uploaded.join(", ")}` : "chưa thấy trong playlist, có thể kênh đăng trễ hoặc lịch sai";
      return `${useLine(use)}: tập ${episodes.join(", ")}, ${state}. ${url}`;
    }));
  section("Có thể gắn nhầm phim", "Không video nào trong playlist có chung từ với tên phim. Chỉ là nghi ngờ, cần mở ra xem.",
    mismatch.map(({ url, sample, ...use }) => `${useLine(use)}: video mới nhất là "${sample}". ${url}`));
  section("Một playlist gắn nhiều phim", "Có thể đúng nếu kênh gộp nhiều mùa, nhưng nên xem lại.",
    shared.map(({ url, titles }) => `${titles.join("; ")}. ${url}`));
  section("Chưa có link", "", empty.map(useLine));
  section("Không kiểm tra được", "Không tính là hỏng. Thường do mạng hoặc nền tảng chặn máy kiểm tra.",
    unknown.slice(0, 40).map(({ uses, url, reason }) => `${uniqueTitles(uses)}: ${reason}. ${url}`));
  if (unknown.length > 40) lines.push(`Còn ${unknown.length - 40} link khác không kiểm tra được.`, "");
  section("Độ tin cậy theo nền tảng", "", Object.entries(detection).map(([name, state]) => `${name}: ${DETECTION_TEXT[state]}`));
  return `${lines.join("\n").trimEnd()}\n`;
}

async function loadShows() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${await readFile(join(root, "data.js"), "utf8")};this.seasons=SEASONS;this.shows=SHOWS;`, context);
  return normalizeCatalog(context.seasons, context.shows).shows;
}

async function main() {
  const result = await runChecks(await loadShows());
  await mkdir(dirname(REPORT), { recursive: true });
  await writeFile(REPORT, buildReport(result));
  const problems = result.broken.length + result.missing.length + result.mismatch.length;
  await writeFile(SUMMARY, problems ? `${result.broken.length} link hỏng, ${result.missing.length} phim thiếu link tập, ${result.mismatch.length} nghi gắn nhầm` : "");
  console.log(`Hỏng ${result.broken.length}, thiếu tập ${result.missing.length}, nghi nhầm ${result.mismatch.length}, không kiểm tra được ${result.unknown.length}`);
  console.log(JSON.stringify(result.detection));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
