/* Trang 404 có linh vật, dùng chung cho đường dẫn sai và phim không tồn tại. */

import { html } from '../lib/html.js';
import { PATHS } from '../lib/paths.js';
import { icon } from './common.js';

export const notFoundPage = (title = 'Ối, lạc đường mất rồi!', text = 'Trang bạn tìm không tồn tại hoặc đã được chuyển đi. Để mình dẫn bạn về lịch chiếu nhé.') => html`
  <section class="not-found">
    <div class="not-found__art" aria-hidden="true">
      <span class="not-found__code">404</span>
      <img class="not-found__mascot" src="/images/linh-vat-404.webp" width="389" height="640" alt="">
    </div>
    <div class="not-found__body">
      <h1 tabindex="-1">${title}</h1>
      <p>${text}</p>
      <div class="not-found__actions">
        <a class="btn btn-primary" href="${PATHS.home}">${icon('calendar_month')}Về lịch chiếu</a>
        <a class="btn btn-outline-secondary" href="${PATHS.search}">${icon('search')}Tìm anime</a>
      </div>
    </div>
  </section>`;
