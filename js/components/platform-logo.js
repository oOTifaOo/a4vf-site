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

/** Thử .png, rồi .svg, rồi .webp; ui/images.js thay bằng chữ viết tắt nếu không có file nào. */
export function platformLogo(platform) {
  const baseSlug = logoSlug(platform.name);
  const slug = LOGO_ALIASES[baseSlug] ?? baseSlug;
  return html`
    <a class="platform-logo" ${externalLink(platform.url)} aria-label="${platform.name}" data-bs-title="${platform.name}">
      <img src="logos/${slug}.png" alt="" data-logo-slug="${slug}" data-logo-text="${abbreviate(platform.name)}"
        data-logo-hue="${hueOf(platform.name)}">
    </a>`;
}
