/* Trang từng nền tảng: mọi anime có bản tiếng Việt trên nền tảng đó, mùa mới nhất lên trước. */

import { SHOW_GRID_CLASS, showGrid } from '../components/show-card.js';
import { html, mount } from '../lib/html.js';
import { hasVietnameseRelease, seasonPath } from '../lib/paths.js';

/** Phim đang có bản tiếng Việt trên nền tảng này. */
export const platformShows = ({ shows }, platform) => shows.filter((show) =>
  hasVietnameseRelease(show.filterLanguages, show.nsfw)
  && show.platforms.some(({ name }) => platform.names.includes(name)));

export function mountPlatform(root, { catalog }, platform) {
  const shows = platformShows(catalog, platform);
  const now = Date.now();
  const seasons = [...catalog.seasons].reverse()
    .map((season) => ({ season, list: shows.filter((show) => show.season === season.key) }))
    .filter(({ list }) => list.length);

  mount(root, html`
    <h1 class="page-title" tabindex="-1">Anime Vietsub trên ${platform.label}</h1>
    <p class="page-intro">${platform.label} là ${platform.note}. A4VFamily đang theo dõi ${shows.length} anime có phụ đề
      tiếng Việt trên nền tảng này, kèm giờ chiếu theo giờ Việt Nam.</p>
    ${seasons.map(({ season, list }) => html`
      <section aria-labelledby="season-${season.key}">
        <header class="section-header">
          <h2 id="season-${season.key}"><a href="${seasonPath(season.key)}">${season.name}</a></h2>
          <span class="section-header__note">${list.length} phim</span>
        </header>
        <ul class="${SHOW_GRID_CLASS}">${showGrid(list, now)}</ul>
      </section>`)}`);
  return null;
}
