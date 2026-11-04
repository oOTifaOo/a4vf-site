/* Mọi thời gian hiển thị theo giờ Việt Nam (UTC+7), bất kể thiết bị đặt múi giờ nào.
   Một ngày phát sóng kết thúc lúc TODAY_END_HOUR sáng hôm sau: 1 giờ sáng thứ Tư ghi là 25:00 thứ Ba. */

import { TODAY_END_HOUR, WEEKDAYS, WEEKDAYS_SHORT } from '../config.js';

export const DAY_MS = 864e5;
export const WEEK_MS = 7 * DAY_MS;

const VN_OFFSET_MS = 7 * 36e5;

const pad = (n) => String(n).padStart(2, '0');
const END_MS = TODAY_END_HOUR * 36e5;
const inVietnam = (time) => new Date(time + VN_OFFSET_MS);
const broadcastDate = (time) => inVietnam(time - END_MS);

export const padNumber = pad;
export const toIso = (time) => new Date(time).toISOString();
export const weekdayOf = (time) => broadcastDate(time).getUTCDay();

export function formatTime(time) {
  const d = inVietnam(time);
  const hours = d.getUTCHours();
  return `${pad(hours < TODAY_END_HOUR ? hours + 24 : hours)}:${pad(d.getUTCMinutes())}`;
}

/** "T7 11:00, 04/10/2026" */
export function formatDateTime(time) {
  const d = broadcastDate(time);
  return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${formatTime(time)}, ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** "T7 11:00, 04/10" */
export function formatShortDateTime(time) {
  return formatDateTime(time).slice(0, -5);
}

/** "Thứ hai, 02/11" */
export function formatDayLabel(time) {
  const d = broadcastDate(time);
  return `${WEEKDAYS[d.getUTCDay()]}, ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

/** "03:15:20" */
export function formatCountdown(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1e3));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map(pad).join(':');
}

/** Lúc bắt đầu của "hôm nay": khuya trước TODAY_END_HOUR vẫn tính là ngày hôm trước. */
export function todayStart(time) {
  return time - ((time + VN_OFFSET_MS - END_MS) % DAY_MS);
}

/** Lúc bắt đầu tuần phát sóng: thứ Hai, TODAY_END_HOUR giờ sáng. */
export function weekStart(time) {
  return todayStart(time) - ((weekdayOf(time) + 6) % 7) * DAY_MS;
}

/** "2 ngày 3 giờ", "5 giờ 10 phút", "8 phút" */
export function formatEta(ms) {
  const minutes = Math.max(0, Math.round(ms / 6e4));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `${days} ngày ${hours} giờ`;
  return hours ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`;
}
