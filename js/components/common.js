/* Các mảnh giao diện nhỏ dùng chung. */

import { STATUS } from '../config.js';
import { isFollowing } from '../domain/follow.js';
import { languageKind } from '../domain/shows.js';
import { html } from '../lib/html.js';

export const icon = (name, className = '') =>
  html`<span class="material-symbols-rounded icon ${className}" data-icon="${name}" aria-hidden="true"></span>`;

const initialsOf = (title) =>
  title.split(' ').slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase();

export function hueOf(text) {
  let hue = 0;
  for (const char of text) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

export const isExternalUrl = (url) => /^https?:\/\//i.test(url ?? '');

/** Thuộc tính cho link ngoài. Nền tảng chưa có link (data.js ghi "#") sẽ hiện thông báo khi bấm. */
export function externalLink(url) {
  return isExternalUrl(url)
    ? html`href="${url}" target="_blank" rel="noopener"`
    : html`href="#" data-no-link`;
}

/** Bìa tạo sẵn nằm dưới ảnh thật, nên ảnh lỗi vẫn còn bìa để hiện. */
/** Ảnh AniList có bản cỡ lớn: màn hình độ phân giải cao dùng bản này cho poster to. */
const sharpSource = (url) => (/\/cover\/medium\//.test(url)
  ? html`srcset="${url} 230w, ${url.replace('/cover/medium/', '/cover/large/')} 460w" sizes="13rem"` : '');

export function poster(show, size = '', { alt = '', eager = false, sharp = false } = {}) {
  const hasImage = /^(https?:|data:image\/)/i.test(show.poster);
  return html`
    <span class="poster ${size}" style="--poster-hue:${hueOf(show.title)}" aria-hidden="true">
      <span class="poster__initials">${initialsOf(show.title)}</span>
      ${hasImage ? html`<img class="poster__image" src="${show.poster}" ${sharp ? sharpSource(show.poster) : ''} alt="${alt}" ${eager ? html`fetchpriority="high"` : html`loading="lazy" decoding="async"`} referrerpolicy="no-referrer" data-remove-on-error>` : ''}
    </span>`;
}

export function statusBadge(status) {
  const { label, icon: name } = STATUS[status];
  return html`<span class="status status--${status}">${icon(name)}${label}</span>`;
}

export function chip(text) {
  return html`<li class="chip">${text}</li>`;
}

export function languageChip(language) {
  return html`<li class="chip chip--${languageKind(language)}">${language}</li>`;
}

export function emptyState(iconName, message) {
  return html`<div class="empty-state">${icon(iconName)}<p class="mb-0">${message}</p></div>`;
}

/** Nút sao theo dõi. Màu và độ đầy của sao đi theo aria-pressed trong CSS. */
export function followButton(show, className = 'follow-btn') {
  const label = `Theo dõi ${show.title}`;
  return html`
    <button class="${className}" type="button" data-follow="${show.id}" aria-pressed="${isFollowing(show.id)}"
      aria-label="${label}" data-bs-title="Theo dõi">${icon('star')}</button>`;
}

/** Nút mở menu chỉ có icon. Bootstrap chỉ cho một component trên một phần tử nên tooltip nằm ở span bên trong. */
export function menuButton(iconName, label) {
  return html`
    <button class="btn btn-icon" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="${label}">
      <span class="btn-icon__face" data-bs-title="${label}">${icon(iconName)}</span>
    </button>`;
}
