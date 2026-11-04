/* Một nơi duy nhất quy định đường dẫn. Website và sitemap (scripts/update.mjs) dùng chung file này.
   Đổi cấu trúc đường dẫn thì nhớ sửa cả đoạn rewrite trong deploy/them-vao-htaccess.txt. */

import { slugify } from './text.js';

export const PATHS = {
  home: '/',
  seasons: '/theo-mua',
  search: '/tim-anime',
  mine: '/phim-cua-toi',
  about: '/gioi-thieu',
  tierList: '/tier-list',
};

/** /tier-list?mua=thu-2026. Link chia sẻ thêm dữ liệu bảng sau dấu #. */
export const tierListPath = (key) => `${PATHS.tierList}?mua=${seasonPath(key).split('/').pop()}`;

export const platformPath = (slug) => `/nen-tang/${slug}`;
export const platformHeading = ({ label, dubbed }) => `Anime ${dubbed ? 'lồng tiếng' : 'Vietsub'} trên ${label}`;
export const platformReleaseText = ({ dubbed }) => (dubbed ? 'có bản lồng tiếng' : 'có phụ đề tiếng Việt');

const SEASON_SLUGS = { winter: 'dong', spring: 'xuan', summer: 'ha', fall: 'thu' };

/** fall-2026 thành /mua/thu-2026. */
export function seasonPath(key) {
  const [family, year] = key.split('-');
  return `/mua/${SEASON_SLUGS[family]}-${year}`;
}

/** thu-2026 thành fall-2026. */
export function seasonKeyFromSlug(slug) {
  const [name, year] = slug.split('-');
  const family = Object.keys(SEASON_SLUGS).find((key) => SEASON_SLUGS[key] === name);
  return family ? `${family}-${year}` : '';
}

export function showPath(id, title) {
  const slug = slugify(title);
  return slug ? `/phim/${id}-${slug}` : `/phim/${id}`;
}

/** Đường dẫn #... của bản cũ, để link đã chia sẻ vẫn mở đúng trang. */
export function legacyHashPath(hash) {
  const fixed = {
    '#trang-chu': PATHS.home,
    '#lich-chieu': PATHS.seasons,
    '#danh-sach': PATHS.seasons,
    '#tim-anime': PATHS.search,
    '#phim-cua-toi': PATHS.mine,
  };
  if (fixed[hash]) return fixed[hash];
  const show = hash.match(/^#phim-(\d+)$/);
  if (show) return `/phim/${show[1]}`;
  const season = hash.match(/^#mua-([a-z]+-\d{4})$/);
  return season ? seasonPath(season[1]) : '';
}

/**
 * Chỉ trang phim có bản tiếng Việt mới đưa cho Google. Phim Engsub tự động từ AniList chỉ có
 * nội dung tiếng Anh trùng với nhiều web khác nên để noindex, tránh làm loãng chất lượng cả web.
 */
export const hasVietnameseRelease = (languages, nsfw) =>
  !nsfw && languages.some((language) => !/eng/i.test(language));
