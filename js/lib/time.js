/* Mọi thời gian hiển thị theo giờ Việt Nam (UTC+7), bất kể thiết bị đặt múi giờ nào. */

import { WEEKDAYS, WEEKDAYS_SHORT } from '../config.js';

export const DAY_MS = 864e5;
export const WEEK_MS = 7 * DAY_MS;

const VN_OFFSET_MS = 7 * 36e5;

const pad = (n) => String(n).padStart(2, '0');
const inVietnam = (time) => new Date(time + VN_OFFSET_MS);

export const padNumber = pad;
export const toIso = (time) => new Date(time).toISOString();
export const weekdayOf = (time) => inVietnam(time).getUTCDay();

export function formatTime(time) {
  const d = inVietnam(time);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "T7 11:00, 04/10/2026" */
export function formatDateTime(time) {
  const d = inVietnam(time);
  return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${formatTime(time)}, ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** "T7 11:00, 04/10" */
export function formatShortDateTime(time) {
  return formatDateTime(time).slice(0, -5);
}

/** "Thứ hai, 02/11" */
export function formatDayLabel(time) {
  const d = inVietnam(time);
  return `${WEEKDAYS[d.getUTCDay()]}, ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

/** "2 ngày 3 giờ", "5 giờ 10 phút", "8 phút" */
export function formatEta(ms) {
  const minutes = Math.max(0, Math.round(ms / 6e4));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `${days} ngày ${hours} giờ`;
  return hours ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`;
}
