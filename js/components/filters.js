/* Bộ lọc dùng chung cho Lịch chiếu và Danh sách theo mùa. */

import { LANGUAGES } from '../config.js';
import { html } from '../lib/html.js';
import { icon } from './common.js';

export function languageFilter(selected) {
  return html`
    <fieldset class="btn-group">
      <legend class="visually-hidden">Phụ đề</legend>
      ${LANGUAGES.map((option) => html`
        <input class="btn-check" type="radio" name="language" id="language-${option.value}" value="${option.value}"
          autocomplete="off" ${selected === option.value ? 'checked' : ''}>
        <label class="btn filter-chip" for="language-${option.value}">${icon(option.icon)}${option.label}</label>`)}
    </fieldset>`;
}

export function freeToggle(checked) {
  return html`
    <input class="btn-check" type="checkbox" name="free" id="filter-free" autocomplete="off" ${checked ? 'checked' : ''}>
    <label class="btn filter-chip" for="filter-free">${icon('money_off')}Free</label>`;
}

export function mineToggle(checked) {
  return html`
    <input class="btn-check" type="checkbox" name="mine" id="filter-mine" autocomplete="off" ${checked ? 'checked' : ''}>
    <label class="btn btn-icon btn-icon--star" for="filter-mine" data-bs-title="Phim của tôi">
      ${icon('star')}<span class="visually-hidden">Phim của tôi</span>
    </label>`;
}

/** Nối form lọc với state; gọi onChange sau mỗi lần đổi. */
export function bindFilters(form, filters, onChange) {
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('change', ({ target }) => {
    if (target.name === 'language') filters.language = target.value;
    else if (target.name === 'free') filters.free = target.checked;
    else if (target.name === 'mine') filters.mine = target.checked;
    else return; // Ô tìm tự xử lý; vẽ lại ở đây sẽ làm mất link người xem vừa bấm.
    onChange();
  });
}

export function describeLanguage(value) {
  return value === 'all' ? '' : LANGUAGES.find((option) => option.value === value).label;
}
