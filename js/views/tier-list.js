/* "Tier List": kéo thả hoặc chạm để xếp phim của một mùa, rồi xuất ảnh và link chia sẻ.
   Bảng lưu riêng theo từng mùa trong trình duyệt. Link chia sẻ mở ở chế độ chỉ xem. */

import { emptyState, icon, poster, sakuraLoader } from '../components/common.js';
import { bindFilters, languageFilter, mineToggle } from '../components/filters.js';
import { SEASON_ICONS } from '../config.js';
import { defaultSeason } from '../domain/catalog.js';
import { selectSeasonShows } from '../domain/shows.js';
import {
  MAX_LABEL_LENGTH,
  MAX_TIERS,
  MAX_TITLE_LENGTH,
  createBoard,
  createTier,
  decodeBoard,
  encodeBoard,
  hasPlacedShows,
  inkOn,
  loadBoard,
  moveShow,
  placedIds,
  removeShow,
  removeTier,
  saveBoard,
  shiftTier,
  tierOfShow,
} from '../domain/tier-list.js';
import { html, mount } from '../lib/html.js';
import { showPath, tierListPath } from '../lib/paths.js';
import { notify } from '../ui/feedback.js';
import { renderTierImage } from '../ui/tier-export.js';
import { bindTierPeek } from '../ui/tier-peek.js';

const SORTABLE_SRC = new URL('../lib/Sortable.min.js', import.meta.url).href;

/** Kéo thả chỉ là thêm: nếu thư viện không tải được, chạm để xếp vẫn hoạt động. */
function loadSortable() {
  if (window.Sortable) return Promise.resolve(window.Sortable);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SORTABLE_SRC;
    script.onload = () => resolve(window.Sortable ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

function seasonStep(season, direction) {
  const name = direction === 'prev' ? 'chevron_left' : 'chevron_right';
  const label = direction === 'prev' ? 'Mùa trước' : 'Mùa sau';
  if (!season) {
    return html`<button class="btn btn-icon" type="button" disabled aria-label="${label}">${icon(name)}</button>`;
  }
  return html`<a class="btn btn-icon" href="${tierListPath(season.key)}" aria-label="${label}: ${season.name}"
    data-bs-title="${season.name}">${icon(name)}</a>`;
}

function tierHeader(seasons, index, { readOnly }) {
  const season = seasons[index];
  return html`
    <header class="season-header" data-season="${season.family}">
      ${readOnly ? '' : seasonStep(seasons[index - 1], 'prev')}
      <div class="season-header__title">
        ${icon(SEASON_ICONS[season.family], 'season-header__icon')}
        <div>
          <h1 id="tier-title" tabindex="-1">Tier List</h1>
          <p>${season.name}</p>
        </div>
      </div>
      ${readOnly ? '' : seasonStep(seasons[index + 1], 'next')}
    </header>`;
}

function tierItem(show, { readOnly, selected }) {
  if (readOnly) {
    return html`<a class="tier-item" href="${showPath(show.id, show.title)}" data-peek="${show.id}">
      ${poster(show, 'poster--fill')}<span class="visually-hidden">${show.title}</span></a>`;
  }
  return html`<button class="tier-item ${selected ? 'is-selected' : ''}" type="button" data-item="${show.id}"
    data-peek="${show.id}" aria-pressed="${String(Boolean(selected))}">
    ${poster(show, 'poster--fill')}<span class="visually-hidden">${show.title}</span></button>`;
}

/** Tên hàng dài thì chữ nhỏ lại để vẫn nằm gọn trong ô. */
function labelSizeClass(label) {
  if (label.length > 10) return 'tier-row__label--tiny';
  return label.length > 3 ? 'tier-row__label--small' : '';
}

function tierRow(tier, showsById, options) {
  const label = tier.label || 'Hàng chưa đặt tên';
  return html`
    <section class="tier-row" aria-label="${label}">
      <h2 class="tier-row__label ${labelSizeClass(tier.label)}" style="background:${tier.color};color:${inkOn(tier.color)}">${options.readOnly
        ? tier.label
        : html`<button class="tier-row__edit" type="button" data-edit-label="${tier.id}" title="Bấm để đổi tên"
            aria-label="Đổi tên hàng ${label}">${tier.label}</button>`}</h2>
      <div class="tier-row__items" data-tier="${tier.id}">
        ${tier.items.map((id) => tierItem(showsById.get(id), { ...options, selected: options.selectedId === id }))}
      </div>
    </section>`;
}

function editorRow(tier, index, count) {
  return html`
    <li class="tier-editor__row" data-editor-tier="${tier.id}">
      <input class="form-control tier-editor__color" type="color" value="${tier.color}" data-tier-color
        aria-label="Màu hàng ${index + 1}">
      <input class="form-control" type="text" value="${tier.label}" maxlength="${MAX_LABEL_LENGTH}" data-tier-label
        aria-label="Tên hàng ${index + 1}" autocomplete="off">
      <button class="btn btn-icon" type="button" data-tier-up aria-label="Đưa hàng lên" ${index === 0 ? 'disabled' : ''}>${icon('arrow_upward')}</button>
      <button class="btn btn-icon" type="button" data-tier-down aria-label="Đưa hàng xuống" ${index === count - 1 ? 'disabled' : ''}>${icon('arrow_downward')}</button>
      <button class="btn btn-icon" type="button" data-tier-remove aria-label="Xoá hàng" ${count === 1 ? 'disabled' : ''}>${icon('delete')}</button>
    </li>`;
}

function shareDialog() {
  return html`
    <dialog class="tier-dialog" id="tier-dialog" aria-labelledby="tier-dialog-title">
      <header class="tier-dialog__head">
        <h2 id="tier-dialog-title">Chia sẻ tier list</h2>
        <button class="btn btn-icon" type="button" data-dialog-close aria-label="Đóng">${icon('close')}</button>
      </header>
      <div class="tier-dialog__body">
        <div class="tier-dialog__preview" id="tier-preview"></div>
        <p class="tier-dialog__status" id="tier-export-status" role="status"></p>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="tier-with-titles">
          <label class="form-check-label" for="tier-with-titles">Kèm tên phim trong ảnh</label>
        </div>
        <div class="tier-actions">
          <a class="btn btn-accent disabled" id="tier-download" aria-disabled="true">${icon('download')}Tải ảnh</a>
          <button class="btn" type="button" id="tier-share-file" hidden disabled>${icon('share')}Chia sẻ ảnh</button>
        </div>
        <p class="tier-dialog__hint">Nếu đang mở trong ứng dụng Facebook hoặc Zalo mà không tải được, hãy nhấn giữ ảnh ở trên để lưu.</p>
        <label class="form-label" for="tier-link">Link xem tier list</label>
        <div class="input-group">
          <input class="form-control" type="text" id="tier-link" readonly>
          <button class="btn" type="button" id="tier-copy-link">${icon('content_copy')}Sao chép</button>
        </div>
      </div>
    </dialog>`;
}

async function copyText(input) {
  try {
    await navigator.clipboard.writeText(input.value);
    return true;
  } catch {
    input.focus();
    input.select();
    return document.execCommand?.('copy') ?? false;
  }
}

/** Hộp thoại chia sẻ, dùng chung cho bảng đang xếp và bảng mở từ link. */
function createShareDialog(root, { getExport, getLink, fileName, withTitles, onWithTitles }) {
  const dialog = root.querySelector('#tier-dialog');
  const preview = dialog.querySelector('#tier-preview');
  const status = dialog.querySelector('#tier-export-status');
  const download = dialog.querySelector('#tier-download');
  const shareFile = dialog.querySelector('#tier-share-file');
  const linkInput = dialog.querySelector('#tier-link');
  const titles = dialog.querySelector('#tier-with-titles');

  let imageUrl = '';
  let imageFile = null;
  let renderId = 0;

  function setReady(ready) {
    download.classList.toggle('disabled', !ready);
    download.setAttribute('aria-disabled', String(!ready));
    shareFile.disabled = !ready;
  }

  function releaseImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = '';
    imageFile = null;
    download.removeAttribute('href');
  }

  async function renderImage() {
    renderId += 1;
    const id = renderId;
    setReady(false);
    releaseImage();
    mount(preview, sakuraLoader('Đang tạo ảnh…'));
    status.textContent = 'Đang tạo ảnh…';

    try {
      const { blob, missing } = await renderTierImage(getExport(titles.checked), (done, total) => {
        if (id === renderId) status.textContent = `Đang tải poster ${done}/${total}…`;
      });
      if (id !== renderId) return;

      imageUrl = URL.createObjectURL(blob);
      imageFile = new File([blob], fileName, { type: 'image/png' });
      download.href = imageUrl;
      download.download = fileName;
      mount(preview, html`<img src="${imageUrl}" alt="Ảnh tier list đã tạo">`);
      status.textContent = missing ? `${missing} poster không tải được nên hiện bằng bìa thay thế.` : '';
      shareFile.hidden = !navigator.canShare?.({ files: [imageFile] });
      setReady(true);
    } catch (error) {
      console.error(error);
      if (id !== renderId) return;
      mount(preview, emptyState('error', 'Không tạo được ảnh. Hãy thử lại.'));
      status.textContent = '';
    }
  }

  dialog.addEventListener('click', async ({ target }) => {
    if (target === dialog || target.closest('[data-dialog-close]')) dialog.close();

    if (target.closest('#tier-copy-link')) {
      status.textContent = (await copyText(linkInput)) ? 'Đã sao chép link.' : 'Hãy tự sao chép link trong ô.';
    }

    if (target.closest('#tier-share-file') && imageFile) {
      try {
        await navigator.share({ files: [imageFile], title: 'Tier List A4VFamily' });
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = 'Không chia sẻ được. Hãy dùng nút Tải ảnh.';
      }
    }
  });

  download.addEventListener('click', (event) => {
    if (!imageUrl) event.preventDefault();
  });

  titles.addEventListener('change', () => {
    onWithTitles(titles.checked);
    renderImage();
  });

  dialog.addEventListener('close', () => {
    renderId += 1;
    releaseImage();
    mount(preview, html``);
  });

  return {
    open() {
      titles.checked = withTitles();
      linkInput.value = getLink();
      dialog.showModal();
      renderImage();
    },
  };
}

function mountShared(root, { catalog, state }, season, seasonIndex, seasonShows, board) {
  const showsById = new Map(seasonShows.map((show) => [show.id, show]));
  const titleText = board.title || `Tier List ${season.name}`;

  mount(root, html`
    <section aria-labelledby="tier-title">
      ${tierHeader(catalog.seasons, seasonIndex, { readOnly: true })}
      <div class="tier-shared">
        <p><strong>${titleText}</strong><br>Đây là tier list được chia sẻ. Bạn có thể xếp bản của riêng mình.</p>
        <div class="tier-actions">
          <a class="btn btn-accent" href="${tierListPath(season.key)}">${icon('edit')}Xếp bản của tôi</a>
          <button class="btn" type="button" id="tier-copy-board">${icon('content_copy')}Sửa từ bản này</button>
          <button class="btn" type="button" id="tier-open-share">${icon('share')}Chia sẻ</button>
        </div>
      </div>
      <div class="tier-board">${board.tiers.map((tier) => tierRow(tier, showsById, { readOnly: true }))}</div>
      ${shareDialog()}
    </section>`);

  bindTierPeek(root.querySelector('section'), showsById);

  const dialog = createShareDialog(root, {
    getExport: (withTitles) => exportData(board, showsById, season, withTitles),
    getLink: () => shareUrl(season, board),
    fileName: `a4vf-tier-list-${season.key}.png`,
    withTitles: () => state.tier.withTitles,
    onWithTitles: (value) => { state.tier.withTitles = value; },
  });

  root.querySelector('#tier-open-share').addEventListener('click', dialog.open);
  root.querySelector('#tier-copy-board').addEventListener('click', () => {
    const own = loadBoard(season.key, new Set(showsById.keys()));
    if (hasPlacedShows(own) && !confirm('Bản bạn đang xếp ở mùa này sẽ bị thay bằng bản được chia sẻ. Tiếp tục?')) return;
    saveBoard(season.key, board);
    location.assign(tierListPath(season.key));
  });

  return null;
}

function shareUrl(season, board) {
  return `${location.origin}${tierListPath(season.key)}#${encodeBoard(board)}`;
}

function exportData(board, showsById, season, withTitles) {
  return {
    title: board.title || 'Tier List của tôi',
    subtitle: season.name,
    withTitles,
    tiers: board.tiers.map((tier) => ({
      label: tier.label,
      color: tier.color,
      ink: inkOn(tier.color),
      shows: tier.items.map((id) => showsById.get(id)),
    })),
  };
}

export function mountTierList(root, { catalog, state }, { seasonKey, shared }) {
  const season = catalog.seasons.find(({ key }) => key === seasonKey) ?? defaultSeason(catalog, Date.now());
  const seasonIndex = catalog.seasons.indexOf(season);
  const seasonShows = catalog.shows.filter((show) => show.season === season.key && !show.nsfw);
  const showsById = new Map(seasonShows.map((show) => [show.id, show]));
  const validIds = new Set(showsById.keys());

  if (shared) {
    const sharedBoard = decodeBoard(shared, validIds);
    if (sharedBoard) return mountShared(root, { catalog, state }, season, seasonIndex, seasonShows, sharedBoard);
    mount(root, html`
      ${emptyState('link_off', 'Link tier list này bị hỏng hoặc không đầy đủ.')}
      <p class="text-center"><a href="${tierListPath(season.key)}">Tự xếp tier list của bạn</a></p>`);
    return null;
  }

  const filters = state.tier;
  // Mùa chưa có phim Vietsub (ví dụ mùa sắp tới) thì mở với toàn bộ phim, không để kho trống.
  const hasVietsub = selectSeasonShows(catalog.shows, {
    seasonKey: season.key, sort: 'views', language: 'vi', mine: false, query: '',
  }, Date.now()).length > 0;
  const language = filters.language ?? (hasVietsub ? 'vi' : 'all');
  const poolFilters = { language, mine: filters.mine };

  const board = loadBoard(season.key, validIds);
  let selectedId = null;
  let lastDragAt = 0;
  let warnedStorage = false;

  mount(root, html`
    <section class="tier-page" aria-labelledby="tier-title">
      ${tierHeader(catalog.seasons, seasonIndex, { readOnly: false })}

      <div class="tier-toolbar">
        <input class="form-control tier-toolbar__title" type="text" id="tier-board-title" maxlength="${MAX_TITLE_LENGTH}"
          placeholder="Tên bảng (không bắt buộc)" aria-label="Tên bảng" autocomplete="off" value="${board.title}">
        <div class="tier-actions">
          <button class="btn btn-accent" type="button" id="tier-open-share">${icon('share')}Xuất ảnh và chia sẻ</button>
          <button class="btn btn-icon" type="button" id="tier-toggle-editor" aria-expanded="false" aria-controls="tier-editor"
            aria-label="Sửa hàng" data-bs-title="Sửa hàng">${icon('tune')}</button>
          <button class="btn btn-icon" type="button" id="tier-reset" aria-label="Xếp lại từ đầu" data-bs-title="Xếp lại từ đầu">${icon('restart_alt')}</button>
        </div>
      </div>

      <div class="tier-editor" id="tier-editor" hidden>
        <ul class="tier-editor__list list-unstyled" id="tier-editor-list"></ul>
        <button class="btn" type="button" id="tier-add-row">${icon('add')}Thêm hàng</button>
      </div>

      <form class="filter-bar" id="tier-filters">
        ${languageFilter(language)}
        ${mineToggle(filters.mine)}
        <div class="input-group filter-bar__search">
          <span class="input-group-text">${icon('search')}</span>
          <input class="form-control" type="search" id="tier-query" placeholder="Tìm phim trong kho…" aria-label="Tìm trong kho phim"
            autocomplete="off" enterkeyhint="search" value="${filters.query}">
        </div>
      </form>

      <div class="tier-layout">
        <div class="tier-board" id="tier-board"></div>

        <aside class="tier-pool" aria-label="Kho phim">
          <div class="tier-pool__picker" id="tier-picker" aria-live="polite"></div>
          <div class="tier-pool__items" id="tier-pool" data-pool></div>
        </aside>
      </div>

      ${shareDialog()}
    </section>`);

  const boardEl = root.querySelector('#tier-board');
  const poolEl = root.querySelector('#tier-pool');
  const pickerEl = root.querySelector('#tier-picker');
  const editor = root.querySelector('#tier-editor');
  const editorList = root.querySelector('#tier-editor-list');

  const peek = bindTierPeek(root.querySelector('.tier-page'), showsById);
  let sortables = [];
  let Sortable = null;

  function persist() {
    if (!saveBoard(season.key, board) && !warnedStorage) {
      warnedStorage = true;
      notify(html`Trình duyệt không cho lưu, bảng sẽ mất khi tải lại trang.`);
    }
  }

  function poolShows() {
    const placed = placedIds(board);
    const list = selectSeasonShows(catalog.shows, {
      seasonKey: season.key, sort: 'views', language: poolFilters.language, mine: poolFilters.mine, query: filters.query,
    }, Date.now());
    return list.filter((show) => !placed.has(show.id));
  }

  function renderPool() {
    const { scrollLeft, scrollTop } = poolEl;
    const shows = poolShows();
    mount(poolEl, shows.length
      ? html`${shows.map((show) => tierItem(show, { readOnly: false, selected: selectedId === show.id }))}`
      : html`<p class="tier-pool__empty">${placedIds(board).size ? 'Không còn phim nào trong bộ lọc này.' : 'Không có phim phù hợp.'}</p>`);
    poolEl.scrollLeft = scrollLeft;
    poolEl.scrollTop = scrollTop;
  }

  function renderPicker() {
    if (!selectedId) {
      mount(pickerEl, html`<p class="tier-picker__hint">${icon('touch_app')}Chọn một poster rồi chọn hàng, hoặc kéo thả vào bảng. Bấm vào tên hàng để đổi tên.</p>`);
      return;
    }
    const show = showsById.get(selectedId);
    const placed = tierOfShow(board, selectedId);
    mount(pickerEl, html`
      <p class="tier-picker__title" title="${show.title}">${show.title}</p>
      <div class="tier-picker__tiers">
        ${board.tiers.map((tier) => html`
          <button class="tier-picker__tier" type="button" data-place="${tier.id}"
            style="background:${tier.color};color:${inkOn(tier.color)}"
            aria-label="Xếp vào hàng ${tier.label || 'chưa đặt tên'}">${tier.label || '–'}</button>`)}
        ${placed ? html`<button class="btn btn-icon" type="button" data-unplace aria-label="Trả về kho" data-bs-title="Trả về kho">${icon('undo')}</button>` : ''}
        <button class="btn btn-icon" type="button" data-deselect aria-label="Bỏ chọn">${icon('close')}</button>
      </div>`);
  }

  function renderBoard() {
    mount(boardEl, html`${board.tiers.map((tier) => tierRow(tier, showsById, { readOnly: false, selectedId }))}`);
    bindSortables();
  }

  function renderEditor() {
    mount(editorList, html`${board.tiers.map((tier, index) => editorRow(tier, index, board.tiers.length))}`);
    root.querySelector('#tier-add-row').disabled = board.tiers.length >= MAX_TIERS;
  }

  function renderAll() {
    renderBoard();
    renderPool();
    renderPicker();
    if (!editor.hidden) renderEditor();
  }

  function select(id) {
    selectedId = id;
    root.querySelectorAll('.tier-item.is-selected').forEach((item) => {
      item.classList.remove('is-selected');
      item.setAttribute('aria-pressed', 'false');
    });
    if (id) {
      const element = root.querySelector(`[data-item="${id}"]`);
      element?.classList.add('is-selected');
      element?.setAttribute('aria-pressed', 'true');
      if (element?.closest('[data-pool]')) element.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    root.querySelector('.tier-page').classList.toggle('has-selection', Boolean(id));
    renderPicker();
  }

  /** Xếp xong phim từ kho thì tự chọn phim kế tiếp, để xếp cả mùa chỉ bằng vài lần chạm. */
  function place(id, tierId, beforeId = null) {
    const fromPool = !tierOfShow(board, id);
    const poolIds = fromPool ? poolShows().map((show) => show.id) : [];
    const nextId = poolIds[poolIds.indexOf(id) + 1] ?? null;

    moveShow(board, id, tierId, beforeId);
    persist();
    const keepSelected = fromPool ? nextId : null;
    selectedId = keepSelected;
    renderBoard();
    renderPool();
    select(keepSelected);
  }

  function bindSortables() {
    sortables.forEach((sortable) => sortable.destroy());
    sortables = [];
    if (!Sortable) return;

    const options = {
      group: 'tier',
      animation: 120,
      draggable: '.tier-item',
      forceFallback: true,
      fallbackTolerance: 4,
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      scrollSensitivity: 70,
      scrollSpeed: 14,
      ghostClass: 'tier-item--ghost',
      chosenClass: 'tier-item--chosen',
      dragClass: 'tier-item--drag',
      onChoose: peek.pause,
      onUnchoose: peek.resume,
      onEnd({ item, to, from }) {
        lastDragAt = Date.now();
        if (to === from && to.dataset.pool !== undefined) return;

        const id = Number(item.dataset.item);
        if (to.dataset.tier) {
          const next = item.nextElementSibling?.dataset.item;
          moveShow(board, id, to.dataset.tier, next ? Number(next) : null);
        } else {
          removeShow(board, id);
        }
        persist();
        if (selectedId === id) selectedId = null;
        renderPool();
        select(selectedId);
      },
    };

    boardEl.querySelectorAll('[data-tier]').forEach((row) => sortables.push(new Sortable(row, options)));
    sortables.push(new Sortable(poolEl, { ...options, sort: false }));
  }

  function editLabel(button) {
    const tier = board.tiers.find(({ id }) => id === button.dataset.editLabel);
    const input = document.createElement('input');
    Object.assign(input, {
      type: 'text', value: tier.label, maxLength: MAX_LABEL_LENGTH, className: 'tier-row__input', autocomplete: 'off',
    });
    input.setAttribute('aria-label', button.getAttribute('aria-label'));

    let finished = false;
    function finish(save, refocus) {
      if (finished) return;
      finished = true;
      if (save) {
        tier.label = input.value.trim();
        persist();
      }
      renderBoard();
      renderPicker();
      if (!editor.hidden) renderEditor();
      if (refocus) boardEl.querySelector(`[data-edit-label="${tier.id}"]`)?.focus();
    }

    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      event.preventDefault();
      finish(event.key === 'Enter', true);
    });
    input.addEventListener('blur', () => finish(true, false));
    button.replaceWith(input);
    input.select();
  }

  root.addEventListener('click', ({ target }) => {
    if (Date.now() - lastDragAt < 250 || target.closest('#tier-dialog')) return;

    const labelButton = target.closest('[data-edit-label]');
    if (labelButton) {
      editLabel(labelButton);
      return;
    }

    const tierButton = target.closest('[data-place]');
    if (tierButton) {
      place(selectedId, tierButton.dataset.place);
      return;
    }

    if (target.closest('[data-unplace]')) {
      removeShow(board, selectedId);
      persist();
      selectedId = null;
      renderBoard();
      renderPool();
      select(null);
      return;
    }

    if (target.closest('[data-deselect]')) {
      select(null);
      return;
    }

    const item = target.closest('[data-item]');
    if (item) {
      const id = Number(item.dataset.item);
      const row = item.closest('[data-tier]');
      if (selectedId === id) select(null);
      else if (selectedId && row) place(selectedId, row.dataset.tier, id);
      else select(id);
      return;
    }

    const emptyArea = target.closest('[data-tier]');
    if (emptyArea && selectedId) place(selectedId, emptyArea.dataset.tier);
  });

  const filterForm = root.querySelector('#tier-filters');
  bindFilters(filterForm, poolFilters, () => {
    filters.language = poolFilters.language;
    filters.mine = poolFilters.mine;
    if (selectedId && !tierOfShow(board, selectedId)) selectedId = null;
    renderPool();
    select(selectedId);
  });

  root.querySelector('#tier-query').addEventListener('input', ({ target }) => {
    filters.query = target.value;
    renderPool();
  });

  root.querySelector('#tier-board-title').addEventListener('input', ({ target }) => {
    board.title = target.value;
    persist();
  });

  root.querySelector('#tier-toggle-editor').addEventListener('click', ({ currentTarget }) => {
    editor.hidden = !editor.hidden;
    currentTarget.setAttribute('aria-expanded', String(!editor.hidden));
    if (!editor.hidden) renderEditor();
  });

  root.querySelector('#tier-add-row').addEventListener('click', () => {
    if (board.tiers.length >= MAX_TIERS) return;
    board.tiers.push(createTier('Mới'));
    persist();
    renderAll();
  });

  root.querySelector('#tier-reset').addEventListener('click', () => {
    if (!confirm('Xoá toàn bộ cách xếp của mùa này và trả mọi phim về kho?')) return;
    const fresh = createBoard();
    board.tiers = fresh.tiers;
    board.title = '';
    root.querySelector('#tier-board-title').value = '';
    selectedId = null;
    persist();
    renderAll();
    select(null);
  });

  editor.addEventListener('input', ({ target }) => {
    const tier = board.tiers.find(({ id }) => id === target.closest('[data-editor-tier]')?.dataset.editorTier);
    if (!tier) return;
    if (target.matches('[data-tier-label]')) tier.label = target.value;
    else if (target.matches('[data-tier-color]')) tier.color = target.value;
    else return;
    persist();
    renderBoard();
    renderPicker();
  });

  editor.addEventListener('click', ({ target }) => {
    const button = target.closest('button');
    const tierId = target.closest('[data-editor-tier]')?.dataset.editorTier;
    if (!button || !tierId) return;

    if (button.matches('[data-tier-up]')) shiftTier(board, tierId, -1);
    else if (button.matches('[data-tier-down]')) shiftTier(board, tierId, 1);
    else if (button.matches('[data-tier-remove]')) {
      const tier = board.tiers.find(({ id }) => id === tierId);
      if (tier.items.length && !confirm(`Xoá hàng "${tier.label}"? Các phim trong hàng sẽ trở về kho.`)) return;
      removeTier(board, tierId);
    } else return;

    persist();
    renderAll();
  });

  const dialog = createShareDialog(root, {
    getExport: (withTitles) => exportData(board, showsById, season, withTitles),
    getLink: () => shareUrl(season, board),
    fileName: `a4vf-tier-list-${season.key}.png`,
    withTitles: () => filters.withTitles,
    onWithTitles: (value) => { filters.withTitles = value; },
  });

  root.querySelector('#tier-open-share').addEventListener('click', () => {
    if (!hasPlacedShows(board)) {
      notify(html`Hãy xếp ít nhất một phim trước khi xuất ảnh.`);
      return;
    }
    dialog.open();
  });

  renderAll();

  loadSortable().then((library) => {
    // Người xem có thể đã rời trang trong lúc tải thư viện.
    if (!library || !boardEl.isConnected) return;
    Sortable = library;
    bindSortables();
  });

  return { refresh: renderPool };
}
