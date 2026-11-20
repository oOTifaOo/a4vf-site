/* Hiệu ứng trang trí nhẹ: sao bùng lên khi theo dõi phim. Tự tắt khi máy bật chế độ giảm chuyển động.
   (Hiệu ứng hoa, lá, tuyết rơi theo mùa đã bỏ vì làm trang chậm.) */

import { isFollowing } from '../domain/follow.js';

const BURST_COLORS = ['#ffc53d', '#ff7ab8', '#7cc2f2', '#6fcf8f'];
const BURST_DOTS = 10;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function burstAt(rect) {
  const burst = document.createElement('span');
  burst.className = 'star-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  for (let i = 0; i < BURST_DOTS; i += 1) {
    const dot = document.createElement('i');
    dot.style.setProperty('--angle', `${(360 / BURST_DOTS) * i}deg`);
    dot.style.background = BURST_COLORS[i % BURST_COLORS.length];
    burst.append(dot);
  }
  document.body.append(burst);
  setTimeout(() => burst.remove(), 700);
}

/** Bắt ở pha capture để lấy vị trí nút trước khi trang vẽ lại, rồi chỉ bùng khi phim vừa được thêm vào theo dõi. */
function initFollowBurst() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-follow]');
    if (!button || reduceMotion.matches) return;
    const id = Number(button.dataset.follow);
    const rect = button.getBoundingClientRect();
    setTimeout(() => {
      if (isFollowing(id)) burstAt(rect);
    });
  }, true);
}

export function initEffects() {
  initFollowBurst();
  // Xoá lựa chọn bật/tắt hiệu ứng mùa cũ còn lưu trong trình duyệt.
  try { localStorage.removeItem('a4vf_season_effect'); } catch { /* bỏ qua */ }
}
