/* Cài web như ứng dụng: nút trong menu, service worker và hướng dẫn cho trình duyệt không có lời mời tự động. */

import { icon } from '../components/common.js';
import { html, mount } from '../lib/html.js';
import { notify } from './feedback.js';

const { Modal } = window.bootstrap;

const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isApple = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const GUIDES = {
  apple: ['Mở a4vf.net bằng Safari.', 'Bấm nút Chia sẻ.', 'Chọn "Thêm vào MH chính", rồi bấm "Thêm".'],
  other: ['Mở menu của trình duyệt (dấu ba chấm).', 'Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".', 'Bấm xác nhận.'],
};

function showGuide() {
  let element = document.querySelector('#install-modal');
  if (!element) {
    element = document.createElement('div');
    element.className = 'modal fade report-modal';
    element.id = 'install-modal';
    element.tabIndex = -1;
    element.setAttribute('aria-labelledby', 'install-title');
    element.setAttribute('aria-hidden', 'true');
    mount(element, html`
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <header class="modal-header">
            <div class="report-heading">
              <h2 class="modal-title" id="install-title">Cài A4VFamily</h2>
              <p>Mở lịch chiếu ngay từ màn hình chính.</p>
            </div>
            <button class="btn btn-icon" type="button" data-bs-dismiss="modal" aria-label="Đóng">${icon('close')}</button>
          </header>
          <div class="modal-body">
            <ol class="install-steps">${GUIDES[isApple() ? 'apple' : 'other'].map((step) => html`<li>${step}</li>`)}</ol>
          </div>
        </div>
      </div>`);
    document.body.append(element);
  }
  Modal.getOrCreateInstance(element).show();
}

export function initInstall() {
  const entry = document.querySelector('[data-install-entry]');
  let prompt = null;

  entry.hidden = isInstalled();

  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event;
  });
  addEventListener('appinstalled', () => {
    prompt = null;
    entry.hidden = true;
    notify(html`Đã cài A4VFamily.`);
  });

  document.querySelector('#install-app').addEventListener('click', async () => {
    if (!prompt) {
      showGuide();
      return;
    }
    const current = prompt;
    prompt = null;
    await current.prompt();
  });

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Không bật được chế độ ứng dụng:', error));
    });
  }
}
