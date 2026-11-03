/* Quy tắc nghiệp vụ, không đụng tới DOM nên dễ kiểm thử và dùng lại. */

import { UPCOMING_WINDOW_DAYS } from '../config.js';
import { normalizeText } from '../lib/text.js';
import { DAY_MS, todayStart, WEEK_MS, weekdayOf } from '../lib/time.js';
import { isFollowing } from './follow.js';

/**
 * Tính lịch một phim trên một nền tảng. Mốc trong gio_cac_tap dời giờ từ tập đó trở đi,
 * các tập sau tính tiếp mỗi tuần.
 */
export function airingOf(show, now, platform = show.platforms[0]) {
  const first = Date.parse(platform.firstAiredAt || show.firstAiredAt);
  const milestoneEpisodes = Object.keys(platform.milestones).map(Number);

  /** Giờ chiếu của tập số `episode` (đếm từ 1). */
  const timeOf = (episode) => {
    const anchor = milestoneEpisodes.reduce((best, n) => (n <= episode && n > best ? n : best), 0);
    return anchor
      ? Date.parse(platform.milestones[anchor]) + (episode - anchor) * WEEK_MS
      : first + (episode - 1) * WEEK_MS;
  };

  let aired = 0;
  while (aired < show.episodes && timeOf(aired + 1) <= now) aired += 1;

  const next = aired < show.episodes ? timeOf(aired + 1) : null;
  const status = aired === 0 ? 'soon' : aired >= show.episodes ? 'done' : 'air';
  return { aired, first, next, status, timeOf };
}

export function languageKind(language) {
  if (/eng/i.test(language)) return 'en';
  return /lồng|long tieng/i.test(language) ? 'dub' : 'vi';
}

/** Lọc chung: luôn ẩn 18+, rồi áp dụng phụ đề và "Phim của tôi". */
function matchesFilters(show, { language, mine }) {
  return !show.nsfw
    && (!mine || isFollowing(show.id))
    && (language === 'all' || show.filterLanguages.some((item) => languageKind(item) === language));
}

const nextAiring = (show, now) => airingOf(show, now).next ?? Infinity;

const SORTERS = {
  air: (a, b, now) => nextAiring(a, now) - nextAiring(b, now),
  views: (a, b) => b.popularity - a.popularity,
  name: (a, b) => a.title.localeCompare(b.title, 'vi'),
};

const sortShows = (shows, sort, now) => [...shows].sort((a, b) => SORTERS[sort](a, b, now));

/** Tìm theo tên Việt, Anh hoặc Romaji, có dấu hay không dấu đều được. */
const matchesQuery = (show, query) => {
  const needle = normalizeText(query.trim());
  return !needle || normalizeText(show.searchText).includes(needle);
};

export function selectSeasonShows(shows, { seasonKey, sort, language, mine, query }, now) {
  const list = shows.filter((show) =>
    show.season === seasonKey && matchesFilters(show, { language, mine }) && matchesQuery(show, query));
  return sortShows(list, mine ? 'air' : sort, now);
}

export function searchShows(shows, { query, genre }, now) {
  const list = shows.filter(
    (show) => !show.nsfw && (!genre || show.genres.includes(genre)) && matchesQuery(show, query),
  );
  return sortShows(list, 'name', now);
}

/** Lọc chỉ mục phim cũ theo cùng điều kiện với searchShows. */
export function searchArchive(items, { query, genre }, knownIds) {
  return items
    .filter((item) => !knownIds.has(item.id) && (!genre || item.genres.includes(genre)) && matchesQuery(item, query))
    .sort((a, b) => a.title.localeCompare(b.title, 'vi'));
}

export function allGenres(shows) {
  return [...new Set(shows.filter((show) => !show.nsfw).flatMap((show) => show.genres))]
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

const firstAirTime = (show) => Date.parse(show.firstAiredAt);
export const airWeekday = (show) => weekdayOf(firstAirTime(show));

/** Phim hiện ở Lịch chiếu: đang chiếu, hoặc sắp chiếu trong vài ngày tới. Sắp theo giờ trong ngày. */
export function selectWeekShows(shows, filters, now) {
  // Tính từ đầu ngày phát sóng, để phim 24:30 đứng sau phim 23:00.
  const clockOf = (show) => firstAirTime(show) - todayStart(firstAirTime(show));
  return shows
    .filter((show) => matchesFilters(show, filters))
    .map((show) => ({ show, airing: airingOf(show, now) }))
    .filter(({ airing }) =>
      airing.status === 'air' ||
      (airing.status === 'soon' && airing.first - now < UPCOMING_WINDOW_DAYS * DAY_MS))
    .sort((a, b) => clockOf(a.show) - clockOf(b.show));
}

/** Số tập hiện cho người xem. Playlist đánh số nối tiếp mùa trước thì khớp với số trên YouTube. */
export const episodeNumber = (platform, episode) => episode + platform.episodeOffset;

/** Các tập chiếu trong "hôm nay", kể cả tập cuối của phim vừa kết thúc. */
export function selectTodayEpisodes(shows, filters, now) {
  const start = todayStart(now);
  const end = start + DAY_MS;
  return shows
    .filter((show) => matchesFilters(show, filters))
    .flatMap((show) => {
      const airing = airingOf(show, now);
      // Một ngày có thể chiếu nhiều tập nên xét cả các tập quanh tập vừa chiếu.
      const first = Math.max(1, airing.aired - 3);
      const last = Math.min(show.episodes, airing.aired + 4);
      const episodes = [];
      for (let episode = first; episode <= last; episode += 1) {
        const time = airing.timeOf(episode);
        if (time >= start && time < end) episodes.push({ show, episode, time });
      }
      return episodes;
    })
    .sort((a, b) => a.time - b.time);
}
