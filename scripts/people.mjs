// Ghi công trên trang phim: dịch giả, studio và diễn viên lồng tiếng Việt (tab "Nhân sự" + cột dich_gia,
// long_tieng_boi, dien_vien_viet của Sheet1), và nhân vật + seiyuu lấy từ AniList.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const PEOPLE_FILE = new URL("../nhan-su.json", import.meta.url);
const CAST_FILE = new URL("../data/nhan-vat.json", import.meta.url);
const ID = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const ROLES = new Set(["dich-gia", "studio", "dien-vien"]);
const YES = /^(x|1|y|yes|true|co|có|v|✓|✔)$/i;
const DUB = /lồng|long tieng|thuyết minh|dub/i;
const DAY = 864e5;

/** Link CSV của tab "Nhân sự": PEOPLE_CSV_URL, hoặc link Sheet1 đổi sang gid của tab (PEOPLE_GID). */
function peopleUrl() {
  if (process.env.PEOPLE_CSV_URL) return process.env.PEOPLE_CSV_URL;
  if (!process.env.SHEET_CSV_URL) return null;
  const url = new URL(process.env.SHEET_CSV_URL);
  url.searchParams.set("gid", process.env.PEOPLE_GID || "1028728293");
  return url.href;
}

/** Chỉ giữ người đã đồng ý hiện tên (cột cho_phep_hien). Không đọc được tab thì dùng lại nhan-su.json cũ. */
export async function loadPeople(parseCSV, cleanUrl) {
  const url = peopleUrl();
  if (url) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.ok && /^\uFEFF?\s*"?id"?\s*,/i.test(text)) {
        const people = [];
        for (const row of parseCSV(text)) {
          const id = row.id.toLowerCase();
          if (!id) continue;
          if (!ID.test(id)) { console.warn(`Nhân sự: id "${row.id}" chỉ được dùng chữ thường không dấu, số và dấu gạch ngang.`); continue; }
          if (!ROLES.has(row.vai_tro)) { console.warn(`Nhân sự ${id}: vai_tro phải là dich-gia, studio hoặc dien-vien.`); continue; }
          if (!YES.test(row.cho_phep_hien || "")) continue;
          people.push({
            id,
            name: row.ten_hien_thi || id,
            role: row.vai_tro,
            ...(row.nhom ? { group: row.nhom } : {}),
            ...(row.gioi_thieu ? { bio: row.gioi_thieu.slice(0, 600) } : {}),
            ...(cleanUrl(row.anh) ? { image: cleanUrl(row.anh) } : {}),
            ...(cleanUrl(row.link) ? { link: cleanUrl(row.link) } : {}),
            shown: true,
          });
        }
        return people;
      }
      console.warn(`Không đọc được tab "Nhân sự" (HTTP ${res.status}). Tab cần được xuất bản lên web. Dùng lại nhan-su.json cũ.`);
    } catch (error) {
      console.warn(`Không tải được tab "Nhân sự": ${error.message}. Dùng lại nhan-su.json cũ.`);
    }
  }
  try {
    return JSON.parse(await readFile(PEOPLE_FILE, "utf8")).map(({ w, ...person }) => person);
  } catch {
    return [];
  }
}

/** Ghi công của một dòng Sheet. Id không có trong tab Nhân sự (hoặc chưa đồng ý hiện) bị bỏ qua. */
export function creditsOf(row, known) {
  const ids = (value) => [...new Set(String(value || "").split(/[\s,;]+/).map((id) => id.trim().toLowerCase()).filter((id) => known.has(id)))];
  const dubbed = DUB.test(row.ngon_ngu || "") || YES.test(String(row.long_tieng || "").trim());
  // Dịch giả chỉ tính bản phụ đề, mỗi dòng một người.
  const dg = dubbed ? [] : ids(row.dich_gia).slice(0, 1);
  const lt = ids(row.long_tieng_boi);
  const vo = [];
  for (const line of String(row.dien_vien_viet || "").split(/\r?\n/)) {
    const m = /^\s*(\d{1,9})\s*[|=]\s*([a-z0-9-]+)\s*$/i.exec(line);
    if (m && known.has(m[2].toLowerCase())) vo.push([Number(m[1]), m[2].toLowerCase()]);
  }
  if (!dg.length && !lt.length && !vo.length) return null;
  return { ...(dg.length ? { dg } : {}), ...(lt.length ? { lt } : {}), ...(vo.length ? { vo } : {}) };
}

/** nhan-su.json: người được hiện kèm danh sách id phim họ tham gia, để trang riêng tải đủ phim mùa cũ. */
export async function writePeople(people, shows) {
  const works = new Map(people.map((person) => [person.id, new Set()]));
  for (const show of shows) {
    for (const platform of show.ps) {
      const cr = platform.cr;
      if (!cr) continue;
      for (const id of [...(cr.dg ?? []), ...(cr.lt ?? []), ...(cr.vo ?? []).map(([, person]) => person)]) works.get(id)?.add(show.id);
    }
  }
  const out = people.map((person) => ({ ...person, w: [...works.get(person.id)].sort((a, b) => a - b) }));
  await writeFile(PEOPLE_FILE, "[\n" + out.map((person) => JSON.stringify(person)).join(",\n") + "\n]\n");
  console.log(`Nhân sự: ${out.length} người, ${out.filter((person) => person.w.length).length} người có phim.`);
}

const CAST_QUERY = `query($ids:[Int]){Page(perPage:10){media(id_in:$ids,type:ANIME){id
  characters(perPage:10,sort:[ROLE,RELEVANCE,ID]){edges{role node{id name{full} image{medium}}
  voiceActors(language:JAPANESE,sort:[RELEVANCE,ID]){id name{full native} image{medium}}}}}}}`;

const image = (img) => (img?.medium && !/\/default\.(jpg|png)$/i.test(img.medium) ? img.medium : "");

function castOf(media) {
  return (media.characters?.edges ?? []).map(({ role, node, voiceActors }) => {
    const va = voiceActors?.[0];
    return {
      c: node.id,
      n: node.name.full,
      r: role === "MAIN" ? "M" : "S",
      ...(image(node.image) ? { img: image(node.image) } : {}),
      ...(va ? { va: { id: va.id, n: va.name.full, ...(va.name.native ? { j: va.name.native } : {}), ...(image(va.image) ? { img: image(va.image) } : {}) } } : {}),
    };
  });
}

/**
 * Nhân vật cho các phim có bản Việt, lưu đệm ở data/nhan-vat.json.
 * Mỗi lần chạy lấy tối đa CAST_LIMIT phim (mặc định 150): phim chưa có trước, rồi tới phim lâu chưa làm mới (30 ngày).
 * Lỗi AniList chỉ làm dừng phần này, lịch chiếu vẫn cập nhật bình thường.
 */
export async function updateCast(ids, gql) {
  let cache = {};
  try { cache = JSON.parse(await readFile(CAST_FILE, "utf8")); } catch { /* lần đầu chưa có file */ }
  const wanted = new Set(ids);
  for (const id of Object.keys(cache)) if (!wanted.has(Number(id))) delete cache[id];

  const now = Date.now();
  const missing = ids.filter((id) => !cache[id]);
  const stale = ids.filter((id) => cache[id] && now - cache[id].t > 30 * DAY).sort((a, b) => cache[a].t - cache[b].t);
  const queue = [...missing, ...stale].slice(0, Number(process.env.CAST_LIMIT) || 150);
  let done = 0;
  for (let i = 0; i < queue.length; i += 10) {
    const batch = queue.slice(i, i + 10);
    try {
      const { media } = await gql(CAST_QUERY, { ids: batch });
      const byId = new Map(media.map((m) => [m.id, m]));
      for (const id of batch) cache[id] = { t: now, ch: byId.has(id) ? castOf(byId.get(id)) : [] };
      done += batch.length;
    } catch (error) {
      console.warn("Không lấy được nhân vật từ AniList, để lần sau:", error.message);
      break;
    }
    await new Promise((r) => setTimeout(r, 2300));
  }
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  const keys = Object.keys(cache).sort((a, b) => a - b);
  await writeFile(CAST_FILE, "{\n" + keys.map((id) => `${JSON.stringify(id)}:${JSON.stringify(cache[id])}`).join(",\n") + "\n}\n");
  console.log(`Nhân vật: làm mới ${done} phim, còn ${Math.max(0, missing.length - done)} phim chưa có.`);
  return cache;
}
