/* Phim mùa cũ không nằm trong data.js để trang tải nhanh.
   kho.json là chỉ mục gọn cho tìm kiếm; dữ liệu đầy đủ theo từng mùa ở /du-lieu/mua-<mùa>.json, chỉ tải khi cần. */

import { normalizeShow } from './catalog.js';

const REFRESH_MS = 36e5;

async function fetchJson(path) {
  const response = await fetch(`${path}?v=${Math.floor(Date.now() / REFRESH_MS)}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

const toItem = (raw) => ({
  id: raw.id,
  season: raw.s,
  title: raw.t,
  searchText: [raw.t, raw.en, raw.alt].filter(Boolean).join(' '),
  poster: raw.img ?? '',
  genres: raw.g ?? [],
  filterLanguages: raw.l ?? [],
  platforms: (raw.p ?? []).map((name) => ({ name })),
  platformNames: raw.p ?? [],
  freePlatformNames: raw.f ?? [],
  synopsisPending: true,
});

let index;

/** Chưa có kho hoặc lỗi mạng thì coi như kho rỗng, trang vẫn chạy bình thường. */
export function loadArchiveIndex() {
  index ??= fetchJson('/kho.json').then((items) => items.map(toItem)).catch(() => []);
  return index;
}

const loaded = new Map();

function loadSeason(catalog, key) {
  if (!loaded.has(key)) {
    loaded.set(key, fetchJson(`/du-lieu/mua-${key}.json`).then((rawShows) => {
      const known = new Set(catalog.shows.map((show) => show.id));
      const added = rawShows.map(normalizeShow).filter((show) => !known.has(show.id));
      catalog.shows.push(...added);
      return added.length;
    }).catch(() => 0));
  }
  return loaded.get(key);
}

/** Trả về số phim vừa thêm vào catalog. */
export async function loadSeasonIfArchived(catalog, key) {
  const items = await loadArchiveIndex();
  return items.some((item) => item.season === key) ? loadSeason(catalog, key) : 0;
}

/** Mô tả phim gần đây nằm riêng theo mùa để data.js nhẹ hơn; mỗi mùa chỉ tải một lần. */
const synopsisSeasons = new Map();

export async function loadSynopsis(show) {
  if (!synopsisSeasons.has(show.season)) {
    synopsisSeasons.set(show.season, fetchJson(`/du-lieu/mo-ta-${show.season}.json`).catch(() => ({})));
  }
  const synopses = await synopsisSeasons.get(show.season);
  show.synopsis = synopses?.[show.id] ?? '';
  show.synopsisPending = false;
}

/** Mô tả phim cũ nằm trong file mùa đầy đủ; chỉ lấy mô tả, không thêm phim vào catalog. */
const archiveSynopsisSeasons = new Map();

export async function loadArchiveSynopsis(item) {
  if (!archiveSynopsisSeasons.has(item.season)) {
    archiveSynopsisSeasons.set(item.season, fetchJson(`/du-lieu/mua-${item.season}.json`)
      .then((rawShows) => Object.fromEntries(rawShows.map((raw) => [raw.id, raw.d ?? ''])))
      .catch(() => ({})));
  }
  const synopses = await archiveSynopsisSeasons.get(item.season);
  item.synopsis = synopses[item.id] ?? '';
  item.synopsisPending = false;
}

export async function loadArchivedShow(catalog, id) {
  const item = (await loadArchiveIndex()).find((entry) => entry.id === id);
  if (!item) return false;
  await loadSeason(catalog, item.season);
  return catalog.shows.some((show) => show.id === id);
}

/** Tải mọi mùa cũ có phim trên các nền tảng này. Trả về true nếu có phim mới. */
export async function loadArchivedPlatforms(catalog, names) {
  const items = await loadArchiveIndex();
  const keys = new Set(items
    .filter((item) => item.platforms.some(({ name }) => names.includes(name)))
    .map((item) => item.season));
  const counts = await Promise.all([...keys].map((key) => loadSeason(catalog, key)));
  return counts.some(Boolean);
}
