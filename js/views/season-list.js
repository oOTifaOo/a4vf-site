/* "Danh sách theo mùa": toàn bộ phim của một mùa, có sắp xếp và lọc. */

import { emptyState, icon, menuButton } from '../components/common.js';
import { bindFilters, describeLanguage, languageFilter, mineToggle } from '../components/filters.js';
import { SHOW_GRID_CLASS, showGrid } from '../components/show-card.js';
import { SEASON_ICONS, SORTS } from '../config.js';
import { selectSeasonShows } from '../domain/shows.js';
import { html, mount } from '../lib/html.js';

function seasonStep(season, direction) {
  const name = direction === 'prev' ? 'chevron_left' : 'chevron_right';
  const label = direction === 'prev' ? 'Mùa trước' : 'Mùa sau';
  if (!season) {
    return html`<button class="btn btn-icon" type="button" disabled aria-label="${label}">${icon(name)}</button>`;
  }
  return html`<a class="btn btn-icon" href="#mua-${season.key}" aria-label="${label}: ${season.name}"
    data-bs-title="${season.name}">${icon(name)}</a>`;
}

function seasonHeader(seasons, index) {
  const season = seasons[index];
  return html`
    <header class="season-header" data-season="${season.family}">
      ${seasonStep(seasons[index - 1], 'prev')}
      <div class="season-header__title">
        ${icon(SEASON_ICONS[season.family], 'season-header__icon')}
        <div>
          <h1 id="season-title" tabindex="-1">${season.name}</h1>
          <p>${season.range}</p>
        </div>
      </div>
      ${seasonStep(seasons[index + 1], 'next')}
    </header>`;
}

function sortMenu(selected) {
  return html`
    <div class="dropdown">
      ${menuButton('sort', 'Sắp xếp')}
      <ul class="dropdown-menu">
        ${SORTS.map((option) => html`
          <li><button class="dropdown-item ${selected === option.value ? 'active' : ''}" type="button"
            data-sort="${option.value}" aria-pressed="${selected === option.value}">
            ${icon(option.icon)}${option.label}
          </button></li>`)}
      </ul>
    </div>`;
}

function emptyResult({ mine, query }) {
  if (query.trim()) {
    return html`
      ${emptyState('search_off', 'Không tìm thấy trong mùa này.')}
      <p class="text-center"><a href="#tim-anime" data-search-all>Tìm trong mọi mùa</a></p>`;
  }
  return mine
    ? emptyState('star', 'Bạn chưa theo dõi phim nào. Bấm ngôi sao trên poster để thêm.')
    : emptyState('filter_list_off', 'Không có anime nào phù hợp.');
}

export function mountSeasonList(root, { catalog, state }) {
  const filters = state.list;
  const index = Math.max(0, catalog.seasons.findIndex((season) => season.key === filters.seasonKey));

  mount(root, html`
    <section aria-labelledby="season-title">
      ${seasonHeader(catalog.seasons, index)}
      <form class="filter-bar" id="list-filters">
        ${languageFilter(filters.language)}
        ${sortMenu(filters.sort)}
        ${mineToggle(filters.mine)}
        <div class="input-group filter-bar__search">
          <span class="input-group-text">${icon('search')}</span>
          <input class="form-control" type="search" id="list-query" placeholder="Tìm trong mùa này…"
            aria-label="Tìm theo tên tiếng Việt, tiếng Anh hoặc Romaji" autocomplete="off"
            enterkeyhint="search" value="${filters.query}">
        </div>
        <p class="visually-hidden" id="result-count" role="status" aria-atomic="true"></p>
      </form>
      <h2 class="visually-hidden">Danh sách anime</h2>
      <ul class="${SHOW_GRID_CLASS}" id="show-grid"></ul>
    </section>`);

  const grid = root.querySelector('#show-grid');
  const form = root.querySelector('#list-filters');
  const count = root.querySelector('#result-count');

  function refresh() {
    const now = Date.now();
    const shows = selectSeasonShows(catalog.shows, filters, now);
    const parts = [`${shows.length} anime`, describeLanguage(filters.language), filters.mine && 'Phim của tôi'];
    count.textContent = parts.filter(Boolean).join(' · ');

    mount(grid, shows.length
      ? html`${showGrid(shows, now, { showCountdown: filters.mine })}`
      : html`<li class="col-12">${emptyResult(filters)}</li>`);
  }

  bindFilters(form, filters, refresh);
  form.querySelector('#list-query').addEventListener('input', ({ target }) => {
    filters.query = target.value;
    refresh();
  });
  grid.addEventListener('click', (event) => {
    if (event.target.closest('[data-search-all]')) state.search.query = filters.query;
  });
  form.addEventListener('click', (event) => {
    const option = event.target.closest('[data-sort]');
    if (!option) return;
    filters.sort = option.dataset.sort;
    form.querySelectorAll('[data-sort]').forEach((item) => {
      const selected = item === option;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', selected);
    });
    refresh();
  });

  refresh();
  return { refresh };
}
