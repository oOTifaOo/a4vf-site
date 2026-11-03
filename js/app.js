/* Điểm khởi động: đọc dữ liệu rồi nối mỗi đường dẫn với một view. */

import { emptyState } from './components/common.js';
import { PLATFORM_PAGES } from './config.js';
import { defaultSeason, loadCatalog } from './domain/catalog.js';
import { isFollowing } from './domain/follow.js';
import { aboutSeo, homeSeo, mineSeo, notFoundSeo, platformSeo, searchSeo, seasonSeo, showSeo } from './domain/seo.js';
import { html, mount } from './lib/html.js';
import { hasVietnameseRelease, legacyHashPath, PATHS, seasonKeyFromSlug, showPath } from './lib/paths.js';
import { initPageActions } from './ui/feedback.js';
import { initImageFallbacks } from './ui/images.js';
import { initReports } from './ui/report.js';
import { applySeo } from './ui/seo.js';
import { initThemeToggle } from './ui/theme.js';
import { clearTooltips, initTooltips } from './ui/tooltips.js';
import { mountAbout } from './views/about.js';
import { mountDetail } from './views/detail.js';
import { mountHome } from './views/home.js';
import { mountPlatform, platformShows } from './views/platform.js';
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
let backPath = PATHS.seasons;
let firstRoute = true;

const context = () => ({ catalog, state });

function currentSeasonSeo() {
  const season = catalog.seasons.find(({ key }) => key === state.list.seasonKey) ?? catalog.seasons[0];
  const shows = catalog.shows.filter((show) => show.season === season.key && !show.nsfw);
  return seasonSeo(season, shows.length, shows.filter((show) => hasVietnameseRelease(show.filterLanguages, show.nsfw)));
}

const platformOf = (slug) => PLATFORM_PAGES.find((platform) => platform.slug === slug);

function mountNotFound() {
  mount(outlet, html`
    <h1 class="visually-hidden" tabindex="-1">Không tìm thấy trang</h1>
    ${emptyState('search_off', 'Trang này không tồn tại hoặc đã được chuyển đi.')}
    <p class="text-center"><a href="${PATHS.home}">Về lịch chiếu hôm nay</a></p>`);
  return null;
}

function renderShow(id) {
  const show = catalog.shows.find((item) => item.id === id);
  // Tên phim đổi thì đường dẫn đổi theo, đường dẫn cũ tự chuyển sang đường dẫn đúng.
  if (show) history.replaceState(null, '', showPath(show.id, show.title));
  return mountDetail(outlet, { catalog, showId: id, backPath });
}

function showPageSeo(id) {
  const show = catalog.shows.find((item) => item.id === id);
  if (!show) return notFoundSeo(location.pathname);
  return showSeo(show, catalog.seasons.find((season) => season.key === show.season));
}

/** Thêm trang: thêm một dòng ở đây, một file trong js/views, một link trong index.html và một đường dẫn trong js/lib/paths.js. */
const ROUTES = [
  {
    pattern: /^\/nen-tang\/([a-z0-9-]+)$/,
    nav: null,
    seo: ([, slug]) => {
      const platform = platformOf(slug);
      return platform ? platformSeo(platform, platformShows(catalog, platform)) : notFoundSeo(location.pathname);
    },
    render: ([, slug]) => (platformOf(slug) ? mountPlatform(outlet, context(), platformOf(slug)) : mountNotFound()),
  },
  {
    pattern: /^\/gioi-thieu$/,
    nav: 'gioi-thieu',
    seo: aboutSeo,
    render: () => mountAbout(outlet),
  },
  {
    pattern: /^\/mua\/([a-z]+-\d{4})$/,
    nav: 'lich-chieu',
    seo: currentSeasonSeo,
    render: ([, slug]) => {
      const key = seasonKeyFromSlug(slug);
      if (catalog.seasons.some((season) => season.key === key)) state.list.seasonKey = key;
      return mountSeasonList(outlet, context());
    },
  },
  {
    pattern: /^\/theo-mua$/,
    nav: 'lich-chieu',
    seo: currentSeasonSeo,
    render: () => mountSeasonList(outlet, context()),
  },
  {
    pattern: /^\/phim-cua-toi$/,
    nav: 'lich-chieu',
    seo: mineSeo,
    render: () => {
      state.list.mine = true;
      return mountSeasonList(outlet, context());
    },
  },
  {
    pattern: /^\/tim-anime$/,
    nav: 'tim-anime',
    focus: '#search-query',
    seo: searchSeo,
    render: () => mountSearch(outlet, context()),
  },
  {
    pattern: /^\/phim\/(\d+)(?:-[a-z0-9-]*)?$/,
    nav: null,
    seo: ([, id]) => showPageSeo(Number(id)),
    render: ([, id]) => renderShow(Number(id)),
  },
  {
    pattern: /^\/(index\.html)?$/,
    nav: 'trang-chu',
    seo: homeSeo,
    render: () => mountHome(outlet, context()),
  },
  {
    pattern: /.*/,
    nav: null,
    seo: () => notFoundSeo(location.pathname),
    render: () => mountNotFound(),
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
  const path = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '') || PATHS.home;
  const entry = ROUTES.find(({ pattern }) => pattern.test(path));
  const match = path.match(entry.pattern);

  clearTooltips();
  try {
    activeView = entry.render(match) ?? null;
    applySeo(entry.seo(match));
  } catch (error) {
    activeView = null;
    showRenderError(error);
    return;
  }

  markActiveNav(entry.nav);
  if (entry.nav) backPath = path;

  // Lần tải đầu giữ nguyên; các lần sau đưa focus tới trang mới.
  if (!firstRoute) {
    window.scrollTo(0, 0);
    outlet.querySelector(entry.focus ?? 'h1')?.focus({ preventScroll: true });
  }
  firstRoute = false;
}

function navigate(path) {
  if (path !== location.pathname) history.pushState(null, '', path);
  route();
}

/** Link nội bộ đổi trang ngay, không tải lại. Ctrl+bấm vẫn mở tab mới như link thường. */
function initInternalLinks() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="/"]:not([href^="//"])');
    if (!link || link.target) return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
  });
}

/** Link dạng #... của bản cũ được đổi sang đường dẫn mới. Trả về true nếu đã đổi. */
function redirectLegacyHash() {
  const path = legacyHashPath(location.hash);
  if (path) history.replaceState(null, '', path);
  return Boolean(path);
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
  initReports({ findShow: (id) => catalog?.shows.find((show) => show.id === id) ?? null });

  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.error(error);
    mount(outlet, emptyState('cloud_off', 'Không tải được dữ liệu. Hãy tải lại trang.'));
    return;
  }

  state.list.seasonKey = defaultSeason(catalog, Date.now())?.key ?? '';
  redirectLegacyHash();
  // Đổi #... trên trang đang mở cũng phát popstate, và phát trước hashchange.
  addEventListener('popstate', () => {
    redirectLegacyHash();
    route();
  });
  addEventListener('hashchange', () => {
    if (redirectLegacyHash()) route();
  });
  initInternalLinks();
  route();
}

start();
