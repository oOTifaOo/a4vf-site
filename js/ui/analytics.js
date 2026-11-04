/* Đếm lượt truy cập bằng Google Analytics 4, chỉ gửi lượt xem trang. Chỉ chạy trên website thật,
   nên chạy thử trên máy và bước dựng bản tĩnh không làm sai số liệu. */

import { GA_MEASUREMENT_ID, SITE_URL } from '../config.js';

const enabled = location.hostname === new URL(SITE_URL).hostname;

let lastPath = '';

// gtag cần đúng đối tượng arguments, thay bằng mảng thì Google bỏ qua.
function gtag() {
  window.dataLayer.push(arguments);
}

/** Gọi sau khi trang đã đổi tiêu đề. Cùng một đường dẫn vẽ lại thì không tính thêm lượt xem. */
export function trackPageView() {
  if (!enabled || location.pathname === lastPath) return;
  lastPath = location.pathname;
  gtag('event', 'page_view', { page_title: document.title, page_location: location.href });
}

export function initAnalytics() {
  if (!enabled) return;

  window.dataLayer = window.dataLayer || [];
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // trackPageView gửi lượt xem, kể cả khi đổi trang không tải lại.
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.append(script);
}
