import { airingOf, episodeNumber } from '../domain/shows.js';
import { isFollowing } from '../domain/follow.js';
import { html } from '../lib/html.js';
import { showPath } from '../lib/paths.js';
import { formatEta, formatShortDateTime } from '../lib/time.js';
import { chip, followButton, icon, languageChip, poster, statusBadge } from './common.js';
import { platformLogo, platformMarks } from './platform-logo.js';

/** Tập mới nhất đã chiếu, hoặc tập 1 nếu phim chưa lên sóng. */
function airingLine(show, airing) {
  const aired = airing.aired > 0;
  const time = aired ? airing.timeOf(airing.aired) : airing.first;
  return html`
    <p class="show-card__airing">
      ${icon(aired ? 'history' : 'schedule')}
      <span class="visually-hidden">${aired ? 'Đã chiếu:' : 'Sẽ chiếu:'}</span>
      <span>Tập ${episodeNumber(show.platforms[0], aired ? airing.aired : 1)} · <time>${formatShortDateTime(time)}</time></span>
    </p>`;
}

function followCountdown(show, airing, now) {
  if (!isFollowing(show.id)) return '';
  return html`<p class="show-card__eta">${airing.next
    ? html`Tập ${episodeNumber(show.platforms[0], airing.aired + 1)} chiếu sau <strong>${formatEta(airing.next - now)}</strong>`
    : 'Đã chiếu hết'}</p>`;
}

function episodeProgress(show, airing) {
  const percent = Math.round((airing.aired / show.episodes) * 100);
  return html`
    <div class="episode-progress">
      <div class="progress" role="progressbar" aria-label="Số tập đã chiếu"
        aria-valuenow="${airing.aired}" aria-valuemin="0" aria-valuemax="${show.episodes}">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>
      <span class="episode-progress__count">${airing.aired}/${show.episodes}</span>
    </div>`;
}

/** Thẻ ngang: logo nền tảng một hàng riêng, phụ đề và thể loại tối đa hai hàng để các thẻ bằng nhau. */
export function showCard(show, now, { showCountdown = false } = {}) {
  const airing = airingOf(show, now);
  return html`
    <li class="col">
      <article class="show-card">
        ${followButton(show)}
        ${poster(show)}
        <div class="show-card__body">
          ${statusBadge(airing.status)}
          <h3 class="show-card__title"><a class="stretched-link" href="${showPath(show.id, show.title)}" title="${show.title}">${show.title}</a></h3>
          ${airingLine(show, airing)}
          ${showCountdown ? followCountdown(show, airing, now) : ''}
          ${episodeProgress(show, airing)}
          <div class="platform-logos">${show.platforms.map(platformLogo)}</div>
          <ul class="chip-list show-card__tags">
            ${show.languages.map(languageChip)}
            ${show.genres.map(chip)}
          </ul>
        </div>
      </article>
    </li>`;
}

/** Thẻ gọn cho phim cũ trong kết quả tìm kiếm, dữ liệu đầy đủ chỉ tải khi mở trang phim. */
export const archiveCard = (item) => html`
  <li class="col">
    <article class="show-card">
      ${poster(item)}
      <div class="show-card__body">
        ${statusBadge('done')}
        <h3 class="show-card__title"><a class="stretched-link" href="${showPath(item.id, item.title)}" title="${item.title}">${item.title}</a></h3>
        ${platformMarks(item.platforms)}
      </div>
    </article>
  </li>`;

export const showGrid = (shows, now, options) => shows.map((show) => showCard(show, now, options));

/** Lưới chung cho Theo mùa và Tìm Anime. */
export const SHOW_GRID_CLASS = 'row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3 list-unstyled';
