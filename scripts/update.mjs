// Tạo data.js từ AniList + Google Sheet (data/links.csv). Cần Node 18 trở lên.
// Chạy thử: SHEET_CSV_URL="https://..." node scripts/update.mjs
import { readFile, writeFile } from "node:fs/promises";

const WEEK = 7 * 864e5;
const SEASON_ORDER = { winter: 0, spring: 1, summer: 2, fall: 3 };
const SEASON_VI = { winter: "Đông", spring: "Xuân", summer: "Hạ", fall: "Thu" };
const SEASON_RANGE = {
  winter: "Tháng một - Tháng ba", spring: "Tháng tư - Tháng sáu",
  summer: "Tháng bảy - Tháng chín", fall: "Tháng mười - Tháng mười hai",
};
const FORMAT = { TV: "TV Series", TV_SHORT: "TV Short", ONA: "ONA", OVA: "OVA", MOVIE: "Movie", SPECIAL: "Special" };

function parseCSV(t) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); cur = ""; rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const [h, ...r] = rows.filter((x) => x.some((v) => v.trim()));
  const keys = h.map((s) => s.trim().toLowerCase());
  return r.map((x) => Object.fromEntries(keys.map((k, i) => [k, (x[i] || "").trim()])));
}

const hidden = new Set();
async function loadSheet() {
  const url = process.env.SHEET_CSV_URL;
  const text = url
    ? await (await fetch(url)).text()
    : await readFile(new URL("../data/links.csv", import.meta.url), "utf8");
  const byId = new Map();
  for (const r of parseCSV(text)) {
    const id = Number(r.anilist_id);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (r.an) { hidden.add(id); continue; } // dòng bị ẩn: cũng không tự động thêm lại
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(r); // mỗi dòng = một nền tảng; dòng đầu tiên là nền tảng chính
  }
  return byId;
}

function cleanUrl(v) {
  let s = String(v || "").trim();
  if (!s) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s; // thiếu http(s) thì tự thêm
  return /^https?:\/\//i.test(s) ? s : ""; // chặn javascript:, data: ...
}
// Cột link_cac_tap: mỗi dòng "số tập|link" (do Apps Script tự điền, bạn cũng sửa tay được)
function parseEps(text) {
  const e = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = /^\s*(\d{1,3})\s*[|=]\s*(\S+)\s*$/.exec(line);
    const url = m && cleanUrl(m[2]);
    if (url) e[Number(m[1])] = url;
  }
  return e;
}

// FPT Play: link từng tập = link phim + /tap-<số tập>
function fptEpisodes(url, episodes) {
  const base = /^https?:\/\/(?:www\.)?fptplay\.vn\/xem-video\/[^/?#]+/i.exec(url)?.[0];
  if (!base) return {};
  return Object.fromEntries(Array.from({ length: episodes }, (_, i) => [i + 1, `${base}/tap-${i + 1}`]));
}

const YES = /^(x|1|y|yes|true|co|có|v|✓|✔)$/i; // cột long_tieng: đánh dấu nền tảng này có bản lồng tiếng
// Giờ Việt Nam. Nhận: 2026-10-04 21:30 | 2026-10-04 9:30 | 04/10/2026 21:30 (ngày/tháng/năm), có thể kèm giây
function vnMs(v) {
  const s = String(v || "").trim();
  let y, mo, d, h, mi, m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s))) [, y, mo, d, h, mi] = m;
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s))) [, d, mo, y, h, mi] = m;
  else return null;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +h > 23 || +mi > 59) return null;
  const q = (n) => String(n).padStart(2, "0");
  return Date.parse(`${y}-${q(mo)}-${q(d)}T${q(h)}:${mi}:00+07:00`);
}
const isoZ = (ms) => new Date(ms).toISOString().replace(".000Z", "Z");
// Cột gio_cac_tap: "số tập|yyyy-MM-dd HH:mm" = mốc giờ mới từ tập đó (tập sau đó tính tiếp theo tuần)
function parseMilestones(text) {
  const m = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const x = /^\s*(\d{1,3})\s*[|=]\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s*$/.exec(line);
    const ms = x && vnMs(x[2]);
    if (ms) m[Number(x[1])] = isoZ(ms);
  }
  return m;
}

const FIELDS = `id idMal title{romaji english} format season seasonYear episodes genres popularity isAdult
  description(asHtml:false) trailer{id site} coverImage{large} startDate{year month day}
  nextAiringEpisode{episode airingAt}
  airingSchedule(perPage:1){nodes{episode airingAt}}
  externalLinks{site url type language isDisabled}`;
const QUERY = `query($ids:[Int],$page:Int){Page(page:$page,perPage:50){media(id_in:$ids,type:ANIME){${FIELDS}}}}`;
const QUERY_SEASON = `query($season:MediaSeason,$year:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage}
  media(season:$season,seasonYear:$year,type:ANIME,format_in:[TV,TV_SHORT,ONA],isAdult:false,sort:POPULARITY_DESC){${FIELDS}}}}`;

async function gql(query, variables) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error("AniList lỗi " + res.status);
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data.Page;
}
// Các mùa tự động lấy: mặc định mùa trước, mùa hiện tại, mùa sau. Đổi bằng biến SEASONS="fall-2026,winter-2027"
function autoSeasons() {
  if (process.env.SEASONS === "off") return [];
  if (process.env.SEASONS) return process.env.SEASONS.split(",").map((x) => x.trim().toLowerCase()).filter((x) => /^(winter|spring|summer|fall)-\d{4}$/.test(x));
  const d = new Date(), q = Math.floor(d.getUTCMonth() / 3), y = d.getUTCFullYear(), N = ["winter", "spring", "summer", "fall"];
  return [-1, 0, 1].map((o) => { const k = q + o; return `${N[(k + 4) % 4]}-${y + Math.floor(k / 4)}`; });
}
async function anilistSeason(key) {
  const [season, year] = key.split("-"), out = [];
  for (let page = 1; page <= 8; page++) {
    const r = await gql(QUERY_SEASON, { season: season.toUpperCase(), year: +year, page });
    out.push(...r.media);
    if (!r.pageInfo.hasNextPage) break;
    await new Promise((r) => setTimeout(r, 800));
  }
  return out;
}
const seasonOf = (ms) => {
  const d = new Date(ms);
  return ["winter", "spring", "summer", "fall"][Math.floor(d.getUTCMonth() / 3)] + "-" + d.getUTCFullYear();
};

// Trailer từ AniList: chỉ nhận YouTube/Dailymotion với id hợp lệ
function trailerOf(m) {
  const t = m.trailer, site = String(t?.site || "").toLowerCase();
  return t?.id && /^[\w-]{3,40}$/.test(t.id) && (site === "youtube" || site === "dailymotion") ? { s: site, id: t.id } : null;
}

// Link trang chủ và X từ AniList. Có nhiều trang chủ thì ưu tiên bản tiếng Anh.
function officialLinks(m) {
  const links = (m.externalLinks || []).filter((l) => cleanUrl(l.url));
  const sites = links.filter((l) => /^official site$/i.test(l.site));
  const site = sites.find((l) => l.language === "English") || sites[0];
  const x = links.find((l) => /^(twitter|x)$/i.test(l.site));
  return { ...(site ? { web: cleanUrl(site.url) } : {}), ...(x ? { x: cleanUrl(x.url) } : {}) };
}

// Mô tả dự phòng từ AniList (tiếng Anh), bỏ thẻ HTML, cắt ngắn
function synopsis(m) {
  const t = String(m.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 600 ? t.slice(0, 597).replace(/\s+\S*$/, "") + "…" : t;
}

// Phim không có trong Sheet: nền tảng lấy từ link streaming của AniList (nếu có), phụ đề mặc định Engsub
function autoRow(m) {
  const st = (m.externalLinks || []).find((l) => l.type === "STREAMING" && cleanUrl(l.url));
  return {
    nen_tang: st ? st.site : "AniList",
    link_xem: st ? st.url : `https://anilist.co/anime/${m.id}`,
    ngon_ngu: "Engsub",
  };
}

// Các nền tảng Engsub từ AniList, thêm vào tab Engsub của phim đã có trong Sheet.
// Bỏ link đã tắt, link trùng dòng Sheet, và link AniList ghi rõ ngôn ngữ khác tiếng Anh.
function engsubRows(m, sheetRows) {
  const used = new Set(sheetRows.map((row) => cleanUrl(row.link_xem)));
  const rows = [];
  for (const l of m.externalLinks || []) {
    const url = cleanUrl(l.url);
    if (l.type !== "STREAMING" || l.isDisabled || !url || used.has(url)) continue;
    if (l.language && l.language !== "English") continue;
    used.add(url);
    rows.push({ nen_tang: l.site, link_xem: url, ngon_ngu: "Engsub" });
  }
  return rows;
}

function firstAirMs(m) {
  const n = m.nextAiringEpisode || m.airingSchedule?.nodes?.[0];
  if (n) return n.airingAt * 1000 - (n.episode - 1) * WEEK;
  const s = m.startDate;
  return s?.year ? Date.UTC(s.year, (s.month || 1) - 1, s.day || 1, 12) : null;
}

async function main() {
  const sheet = await loadSheet();
  const ids = [...sheet.keys()], media = [], seen = new Set();
  for (let i = 0; i < ids.length; i += 50) {
    for (const m of (await gql(QUERY, { ids: ids.slice(i, i + 50), page: 1 })).media) { media.push(m); seen.add(m.id); }
    await new Promise((r) => setTimeout(r, 800));
  }
  // Tự động thêm toàn bộ anime của các mùa gần đây (phim chưa có trong Sheet sẽ hiển thị là Engsub)
  for (const key of autoSeasons()) {
    const list = await anilistSeason(key);
    let added = 0;
    for (const m of list) if (!seen.has(m.id) && !hidden.has(m.id)) { media.push(m); seen.add(m.id); added++; }
    console.log(`Mùa ${key}: ${list.length} phim, thêm tự động ${added}.`);
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!media.length) throw new Error("Không có phim nào (Sheet trống và không lấy được mùa), giữ nguyên data.js cũ.");
  const shows = [];
  for (const m of media) {
    const sheetRows = sheet.get(m.id);
    const rows = sheetRows ? [...sheetRows, ...engsubRows(m, sheetRows)] : [autoRow(m)];
    const r = rows[0], aniFirst = firstAirMs(m);
    const ps = rows.map((row) => {
      const gt = vnMs(row.gio_tap1_vn);
      if (row.gio_tap1_vn && gt === null) console.warn(`Phim ${m.id}: gio_tap1_vn "${row.gio_tap1_vn}" sai định dạng, dùng giờ AniList. Cần dạng 2026-10-04 21:30`);
      const first = gt ?? aniFirst; // giờ VN ghi đè giờ AniList, theo từng nền tảng
      if (!first) return null;
      // Link điền tay trong link_cac_tap được ưu tiên hơn link tự tạo
      const e = { ...fptEpisodes(cleanUrl(row.link_xem), m.episodes || 12), ...parseEps(row.link_cac_tap) };
      const ms = parseMilestones(row.gio_cac_tap);
      return {
        n: row.nen_tang || "Chưa rõ",
        u: cleanUrl(row.link_xem) || "#",
        lang: row.ngon_ngu || "Vietsub",
        ...(YES.test(String(row.long_tieng || "").trim()) ? { dub: true } : {}),
        first: isoZ(first),
        ...(Object.keys(e).length ? { e } : {}),
        ...(Object.keys(ms).length ? { m: ms } : {}),
      };
    }).filter(Boolean);
    if (!ps.length) { console.warn("Bỏ qua (thiếu ngày chiếu):", m.id); continue; }
    shows.push({
      id: m.id,
      s: m.season && m.seasonYear ? `${m.season.toLowerCase()}-${m.seasonYear}` : seasonOf(Date.parse(ps[0].first)),
      t: r.ten_viet || m.title.english || m.title.romaji,
      alt: m.title.romaji,
      ...(m.title.english ? { en: m.title.english } : {}),
      first: ps[0].first,
      eps: m.episodes || 12,
      v: m.popularity || 0,
      g: m.genres || [],
      ps,
      ...((r.mo_ta || synopsis(m)) ? { d: r.mo_ta || synopsis(m) } : {}),
      f: FORMAT[m.format] || m.format || "TV Series",
      ...(trailerOf(m) ? { tr: trailerOf(m) } : {}),
      ...(m.isAdult ? { nsfw: true } : {}),
      ...(m.coverImage?.large ? { img: m.coverImage.large } : {}),
      ...(m.idMal ? { mal: `https://myanimelist.net/anime/${m.idMal}` } : {}),
      ...officialLinks(m),
    });
  }
  if (!shows.length) throw new Error("Không dựng được phim nào, giữ nguyên data.js cũ.");
  const keys = [...new Set(shows.map((s) => s.s))].sort((a, b) => {
    const [sa, ya] = a.split("-"), [sb, yb] = b.split("-");
    return ya - yb || SEASON_ORDER[sa] - SEASON_ORDER[sb];
  });
  const seasons = keys.map((k) => {
    const [s, y] = k.split("-");
    return { k, n: `Anime Mùa ${SEASON_VI[s]} ${y}`, r: `${SEASON_RANGE[s]} ${y}` };
  });
  shows.sort((a, b) => a.id - b.id);
  const out = "/* Tạo tự động bởi scripts/update.mjs. Không sửa tay. */\n" +
    "const SEASONS=" + JSON.stringify(seasons) + ";\n" +
    "const SHOWS=[\n" + shows.map((s) => JSON.stringify(s)).join(",\n") + "\n];\n";
  await writeFile(new URL("../data.js", import.meta.url), out);
  console.log(`Đã ghi ${shows.length} phim, ${seasons.length} mùa.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
