// Tạo data.js từ AniList + Google Sheet (data/links.csv). Cần Node 18 trở lên.
// Chạy thử: SHEET_CSV_URL="https://..." node scripts/update.mjs
import { readFile, writeFile } from "node:fs/promises";

const WEEK = 7 * 864e5;
const SEASON_ORDER = { winter: 0, spring: 1, summer: 2, fall: 3 };
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

async function loadSheet() {
  const url = process.env.SHEET_CSV_URL;
  const text = url
    ? await (await fetch(url)).text()
    : await readFile(new URL("../data/links.csv", import.meta.url), "utf8");
  const byId = new Map();
  for (const r of parseCSV(text)) {
    const id = Number(r.anilist_id);
    if (!Number.isInteger(id) || id <= 0 || r.an) continue; // bỏ dòng mẫu và dòng bị ẩn
    if (!byId.has(id)) byId.set(id, r); // hiện tại mỗi phim dùng dòng đầu tiên
  }
  return byId;
}

const QUERY = `query($ids:[Int],$page:Int){Page(page:$page,perPage:50){media(id_in:$ids,type:ANIME){
  id idMal title{romaji english} format season seasonYear episodes genres popularity isAdult
  coverImage{large} startDate{year month day}
  nextAiringEpisode{episode airingAt}
  airingSchedule(perPage:1){nodes{episode airingAt}}
}}}`;

async function anilist(ids) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { ids, page: 1 } }),
  });
  if (!res.ok) throw new Error("AniList lỗi " + res.status);
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data.Page.media;
}

const seasonOf = (ms) => {
  const d = new Date(ms);
  return ["winter", "spring", "summer", "fall"][Math.floor(d.getUTCMonth() / 3)] + "-" + d.getUTCFullYear();
};

function firstAirMs(m) {
  const n = m.nextAiringEpisode || m.airingSchedule?.nodes?.[0];
  if (n) return n.airingAt * 1000 - (n.episode - 1) * WEEK;
  const s = m.startDate;
  return s?.year ? Date.UTC(s.year, (s.month || 1) - 1, s.day || 1, 12) : null;
}

async function main() {
  const sheet = await loadSheet();
  if (!sheet.size) throw new Error("Sheet không có dòng hợp lệ, giữ nguyên data.js cũ.");
  const ids = [...sheet.keys()], media = [];
  for (let i = 0; i < ids.length; i += 50) {
    media.push(...(await anilist(ids.slice(i, i + 50))));
    await new Promise((r) => setTimeout(r, 800));
  }
  const shows = [];
  for (const m of media) {
    const r = sheet.get(m.id);
    let first = firstAirMs(m);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(r.gio_tap1_vn)) {
      first = Date.parse(r.gio_tap1_vn.replace(" ", "T") + ":00+07:00"); // giờ Việt Nam ghi đè giờ AniList
    }
    if (!first) { console.warn("Bỏ qua (thiếu ngày chiếu):", m.id); continue; }
    shows.push({
      id: m.id,
      s: m.season && m.seasonYear ? `${m.season.toLowerCase()}-${m.seasonYear}` : seasonOf(first),
      t: r.ten_viet || m.title.english || m.title.romaji,
      alt: m.title.romaji,
      first: new Date(first).toISOString().replace(".000Z", "Z"),
      eps: m.episodes || 12,
      v: m.popularity || 0,
      g: m.genres || [],
      p: { n: r.nen_tang || "Chưa rõ", u: r.link_xem || "#" },
      lang: r.ngon_ngu || "Vietsub",
      f: FORMAT[m.format] || m.format || "TV Series",
      ...(m.isAdult ? { nsfw: true } : {}),
      ...(m.coverImage?.large ? { img: m.coverImage.large } : {}),
      ...(m.idMal ? { mal: `https://myanimelist.net/anime/${m.idMal}` } : {}),
    });
  }
  if (!shows.length) throw new Error("Không dựng được phim nào, giữ nguyên data.js cũ.");
  const keys = [...new Set(shows.map((s) => s.s))].sort((a, b) => {
    const [sa, ya] = a.split("-"), [sb, yb] = b.split("-");
    return ya - yb || SEASON_ORDER[sa] - SEASON_ORDER[sb];
  });
  const seasons = keys.map((k) => {
    const [s, y] = k.split("-");
    return { k, n: `${s[0].toUpperCase() + s.slice(1)} ${y} Anime`, r: `${SEASON_RANGE[s]} ${y}` };
  });
  shows.sort((a, b) => a.id - b.id);
  const out = "/* Tạo tự động bởi scripts/update.mjs. Không sửa tay. */\n" +
    "const SEASONS=" + JSON.stringify(seasons) + ";\n" +
    "const SHOWS=[\n" + shows.map((s) => JSON.stringify(s)).join(",\n") + "\n];\n";
  await writeFile(new URL("../data.js", import.meta.url), out);
  console.log(`Đã ghi ${shows.length} phim, ${seasons.length} mùa.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
