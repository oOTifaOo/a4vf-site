import { LOGO_ALIASES } from '../config.js';
import { html } from '../lib/html.js';
import { externalLink, hueOf } from './common.js';

/** Tên file logo: "Ani-One Việt Nam" thành "ani-one-viet-nam" (xem logos/README.txt). */
const logoSlug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const abbreviate = (name) =>
  name.split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase();

const slugOf = (name) => {
  const slug = logoSlug(name);
  return LOGO_ALIASES[slug] ?? slug;
};

/** Thử .png, rồi .svg, rồi .webp; ui/images.js thay bằng chữ viết tắt nếu không có file nào. */
const logoImage = (name) => {
  const slug = slugOf(name);
  return html`<img src="/logos/${slug}.png" alt="" data-logo-slug="${slug}" data-logo-text="${abbreviate(name)}"
    data-logo-hue="${hueOf(name)}">`;
};

export function platformLogo(platform) {
  return html`
    <a class="platform-logo" ${externalLink(platform.url)} aria-label="${platform.name}" data-bs-title="${platform.name}">
      ${logoImage(platform.name)}
    </a>`;
}

/** Một hàng logo không phải link, dùng trong thẻ đã là link. Quá `limit` logo thì gộp thành "+N". */
export function platformMarks(platforms, limit = 4) {
  const names = [...new Map(platforms.map(({ name }) => [slugOf(name), name])).values()];
  const shown = names.length > limit ? names.slice(0, limit - 1) : names;
  const hidden = names.length - shown.length;
  return html`
    <span class="platform-marks" role="img" aria-label="${names.join(', ')}">
      ${shown.map((name) => html`<span class="platform-mark" title="${name}">${logoImage(name)}</span>`)}
      ${hidden ? html`<span class="platform-mark platform-mark--more" title="${names.slice(shown.length).join(', ')}">+${hidden}</span>` : ''}
    </span>`;
}
