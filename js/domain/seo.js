/* Tiêu đề, mô tả và dữ liệu có cấu trúc của từng trang. Không đụng tới DOM. */

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, WEEKDAYS } from '../config.js';
import { hasVietnameseRelease, PATHS, platformPath, seasonPath, showPath } from '../lib/paths.js';
import { truncateWords } from '../lib/text.js';
import { formatTime, weekdayOf } from '../lib/time.js';
import { airingOf, englishName, languageKind } from './shows.js';

const MAX_DESCRIPTION = 155;
const withBrand = (title) => `${title} | ${SITE_NAME}`;
const absolute = (path) => `${SITE_URL}${path}`;

export const homeSeo = () => ({
  title: withBrand('Lịch chiếu anime Vietsub bản quyền hôm nay'),
  description: SITE_DESCRIPTION,
  path: PATHS.home,
});

export const searchSeo = () => ({
  title: withBrand('Tìm anime Vietsub bản quyền'),
  description: 'Tìm anime theo tên tiếng Việt, tiếng Anh hoặc Romaji và xem nền tảng đang chiếu bản quyền tại Việt Nam.',
  path: PATHS.search,
});

export const mineSeo = () => ({
  title: withBrand('Phim của tôi'),
  description: SITE_DESCRIPTION,
  path: PATHS.mine,
  noindex: true,
});

export const notFoundSeo = (path) => ({
  title: withBrand('Không tìm thấy anime'),
  description: SITE_DESCRIPTION,
  path,
  noindex: true,
});

export const aboutSeo = () => ({
  title: withBrand('Giới thiệu nhóm dịch anime 20 năm kinh nghiệm'),
  description: 'A4VFamily là nhóm dịch anime Nhật - Việt với 20 năm kinh nghiệm và gần 1000 dự án, cung cấp dịch thuật, lồng tiếng và marketing cho anime bản quyền.',
  path: PATHS.about,
  jsonLd: [{
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: absolute(PATHS.about),
    name: `Giới thiệu ${SITE_NAME}`,
    inLanguage: 'vi',
    mainEntity: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      foundingDate: '2006',
      email: 'a4vtranslation@gmail.com',
      knowsLanguage: ['vi', 'ja', 'en', 'zh'],
    },
  }],
});

/** Danh sách trang phim cho công cụ tìm kiếm hiểu quan hệ giữa trang danh sách và trang phim. */
const itemListJsonLd = (name, shows) => [{
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  numberOfItems: shows.length,
  itemListElement: shows.map((show, index) => ({
    '@type': 'ListItem', position: index + 1, url: absolute(showPath(show.id, show.title)), name: show.title,
  })),
}];

export function platformSeo(platform, shows) {
  const name = `Anime Vietsub trên ${platform.label}`;
  return {
    title: withBrand(`${name}: danh sách và lịch chiếu`),
    description: truncateWords(
      `${shows.length} anime có phụ đề tiếng Việt trên ${platform.label} (${platform.note}), kèm giờ chiếu và link xem từng phim.`,
      MAX_DESCRIPTION,
    ),
    path: platformPath(platform.slug),
    jsonLd: itemListJsonLd(name, shows),
  };
}

export function seasonSeo(season, count, shows = []) {
  return {
    title: withBrand(`${season.name}: lịch chiếu Vietsub bản quyền`),
    description: truncateWords(
      `Danh sách ${count} bộ ${season.name} (${season.range}): giờ chiếu, số tập và nền tảng xem bản quyền tại Việt Nam.`,
      MAX_DESCRIPTION,
    ),
    path: seasonPath(season.key),
    jsonLd: shows.length ? itemListJsonLd(season.name, shows) : null,
  };
}

const vietnameseLabel = (show) =>
  (show.platforms.some((platform) => languageKind(platform.language) === 'vi') ? 'Vietsub' : 'Engsub');

/**
 * Câu mô tả dựng từ dữ liệu của chính site: bản Việt của từng phim, nền tảng và giờ chiếu.
 * Đây là phần riêng của A4VFamily, khác với tóm tắt tiếng Anh lấy từ AniList.
 */
export function showFacts(show, season, now) {
  const names = [...new Set(show.platforms.map((platform) => platform.name))].join(', ');
  const count = show.episodesUnknown ? '' : ` ${show.episodes} tập`;
  const seasonText = season ? `, thuộc ${season.name}` : '';
  const english = englishName(show);
  const facts = [`${show.title}${english ? ` (${english})` : ''} là anime ${show.format}${count}${seasonText}.`];
  facts.push(`Tại Việt Nam, phim có ${vietnameseLabel(show)} trên ${names}.`);
  const airing = airingOf(show, now);
  if (airing.next && show.format !== 'Movie') {
    facts.push(`Tập mới chiếu ${WEEKDAYS[weekdayOf(airing.next)]} hằng tuần lúc ${formatTime(airing.next)} giờ Việt Nam.`);
  }
  return facts.join(' ');
}

function showJsonLd(show, season, path) {
  const isMovie = show.format === 'Movie';
  const breadcrumb = [
    { name: 'Lịch chiếu', path: PATHS.home },
    ...(season ? [{ name: season.name, path: seasonPath(season.key) }] : []),
    { name: show.title, path },
  ];
  return [
    {
      '@context': 'https://schema.org',
      '@type': isMovie ? 'Movie' : 'TVSeries',
      name: show.title,
      alternateName: [...new Set([show.altTitle, show.englishTitle].filter(Boolean))],
      url: absolute(path),
      ...(show.poster ? { image: show.poster } : {}),
      ...(show.synopsis ? { description: truncateWords(show.synopsis, 500) } : {}),
      genre: show.genres,
      ...(isMovie || show.episodesUnknown ? {} : { numberOfEpisodes: show.episodes }),
      [isMovie ? 'datePublished' : 'startDate']: show.firstAiredAt.slice(0, 10),
      sameAs: [show.malUrl, show.websiteUrl].filter(Boolean),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumb.map((item, index) => ({
        '@type': 'ListItem', position: index + 1, name: item.name, item: absolute(item.path),
      })),
    },
  ];
}

export function showSeo(show, season, now = Date.now()) {
  const path = showPath(show.id, show.title);
  return {
    title: withBrand(`${show.title} ${vietnameseLabel(show)}: lịch chiếu và nơi xem`),
    description: truncateWords(showFacts(show, season, now), MAX_DESCRIPTION),
    path,
    image: show.poster,
    type: 'video.tv_show',
    noindex: !hasVietnameseRelease(show.filterLanguages, show.nsfw),
    jsonLd: showJsonLd(show, season, path),
  };
}
