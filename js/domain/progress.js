/* Tiến độ xem của từng phim, lưu trong trình duyệt của người xem.
   Số tập lưu theo thứ tự trong phim nên không lệch khi nền tảng đánh số khác nhau. */

import { PROGRESS_STORAGE_KEY } from '../config.js';
import { airingOf } from './shows.js';

const MAX_SHOWS = 100;

const entries = new Map();

const isValid = (entry) => Number.isInteger(entry?.episode) && entry.episode > 0 && Number.isFinite(entry.savedAt);

try {
  const saved = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || '{}') || {};
  Object.entries(saved).filter(([, entry]) => isValid(entry)).forEach(([id, entry]) => entries.set(Number(id), entry));
} catch {
  // Trình duyệt không cho đọc thì bắt đầu với danh sách rỗng.
}

function persist() {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    return true;
  } catch {
    return false;
  }
}

/** Mới xem gần đây đứng trước. */
const newestFirst = () => [...entries]
  .map(([id, entry]) => ({ id, ...entry }))
  .sort((a, b) => b.savedAt - a.savedAt);

function save(id, episode, source) {
  entries.set(id, { episode, ...source, savedAt: Date.now() });
  newestFirst().slice(MAX_SHOWS).forEach((entry) => entries.delete(entry.id));
  return persist();
}

export const progressOf = (id) => entries.get(id) ?? null;

export const recentProgressIds = (limit) => newestFirst().slice(0, limit).map(({ id }) => id);

/** Mở một tập: chỉ tăng tiến độ, xem lại tập cũ không kéo lùi. */
export function recordEpisode(id, episode, source) {
  const current = entries.get(id);
  if (current && current.episode > episode) return true;
  return save(id, episode, source);
}

/** Người xem tự chọn: đặt đúng tập đó, kể cả lùi lại. */
export const setProgress = (id, episode, source) => save(id, episode, source);

export function clearProgress(id) {
  entries.delete(id);
  return persist();
}

/** Phim cho mục "Tiếp tục xem": bỏ phim đã xem hết, phim có tập mới đứng trước. */
export function selectContinueWatching(shows, now, limit) {
  const byId = new Map(shows.map((show) => [show.id, show]));
  const items = newestFirst().flatMap((entry) => {
    const show = byId.get(entry.id);
    if (!show || show.unavailable || entry.episode >= show.episodes) return [];
    const platform = [...show.platforms, ...show.otherPlatforms].find(({ name }) => name === entry.platform) ?? show.platforms[0];
    const airing = airingOf(show, now, platform);
    const next = entry.episode + 1;
    const available = next <= airing.aired;
    const nextTime = airing.timeOf(next);
    return [{ show, platform, next, nextTime, available, isNew: available && nextTime > entry.savedAt }];
  });
  return [...items.filter(({ isNew }) => isNew), ...items.filter(({ isNew }) => !isNew)].slice(0, limit);
}
