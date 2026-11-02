/* Thông báo nhanh (toast) và các thao tác toàn trang dùng chúng. */

import { toggleFollow } from '../domain/follow.js';
import { html, mount } from '../lib/html.js';

const { Toast } = window.bootstrap;

export function notify(template) {
  const toast = document.querySelector('#app-toast');
  mount(toast.querySelector('.toast-body'), template);
  Toast.getOrCreateInstance(toast).show();
  return toast;
}

function handleFollow(button, onFollowChange) {
  const id = Number(button.dataset.follow);
  const saved = toggleFollow(id);
  onFollowChange(id);
  if (!saved) notify(html`Trình duyệt không cho lưu danh sách, nên sẽ mất khi tải lại trang.`);
}

export function initPageActions({ onFollowChange }) {
  document.addEventListener('click', (event) => {
    const follow = event.target.closest('[data-follow]');
    if (follow) {
      event.preventDefault();
      handleFollow(follow, onFollowChange);
      return;
    }

    if (event.target.closest('[data-no-link]')) {
      event.preventDefault();
      notify(html`Chưa có link xem`);
    }

    if (event.target.closest('[aria-disabled="true"]')) event.preventDefault();

    if (event.target.closest('[data-skip-link]')) {
      event.preventDefault();
      document.querySelector('#main').focus();
    }
  });
}
