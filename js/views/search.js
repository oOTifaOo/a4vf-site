/* "Tìm Anime": tìm trong mọi mùa theo tên (có dấu hay không dấu đều được) và thể loại. */

import { emptyState, icon } from '../components/common.js';
import { archiveCard, SHOW_GRID_CLASS, showGrid } from '../components/show-card.js';
import { loadArchiveIndex } from '../domain/archive.js';
import { freeToggle } from '../components/filters.js';
import { PLATFORM_PAGES, SEARCH_LANGUAGES } from '../config.js';
import { allGenres, searchArchive, searchShows } from '../domain/shows.js';
import { html, mount } from '../lib/html.js';

const PAGE_SIZE = 24;
const DEFAULT_LANGUAGE = 'vi';

const selectFilter = (name, label, allLabel, options, selected) => html`
  <div class="search-filter">
    <label class="form-label" for="search-${name}">${label}</label>
    <select class="form-select" id="search-${name}" name="${name}">
      <option value="">${allLabel}</option>
      ${options.map(({ value, label: text }) => html`<option value="${value}" ${value === selected ? 'selected' : ''}>${text}</option>`)}
    </select>
  </div>`;

export function mountSearch(root, { catalog, state }) {
  const filters = state.search;

  mount(root, html`
    <h1 class="visually-hidden" tabindex="-1">Tìm anime Vietsub bản quyền</h1>
    <form class="search-panel" id="search-form" role="search">
      <div class="input-group">
        <span class="input-group-text">${icon('search')}</span>
        <input class="form-control" type="search" id="search-query" placeholder="Tên Việt, Anh hoặc Romaji…"
          aria-label="Tìm theo tên tiếng Việt, tiếng Anh hoặc Romaji" autocomplete="off" enterkeyhint="search" value="${filters.query}">
      </div>
      <div class="search-filters">
        ${selectFilter('genre', 'Thể loại', 'Tất cả thể loại', allGenres(catalog.shows).map((genre) => ({ value: genre, label: genre })), filters.genre)}
        ${selectFilter('platform', 'Nền tảng', 'Tất cả nền tảng', PLATFORM_PAGES.map(({ slug, label }) => ({ value: slug, label })), filters.platform)}
        ${selectFilter('language', 'Bản dịch', 'Tất cả', SEARCH_LANGUAGES, filters.language)}
        <div class="search-filter search-filter--free">
          ${freeToggle(filters.free)}
        </div>
        <button class="btn btn-link search-filters__clear" type="button" id="search-clear" hidden>Xóa lọc</button>
      </div>
      <p class="filter-bar__count" id="result-count" role="status" aria-atomic="true"></p>
    </form>
    <h2 class="visually-hidden">Kết quả</h2>
    <ul class="${SHOW_GRID_CLASS}" id="search-results"></ul>
    <div class="search-more">
      <button class="btn btn-outline-primary" type="button" id="search-more" hidden></button>
    </div>`);

  const form = root.querySelector('#search-form');
  const results = root.querySelector('#search-results');
  const count = root.querySelector('#result-count');
  const clear = root.querySelector('#search-clear');
  const more = root.querySelector('#search-more');
  let archive = [];

  function refresh() {
    const now = Date.now();
    clear.hidden = !(filters.genre || filters.platform || filters.free || filters.language !== DEFAULT_LANGUAGE);
    const knownIds = new Set(catalog.shows.map((show) => show.id));
    let shows = searchShows(catalog.shows, filters, now);
    let older = searchArchive(archive, filters, knownIds);
    // Gõ tên mà bản dịch đang chọn không có thì vẫn hiện phim, ví dụ phim chỉ có lồng tiếng.
    const widened = filters.query && filters.language && !shows.length && !older.length;
    if (widened) {
      const anyLanguage = { ...filters, language: '' };
      shows = searchShows(catalog.shows, anyLanguage, now);
      older = searchArchive(archive, anyLanguage, knownIds);
    }
    const total = shows.length + older.length;
    const visibleOlder = older.slice(0, Math.max(0, filters.limit - shows.length));
    count.textContent = `${total} anime${widened && total ? ' ở bản dịch khác' : ''}`;
    more.hidden = total <= filters.limit;
    more.textContent = `Xem thêm (còn ${total - filters.limit} phim)`;
    mount(results, total
      ? html`${showGrid(shows.slice(0, filters.limit), now)}${visibleOlder.map(archiveCard)}`
      : html`<li class="col-12">${emptyState('search_off', filters.language ? 'Không tìm thấy trong bản dịch này. Hãy thử chọn Bản dịch: Tất cả.' : 'Không tìm thấy anime nào. Hãy thử tên khác.')}</li>`);
  }

  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', ({ target }) => {
    if (target.id === 'search-query') filters.query = target.value;
    if (target.name === 'genre') filters.genre = target.value;
    if (target.name === 'platform') {
      filters.platform = target.value;
      // Nền tảng chủ yếu lồng tiếng: chuyển sang Lồng tiếng để danh sách không bị trống.
      if (PLATFORM_PAGES.find(({ slug }) => slug === target.value)?.dubbed) {
        filters.language = 'dub';
        form.elements.language.value = 'dub';
      }
    }
    if (target.name === 'language') filters.language = target.value;
    if (target.name === 'free') filters.free = target.checked;
    filters.limit = PAGE_SIZE;
    refresh();
  });

  more.addEventListener('click', () => {
    filters.limit += PAGE_SIZE;
    refresh();
  });

  clear.addEventListener('click', () => {
    Object.assign(filters, { genre: '', platform: '', free: false, language: DEFAULT_LANGUAGE, limit: PAGE_SIZE });
    form.elements.genre.value = '';
    form.elements.platform.value = '';
    form.elements.language.value = DEFAULT_LANGUAGE;
    form.elements.free.checked = false;
    refresh();
    form.elements.genre.focus();
  });

  refresh();
  loadArchiveIndex().then((items) => {
    archive = items;
    if (items.length && results.isConnected) refresh();
  });
  return { refresh };
}
