/* Điểm khởi động: đọc dữ liệu rồi nối mỗi đường dẫn #... với một view. */

import { emptyState } from './components/common.js';
import { SITE_NAME } from './config.js';
import { defaultSeason, loadCatalog } from './domain/catalog.js';
import { isFollowing } from './domain/follow.js';
import { mount } from './lib/html.js';
import { initPageActions } from './ui/feedback.js';
import { initImageFallbacks } from './ui/images.js';
import { initThemeToggle } from './ui/theme.js';
import { clearTooltips, initTooltips } from './ui/tooltips.js';
import { mountDetail } from './views/detail.js';
import { mountHome } from './views/home.js';
import { mountSearch } from './views/search.js';
import { mountSeasonList } from './views/season-list.js';

const outlet = document.querySelector('#main');

/** Bộ lọc được giữ khi chuyển trang, nhưng không giữ khi tải lại. */
const state = {
  home: { language: 'vi', mine: false },
  list: { language: 'all', mine: false, sort: 'views', seasonKey: '', query: '' },
  search: { query: '', genre: '' },
};

let catalog;
let activeView = null;
let backHash = '#lich-chieu';
let firstRoute = true;

const context = () => ({ catalog, state });

/** Thêm trang: thêm một dòng ở đây, một file trong js/views và một link trong index.html. */
const ROUTES = [
  {
    pattern: /^#mua-([a-z0-9-]+)$/,
    nav: 'lich-chieu',
    title: 'Danh sách theo mùa',
    render: ([, key]) => {
      if (catalog.seasons.some((season) => season.key === key)) state.list.seasonKey = key;
      return mountSeasonList(outlet, context());
    },
  },
  {
    pattern: /^#(lich-chieu|danh-sach)$/,
    nav: 'lich-chieu',
    title: 'Danh sách theo mùa',
    render: () => mountSeasonList(outlet, context()),
  },
  {
    pattern: /^#phim-cua-toi$/,
    nav: 'lich-chieu',
    title: 'Phim của tôi',
    render: () => {
      state.list.mine = true;
      return mountSeasonList(outlet, context());
    },
  },
  {
    pattern: /^#tim-anime$/,
    nav: 'tim-anime',
    title: 'Tìm Anime',
    focus: '#search-query',
    render: () => mountSearch(outlet, context()),
  },
  {
    pattern: /^#phim-(\d+)$/,
    nav: null,
    render: ([, id]) => mountDetail(outlet, { catalog, showId: Number(id), backHash }),
  },
  {
    pattern: /.*/,
    nav: 'trang-chu',
    title: 'Lịch chiếu',
    render: () => mountHome(outlet, context()),
  },
];

function markActiveNav(nav) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function showRenderError(error) {
  console.error(error);
  mount(outlet, emptyState('error', `Lỗi hiển thị trang: ${error.message}. Hãy chụp màn hình gửi cho người hỗ trợ.`));
}

function route() {
  const { hash } = location;
  const entry = ROUTES.find(({ pattern }) => pattern.test(hash));

  clearTooltips();
  try {
    activeView = entry.render(hash.match(entry.pattern)) ?? null;
  } catch (error) {
    activeView = null;
    showRenderError(error);
    return;
  }

  const pageTitle = activeView?.title ?? entry.title;
  document.title = pageTitle ? `${pageTitle} – ${SITE_NAME}` : SITE_NAME;
  markActiveNav(entry.nav);
  if (entry.nav) backHash = hash || '#trang-chu';

  // Lần tải đầu giữ nguyên; các lần sau đưa focus tới trang mới.
  if (!firstRoute) {
    window.scrollTo(0, 0);
    outlet.querySelector(entry.focus ?? 'h1')?.focus({ preventScroll: true });
  }
  firstRoute = false;
}

function onFollowChange(id) {
  const selector = `[data-follow="${id}"]`;
  const wasFocused = document.activeElement?.matches(selector);

  clearTooltips();
  activeView?.refresh?.();
  document.querySelectorAll(selector).forEach((button) => button.setAttribute('aria-pressed', isFollowing(id)));
  if (wasFocused) document.querySelector(selector)?.focus();
}

async function start() {
  initThemeToggle();
  initTooltips();
  initImageFallbacks();
  initPageActions({ onFollowChange });

  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.error(error);
    mount(outlet, emptyState('cloud_off', 'Không tải được dữ liệu. Hãy tải lại trang.'));
    return;
  }

  state.list.seasonKey = defaultSeason(catalog, Date.now())?.key ?? '';
  addEventListener('hashchange', route);
  route();
}

start();
