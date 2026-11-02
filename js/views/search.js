/* "Tìm Anime": tìm trong mọi mùa theo tên (có dấu hay không dấu đều được) và thể loại. */

import { emptyState, icon } from '../components/common.js';
import { SHOW_GRID_CLASS, showGrid } from '../components/show-card.js';
import { allGenres, searchShows } from '../domain/shows.js';
import { html, mount } from '../lib/html.js';

const genreOption = (genre, id, checked) => html`
  <input class="btn-check" type="radio" name="genre" id="genre-${id}" value="${genre}"
    autocomplete="off" ${checked ? 'checked' : ''}>
  <label class="btn btn-sm genre-chip" for="genre-${id}">${genre || 'Tất cả'}</label>`;

export function mountSearch(root, { catalog, state }) {
  const filters = state.search;

  mount(root, html`
    <h1 class="visually-hidden" tabindex="-1">Tìm Anime</h1>
    <form class="search-panel" id="search-form" role="search">
      <div class="input-group">
        <span class="input-group-text">${icon('search')}</span>
        <input class="form-control" type="search" id="search-query" placeholder="Tên Việt, Anh hoặc Romaji…"
          aria-label="Tìm theo tên tiếng Việt, tiếng Anh hoặc Romaji" autocomplete="off" enterkeyhint="search" value="${filters.query}">
      </div>
      <fieldset class="genre-list">
        <legend class="visually-hidden">Thể loại</legend>
        ${genreOption('', 'all', !filters.genre)}
        ${allGenres(catalog.shows).map((genre, i) => genreOption(genre, i, filters.genre === genre))}
      </fieldset>
      <p class="filter-bar__count" id="result-count" role="status" aria-atomic="true"></p>
    </form>
    <h2 class="visually-hidden">Kết quả</h2>
    <ul class="${SHOW_GRID_CLASS}" id="search-results"></ul>`);

  const form = root.querySelector('#search-form');
  const results = root.querySelector('#search-results');
  const count = root.querySelector('#result-count');

  function refresh() {
    const now = Date.now();
    const shows = searchShows(catalog.shows, filters, now);
    count.textContent = `${shows.length} anime`;
    mount(results, shows.length
      ? html`${showGrid(shows, now)}`
      : html`<li class="col-12">${emptyState('search_off', 'Không tìm thấy anime nào. Hãy thử tên khác.')}</li>`);
  }

  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', ({ target }) => {
    if (target.id === 'search-query') filters.query = target.value;
    if (target.name === 'genre') filters.genre = target.value;
    refresh();
  });

  refresh();
  return { refresh };
}
