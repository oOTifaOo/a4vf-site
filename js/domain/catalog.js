/* Cầu nối với data.js. scripts/update.mjs ghi data.js bằng tên trường ngắn (t, ps, eps...);
   file này đổi chúng sang tên dễ đọc. Nếu định dạng data.js đổi, chỉ cần sửa file này. */

import { REMOTE_DATA_URL, SEASON_NAMES } from '../config.js';
import { languageKind } from './shows.js';

const DUB_PATTERN = /lồng/i;

/** Cột ngon_ngu trong Sheet đôi khi chứa ngày giờ do nhập lệch cột; khi đó coi như Vietsub. */
const languageOf = (value) => (/\d{4}-\d{1,2}-\d{1,2}/.test(value) ? 'Vietsub' : value);

function normalizePlatform(raw) {
  return {
    name: raw.n,
    url: raw.u,
    language: languageOf(raw.lang),
    hasDub: Boolean(raw.dub),
    firstAiredAt: raw.first,
    episodeLinks: raw.e ?? {},
    milestones: raw.m ?? {},
  };
}

function normalizeShow(raw, index) {
  const sources = raw.ps ?? [{ n: raw.p.n, u: raw.p.u, lang: raw.lang, e: raw.e, first: raw.first, m: raw.m }];
  const allPlatforms = sources.map(normalizePlatform);

  // Nhóm phụ đề của dòng đầu tiên là nhóm chính, hiện trên thẻ phim; nhóm còn lại chỉ có ở trang phim.
  const isEngsub = (platform) => languageKind(platform.language) === 'en';
  const primaryIsEngsub = isEngsub(allPlatforms[0]);
  const platforms = allPlatforms.filter((platform) => isEngsub(platform) === primaryIsEngsub);
  const otherPlatforms = allPlatforms.filter((platform) => isEngsub(platform) !== primaryIsEngsub);

  const languagesOf = (list) => [...new Set(list.flatMap((platform) => [
    platform.language,
    ...(platform.hasDub && !DUB_PATTERN.test(platform.language) ? ['Lồng tiếng'] : []),
  ]))];

  return {
    id: raw.id || index + 1,
    season: raw.s,
    title: raw.t,
    altTitle: raw.alt,
    searchText: [raw.t, raw.en, raw.alt].filter(Boolean).join(' '),
    firstAiredAt: platforms[0].firstAiredAt || raw.first,
    episodes: raw.eps,
    popularity: raw.v,
    genres: raw.g,
    format: raw.f,
    synopsis: raw.d ?? '',
    poster: raw.img ?? '',
    malUrl: raw.mal ?? '',
    websiteUrl: raw.web ?? '',
    xUrl: raw.x ?? '',
    trailer: raw.tr ?? null,
    nsfw: Boolean(raw.nsfw),
    platforms,
    otherPlatforms,
    languages: languagesOf(platforms),
    filterLanguages: languagesOf(allPlatforms),
  };
}

function normalizeSeason(raw) {
  const [family, year] = raw.k.split('-');
  return {
    key: raw.k,
    family,
    name: SEASON_NAMES[family] ? `Anime Mùa ${SEASON_NAMES[family]} ${year}` : raw.n,
    range: raw.r,
  };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

/** Trên website lấy data.js từ GitHub Pages; chạy thử trên máy hoặc khi lỗi thì dùng file cạnh index.html. */
async function loadDataFile() {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (REMOTE_DATA_URL && !isLocal) {
    try {
      await loadScript(REMOTE_DATA_URL);
      return;
    } catch {
      console.warn('Không tải được data.js từ GitHub Pages, dùng bản trên host.');
    }
  }
  await loadScript('data.js');
}

/** Tải data.js rồi đọc SEASONS và SHOWS do file đó tạo ra. */
export async function loadCatalog() {
  await loadDataFile();
  /* global SEASONS, SHOWS */
  if (typeof SEASONS === 'undefined' || typeof SHOWS === 'undefined') {
    throw new Error('data.js chưa tải được');
  }
  return { seasons: SEASONS.map(normalizeSeason), shows: SHOWS.map(normalizeShow) };
}

/** Mùa hiện tại nếu có phim, nếu không thì mùa gần nhất có phim. */
export function defaultSeason({ seasons, shows }, now) {
  const date = new Date(now);
  const families = ['winter', 'spring', 'summer', 'fall'];
  const currentKey = `${families[Math.floor(date.getUTCMonth() / 3)]}-${date.getUTCFullYear()}`;
  const hasShows = (season) => shows.some((show) => show.season === season.key);

  return seasons.find((season) => season.key === currentKey && hasShows(season))
    ?? seasons.filter(hasShows).at(-1)
    ?? seasons.at(-1);
}
