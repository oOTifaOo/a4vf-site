/* "Tier list": người xem xếp hạng anime trong mùa rồi tải hoặc chia sẻ ảnh kết quả. */

import { icon, poster } from '../components/common.js';
import { loadSeasonIfArchived } from '../domain/archive.js';
import { TIERS } from '../config.js';
import { html, mount } from '../lib/html.js';
import { hasVietnameseRelease } from '../lib/paths.js';

const STORAGE_PREFIX = 'a4vf_tier_';
const SEASON_FAMILIES = ['winter', 'spring', 'summer', 'fall'];

function currentSeasonKey(seasons) {
  const now = new Date();
  const key = `${SEASON_FAMILIES[Math.floor(now.getUTCMonth() / 3)]}-${now.getUTCFullYear()}`;
  return seasons.some((season) => season.key === key) ? key : seasons[0].key;
}

function loadBoard(key) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)) ?? {};
  } catch {
    return {};
  }
}

function saveBoard(key, board) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(board));
  } catch {
    // Trình duyệt chặn lưu thì bảng vẫn dùng được đến khi rời trang.
  }
}

const tile = (show, selectedId) => html`
  <div class="tier-tile" role="button" tabindex="0" draggable="true" data-tile="${show.id}" title="${show.title}"
    aria-label="${show.title}" aria-pressed="${show.id === selectedId}">
    ${poster(show, 'poster--fill')}
  </div>`;

export function mountTierList(root, { catalog }) {
  const seasons = [...catalog.seasons].reverse();
  let seasonKey = currentSeasonKey(seasons);
  let board = loadBoard(seasonKey);
  let selectedId = null;

  mount(root, html`
    <h1 class="page-title" tabindex="-1">Tạo tier list anime</h1>
    <p class="tier-intro">Xếp hạng anime trong mùa theo ý bạn, rồi tải ảnh về hoặc chia sẻ với bạn bè.
      Chạm vào một phim rồi chọn hạng, hoặc kéo thả nếu dùng máy tính.</p>
    <form class="tier-controls" id="tier-form">
      <div class="search-filter">
        <label class="form-label" for="tier-season">Mùa</label>
        <select class="form-select" id="tier-season">
          ${seasons.map(({ key, name }) => html`<option value="${key}" ${key === seasonKey ? 'selected' : ''}>${name}</option>`)}
        </select>
      </div>
      <div class="search-filter tier-controls__title">
        <label class="form-label" for="tier-title">Tên bảng</label>
        <input class="form-control" id="tier-title" maxlength="60" autocomplete="off">
      </div>
    </form>
    <div class="tier-board" id="tier-board"></div>
    <div class="tier-actions">
      <button class="btn btn-primary" type="button" id="tier-make">${icon('image')}Tạo ảnh</button>
      <button class="btn btn-outline-secondary" type="button" id="tier-reset">${icon('restart_alt')}Xếp lại</button>
    </div>
    <p class="tier-status" id="tier-status" role="status"></p>
    <div class="tier-result" id="tier-result" hidden>
      <img id="tier-image" alt="Ảnh tier list của bạn">
      <div class="tier-actions">
        <a class="btn btn-primary" id="tier-download">${icon('download')}Tải ảnh</a>
        <button class="btn btn-outline-primary" type="button" id="tier-share" hidden>${icon('share')}Chia sẻ</button>
      </div>
    </div>
    <h2 class="tier-pool-title">Chưa xếp hạng <span id="tier-count"></span></h2>
    <div class="tier-pool" id="tier-pool" data-tier=""></div>
    <div class="tier-picker" id="tier-picker" hidden>
      <span class="tier-picker__name" id="tier-picker-name"></span>
      <div class="tier-picker__buttons">
        ${TIERS.map(({ key, color }) => html`<button type="button" data-pick="${key}" style="--tier-color:${color}" aria-label="Xếp hạng ${key}">${key}</button>`)}
        <button type="button" data-pick="" aria-label="Bỏ xếp hạng">${icon('close')}</button>
      </div>
    </div>`);

  const form = root.querySelector('#tier-form');
  const titleInput = root.querySelector('#tier-title');
  const boardEl = root.querySelector('#tier-board');
  const pool = root.querySelector('#tier-pool');
  const picker = root.querySelector('#tier-picker');
  const status = root.querySelector('#tier-status');
  const result = root.querySelector('#tier-result');

  const seasonName = () => seasons.find(({ key }) => key === seasonKey).name;
  const shows = () => catalog.shows
    .filter((show) => show.season === seasonKey && hasVietnameseRelease(show.filterLanguages, show.nsfw))
    .sort((a, b) => b.popularity - a.popularity);

  function tierShows(key, byId) {
    return (board[key] ?? []).map((id) => byId.get(id)).filter(Boolean);
  }

  function draw() {
    const list = shows();
    const byId = new Map(list.map((show) => [show.id, show]));
    const placed = new Set(TIERS.flatMap(({ key }) => tierShows(key, byId).map((show) => show.id)));
    const rest = list.filter((show) => !placed.has(show.id));
    mount(boardEl, html`${TIERS.map(({ key, color }) => html`
      <div class="tier-row">
        <div class="tier-row__label" style="--tier-color:${color}">${key}</div>
        <div class="tier-row__items" data-tier="${key}">${tierShows(key, byId).map((show) => tile(show, selectedId))}</div>
      </div>`)}`);
    mount(pool, rest.length
      ? html`${rest.map((show) => tile(show, selectedId))}`
      : html`<p class="tier-pool__empty">${list.length ? 'Bạn đã xếp hết phim trong mùa này.' : 'Mùa này chưa có phim bản quyền nào.'}</p>`);
    root.querySelector('#tier-count').textContent = `(${rest.length})`;
    const show = byId.get(selectedId);
    picker.hidden = !show;
    root.querySelector('#tier-picker-name').textContent = show?.title ?? '';
  }

  function place(id, tier, beforeId = null) {
    for (const { key } of TIERS) board[key] = (board[key] ?? []).filter((item) => item !== id);
    if (tier) {
      const items = board[tier];
      const index = items.indexOf(beforeId);
      items.splice(index < 0 ? items.length : index, 0, id);
    }
    selectedId = null;
    saveBoard(seasonKey, board);
    result.hidden = true;
    draw();
  }

  function openSeason(key) {
    seasonKey = key;
    board = loadBoard(key);
    selectedId = null;
    result.hidden = true;
    titleInput.value = board.title ?? `Tier list ${seasonName()}`;
    draw();
    loadSeasonIfArchived(catalog, key).then((added) => {
      if (added && seasonKey === key && root.isConnected) draw();
    });
  }

  form.addEventListener('submit', (event) => event.preventDefault());
  root.querySelector('#tier-season').addEventListener('change', ({ target }) => openSeason(target.value));
  titleInput.addEventListener('input', () => {
    board.title = titleInput.value;
    saveBoard(seasonKey, board);
  });

  root.addEventListener('click', (event) => {
    const pick = event.target.closest('[data-pick]');
    if (pick && selectedId) return place(selectedId, pick.dataset.pick);
    const item = event.target.closest('[data-tile]');
    if (item) {
      const id = Number(item.dataset.tile);
      selectedId = selectedId === id ? null : id;
      return draw();
    }
    const row = event.target.closest('[data-tier]');
    if (row && selectedId) return place(selectedId, row.dataset.tier);
    return undefined;
  });

  root.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-tile]')) {
      event.preventDefault();
      event.target.click();
    }
  });

  root.addEventListener('dragstart', (event) => {
    const item = event.target.closest('[data-tile]');
    if (item) event.dataTransfer.setData('text/plain', item.dataset.tile);
  });
  root.addEventListener('dragover', (event) => {
    if (event.target.closest('[data-tier]')) event.preventDefault();
  });
  root.addEventListener('drop', (event) => {
    const row = event.target.closest('[data-tier]');
    const id = Number(event.dataTransfer.getData('text/plain'));
    if (!row || !id) return;
    event.preventDefault();
    const before = Number(event.target.closest('[data-tile]')?.dataset.tile);
    place(id, row.dataset.tier, before && before !== id ? before : null);
  });

  root.querySelector('#tier-reset').addEventListener('click', () => {
    board = { title: board.title };
    selectedId = null;
    saveBoard(seasonKey, board);
    status.textContent = '';
    result.hidden = true;
    draw();
  });

  root.querySelector('#tier-make').addEventListener('click', async ({ currentTarget: button }) => {
    const byId = new Map(shows().map((show) => [show.id, show]));
    const tiers = TIERS.map((tier) => ({ ...tier, shows: tierShows(tier.key, byId) }));
    if (!tiers.some((tier) => tier.shows.length)) {
      status.textContent = 'Hãy xếp ít nhất một phim trước khi tạo ảnh.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Đang tạo ảnh…';
    try {
      const { renderTierImage } = await import('../ui/tier-image.js');
      const blob = await renderTierImage({ title: titleInput.value.trim() || `Tier list ${seasonName()}`, tiers });
      const url = URL.createObjectURL(blob);
      const fileName = `tier-list-${seasonKey}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const share = root.querySelector('#tier-share');
      const download = root.querySelector('#tier-download');
      root.querySelector('#tier-image').src = url;
      download.href = url;
      download.download = fileName;
      share.hidden = !navigator.canShare?.({ files: [file] });
      share.onclick = () => navigator.share({ files: [file], title: titleInput.value }).catch(() => {});
      result.hidden = false;
      status.textContent = '';
      result.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      console.error(error);
      status.textContent = 'Không tạo được ảnh, hãy thử lại.';
    } finally {
      button.disabled = false;
    }
  });

  openSeason(seasonKey);
  return null;
}
