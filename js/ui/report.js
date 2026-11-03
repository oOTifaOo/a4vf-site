/* Báo lỗi từng phim và Hòm thư góp ý: một cửa sổ chung, gửi tới Apps Script để ghi vào spreadsheet. */

import { icon } from '../components/common.js';
import { CONTACT_EMAIL, REPORT_ENDPOINT, REPORT_FORMS } from '../config.js';
import { html, mount } from '../lib/html.js';
import { notify } from './feedback.js';

const { Modal } = window.bootstrap;

const NOTE_LIMIT = 500;
const SEND_TIMEOUT_MS = 20000;

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

/** Chưa có đường dẫn thì web thật ẩn nút, máy local vẫn mở được để xem thử giao diện. */
export const reportEnabled = Boolean(REPORT_ENDPOINT) || isLocal;

export const reportButton = (show) => (reportEnabled ? html`
  <button class="btn btn-icon" type="button" data-report="${show.id}"
    aria-label="Báo lỗi phim ${show.title}" data-bs-title="Báo lỗi">${icon('flag')}</button>` : '');

const allPlatforms = (show) => [...new Set([...show.platforms, ...show.otherPlatforms].map(({ name }) => name))];

const typeOption = (type) => html`
  <input class="btn-check" type="radio" name="type" id="report-${type.value}" value="${type.value}">
  <label class="btn report-type" for="report-${type.value}">${type.label}</label>`;

function platformField(show) {
  if (!show) {
    return html`
      <label class="form-label" for="report-platform">Nền tảng <small>(nếu có)</small></label>
      <input class="form-control" id="report-platform" name="platform" maxlength="60" autocomplete="off">`;
  }
  const names = allPlatforms(show);
  if (names.length < 2) return html`<input type="hidden" name="platform" value="${names[0] ?? ''}">`;
  return html`
    <label class="form-label" for="report-platform">Nền tảng</label>
    <select class="form-select" id="report-platform" name="platform">
      <option value="">Không rõ hoặc tất cả</option>
      ${names.map((name) => html`<option>${name}</option>`)}
    </select>`;
}

function formTemplate(form, show) {
  return html`
    <form class="modal-content" novalidate>
      <header class="modal-header">
        <div class="report-heading">
          <h2 class="modal-title" id="report-title">${form.title}</h2>
          <p>${show ? show.title : form.intro}</p>
        </div>
        <button class="btn btn-icon" type="button" data-bs-dismiss="modal" aria-label="Đóng">${icon('close')}</button>
      </header>
      <div class="modal-body">
        <fieldset>
          <legend class="form-label">${form.question}</legend>
          <div class="report-types">${form.types.map(typeOption)}</div>
        </fieldset>
        <div data-field="anime" hidden>
          <label class="form-label" for="report-anime">Tên anime</label>
          <input class="form-control" id="report-anime" name="anime" maxlength="120" autocomplete="off">
        </div>
        <div class="report-row">
          <div data-field="episode" hidden>
            <label class="form-label" for="report-episode">Tập <small>(nếu có)</small></label>
            <input class="form-control" id="report-episode" name="episode" inputmode="numeric" maxlength="4" autocomplete="off">
          </div>
          <div data-field="platform" hidden>${platformField(show)}</div>
        </div>
        <div>
          <label class="form-label" for="report-note"><span data-note-label>Ghi chú</span></label>
          <textarea class="form-control" id="report-note" name="note" rows="3" maxlength="${NOTE_LIMIT}"></textarea>
        </div>
        <div class="report-trap" aria-hidden="true">
          <label>Website<input name="website" tabindex="-1" autocomplete="off"></label>
        </div>
        <p class="report-error" role="alert" hidden></p>
      </div>
      <footer class="modal-footer">
        <button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Hủy</button>
        <button class="btn btn-primary" type="submit">Gửi</button>
      </footer>
    </form>`;
}

/** Hiện đúng các ô mà loại đã chọn cần. */
function syncFields(root, type) {
  const fields = type?.fields ?? [];
  root.querySelectorAll('[data-field]').forEach((field) => {
    const needed = fields.includes(field.dataset.field);
    // Phim chỉ có một nền tảng thì ô nền tảng là ô ẩn, không cần chừa chỗ.
    field.hidden = !needed || Boolean(field.querySelector('input[type="hidden"]'));
  });
  root.querySelector('.report-row').hidden = !root.querySelector('.report-row > :not([hidden])');
  const label = root.querySelector('[data-note-label]');
  label.textContent = type?.noteRequired ? 'Nội dung' : 'Ghi chú (không bắt buộc)';
  root.querySelector('#report-note').placeholder = type?.placeholder ?? '';
}

function validate(data, type) {
  if (!type) return { message: 'Bạn hãy chọn một mục ở trên.', focus: 'input[name="type"]' };
  if (type.animeRequired && !data.anime) return { message: 'Bạn hãy nhập tên anime.', focus: '#report-anime' };
  if (data.episode && !/^\d{1,4}$/.test(data.episode)) return { message: 'Số tập chỉ gồm chữ số.', focus: '#report-episode' };
  if (type.noteRequired && !data.note) return { message: 'Bạn hãy nhập nội dung.', focus: '#report-note' };
  return null;
}

async function send(payload) {
  if (!REPORT_ENDPOINT) {
    console.info('Báo lỗi (bản demo, chưa gửi):', payload);
    return 'demo';
  }
  // Dùng text/plain để trình duyệt không gửi yêu cầu CORS preflight, Apps Script không trả lời được loại đó.
  const response = await fetch(REPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'failed');
  return 'sent';
}

const failureMessage = (error) => (error.message === 'busy'
  ? 'Hòm thư đang nhận quá nhiều tin. Bạn thử lại sau ít phút nhé.'
  : `Chưa gửi được. Bạn thử lại, hoặc email tới ${CONTACT_EMAIL}.`);

function collect(root, form, show) {
  const values = Object.fromEntries(new FormData(root));
  const type = form.types.find(({ value }) => value === values.type);
  const fields = type?.fields ?? [];
  const pick = (name) => (fields.includes(name) ? String(values[name] ?? '').trim() : '');
  return {
    type,
    data: {
      source: form.source,
      type: values.type ?? '',
      showId: show?.id ?? '',
      title: show?.title ?? pick('anime'),
      anime: pick('anime'),
      episode: pick('episode'),
      platform: pick('platform'),
      note: String(values.note ?? '').trim(),
      path: location.pathname,
      website: values.website ?? '',
    },
  };
}

function bindForm(root, form, show, modal) {
  const error = root.querySelector('.report-error');
  const submit = root.querySelector('[type="submit"]');
  const showError = (message) => {
    error.textContent = message;
    error.hidden = false;
  };

  root.addEventListener('change', (event) => {
    if (event.target.name !== 'type') return;
    error.hidden = true;
    syncFields(root, form.types.find(({ value }) => value === event.target.value));
  });

  root.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    const { type, data } = collect(root, form, show);
    const problem = validate(data, type);
    if (problem) {
      showError(problem.message);
      root.querySelector(problem.focus)?.focus();
      return;
    }

    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Đang gửi…';
    try {
      const outcome = await send(data);
      modal.hide();
      notify(outcome === 'demo' ? html`Bản demo: chưa gửi thật.` : html`Đã gửi. Cảm ơn bạn!`);
    } catch (failure) {
      console.error(failure);
      showError(failureMessage(failure));
      submit.disabled = false;
      submit.textContent = 'Gửi lại';
    }
  });
}

function shell() {
  const element = document.createElement('div');
  element.className = 'modal fade report-modal';
  element.id = 'report-modal';
  element.tabIndex = -1;
  element.setAttribute('aria-labelledby', 'report-title');
  element.setAttribute('aria-hidden', 'true');
  mount(element, html`<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"></div>`);
  document.body.append(element);
  return element;
}

function openForm(trigger, show) {
  const element = document.querySelector('#report-modal') ?? shell();
  const form = show ? REPORT_FORMS.show : REPORT_FORMS.site;
  const dialog = element.querySelector('.modal-dialog');
  mount(dialog, formTemplate(form, show));
  const root = dialog.querySelector('form');
  const modal = Modal.getOrCreateInstance(element);
  syncFields(root, null);
  bindForm(root, form, show, modal);
  // Mục trong menu đã đóng thì không nhận focus, nên trả focus về nút mở menu.
  const focusTarget = trigger.closest('.dropdown')?.querySelector('[data-bs-toggle]') ?? trigger;
  element.addEventListener('hidden.bs.modal', () => {
    if (focusTarget.isConnected) focusTarget.focus();
  }, { once: true });
  modal.show();
}

export function initReports({ findShow }) {
  document.querySelectorAll('[data-report-entry]').forEach((entry) => {
    entry.hidden = !reportEnabled;
  });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-report]');
    if (!trigger) return;
    const { report } = trigger.dataset;
    openForm(trigger, report === 'site' ? null : findShow(Number(report)));
  });
}
