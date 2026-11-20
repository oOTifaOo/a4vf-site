/* "Lịch chiếu": các tập trong hôm nay và lịch cả tuần. */

import { emptyState, followButton, icon, poster } from '../components/common.js';
import { bindFilters, freeToggle, languageFilter, mineToggle } from '../components/filters.js';
import { platformMarks } from '../components/platform-logo.js';
import { WEEKDAYS_SHORT } from '../config.js';
import { loadArchivedShow } from '../domain/archive.js';
import { isFollowing } from '../domain/follow.js';
import { clearProgress, recentProgressIds, selectContinueWatching } from '../domain/progress.js';
import { episodeNumber, selectScheduleEpisodes, selectTodayEpisodes } from '../domain/shows.js';
import { html, mount } from '../lib/html.js';
import { showPath } from '../lib/paths.js';
import { DAY_MS, formatCountdown, formatDayLabel, formatShortDateTime, formatTime, todayStart, toIso, weekdayOf, weekStart } from '../lib/time.js';
import { clearTooltips } from '../ui/tooltips.js';

const CONTINUE_LIMIT = 12;

const followMark = (show) => (isFollowing(show.id) ? icon('star', 'follow-mark') : '');

function todayBadge(time, now) {
  if (time <= now) return html`<span class="poster-card__badge">Đã chiếu</span>`;
  return html`<time class="poster-card__badge poster-card__badge--countdown" datetime="${toIso(time)}"
    data-countdown-to="${time}">${formatCountdown(time - now)}</time>`;
}

/** `eager`: vài thẻ đầu nằm ngay màn hình đầu tiên nên tải ảnh ngay, không đợi cuộn. */
function todayCard({ show, time, episode }, now, eager = false) {
  const platform = show.platforms[0];
  return html`
    <li class="poster-card">
      ${followButton(show)}
      <span class="poster-card__cover">
        ${poster(show, 'poster--fill', { eager })}
        ${todayBadge(time, now)}
      </span>
      <a class="poster-card__title stretched-link" href="${showPath(show.id, show.title)}" title="${show.title}">${show.title}</a>
      <span class="poster-card__meta">${formatTime(time)} · Tập ${episodeNumber(platform, episode)}/${episodeNumber(platform, show.episodes)}</span>
    </li>`;
}

function continueCard({ show, platform, next, nextTime, available, isNew }) {
  const number = episodeNumber(platform, next);
  const label = `Bỏ ${show.title} khỏi Tiếp tục xem`;
  return html`
    <li class="poster-card">
      <button class="follow-btn" type="button" data-clear-progress="${show.id}" aria-label="${label}"
        data-bs-title="Bỏ khỏi danh sách">${icon('close')}</button>
      <span class="poster-card__cover">
        ${poster(show, 'poster--fill')}
        ${isNew ? html`<span class="poster-card__badge poster-card__badge--new">Có tập mới</span>` : ''}
      </span>
      <a class="poster-card__title stretched-link" href="${showPath(show.id, show.title)}" title="${show.title}">${show.title}</a>
      <span class="poster-card__meta">${available ? `Xem tiếp tập ${number}` : `Tập ${number}: ${formatShortDateTime(nextTime)}`}</span>
    </li>`;
}

function dayItem({ show, episode, time }) {
  return html`
    <li>
      <a class="week-item" href="${showPath(show.id, show.title)}" title="${show.title}">
        ${poster(show, 'poster--week')}
        <span class="week-item__body">
          <span class="week-item__meta">
            <time datetime="${toIso(time)}">${formatTime(time)}</time> · Tập ${episodeNumber(show.platforms[0], episode)}
          </span>
          <span class="week-item__title">${followMark(show)}${show.title}</span>
          ${platformMarks(show.platforms)}
        </span>
      </a>
    </li>`;
}

/** Ngày hiện ở lịch: từ thứ Hai tuần này tới 6 ngày sau hôm nay, nên Chủ nhật vẫn xem được lịch tuần sau. */
function scheduleDays(time) {
  const today = todayStart(time);
  const days = [];
  for (let day = weekStart(time); day < today + 7 * DAY_MS; day += DAY_MS) days.push(day);
  return days;
}

/** Ngày dạng "16/11" theo giờ phát sóng (khuya trước TODAY_END_HOUR vẫn là ngày trước). */
const dayDate = (day) => formatDayLabel(day).split(', ')[1];

function dayTabs(days, selectedDay, today) {
  return html`
    <div class="day-tabs" role="group" aria-label="Chọn ngày">
      ${days.map((day) => html`
        <button class="day-tab ${day === today ? 'day-tab--today' : ''} ${day < today ? 'day-tab--past' : ''}" type="button"
          data-day="${day}" aria-pressed="${day === selectedDay}" aria-label="${formatDayLabel(day)}">
          <span class="day-tab__name">${day === today ? 'Hôm nay' : WEEKDAYS_SHORT[weekdayOf(day)]}</span>
          <span class="day-tab__date">${dayDate(day)}</span>
        </button>`)}
    </div>`;
}

function dayPanel(day, entries) {
  const list = entries.filter(({ time }) => todayStart(time) === day);
  return html`
    <section class="week-day week-day--selected" aria-label="${formatDayLabel(day)}">
      ${list.length
        ? html`<ol class="list-unstyled">${list.map(dayItem)}</ol>`
        : html`<p class="week-day__empty">Ngày này chưa có tập nào.</p>`}
    </section>`;
}

export function mountHome(root, { catalog, state }) {
  const filters = state.home;
  const now = Date.now();
  let today = todayStart(now);
  let selectedDay = today;

  mount(root, html`
    <h1 class="page-title" tabindex="-1">Lịch chiếu Anime bản quyền</h1>
    <section aria-labelledby="continue-title" id="continue-section" hidden>
      <header class="section-header"><h2 id="continue-title">Tiếp tục xem</h2></header>
      <div id="continue-list"></div>
    </section>
    <form class="filter-bar" id="home-filters">
      ${languageFilter(filters.language)}
      ${freeToggle(filters.free)}
      ${mineToggle(filters.mine)}
    </form>
    <section aria-labelledby="today-title">
      <header class="section-header">
        <h2 id="today-title">Hôm nay</h2>
        <span class="section-header__note" id="today-note"></span>
      </header>
      <div id="today-list"></div>
    </section>
    <section aria-labelledby="week-title">
      <header class="section-header">
        <h2 id="week-title">Lịch theo ngày</h2>
        <span class="section-header__note">Giờ VN · 25:00 là 1 giờ sáng hôm sau</span>
      </header>
      <div id="week-tabs"></div>
      <div class="week-grid" id="week-list"></div>
    </section>`);

  const todayNote = root.querySelector('#today-note');
  const todayList = root.querySelector('#today-list');
  const weekTabs = root.querySelector('#week-tabs');
  const weekList = root.querySelector('#week-list');
  const continueSection = root.querySelector('#continue-section');
  const continueList = root.querySelector('#continue-list');

  let shownDay = 0;

  function refreshContinue(time) {
    const items = selectContinueWatching(catalog.shows, time, CONTINUE_LIMIT);
    continueSection.hidden = !items.length;
    mount(continueList, html`<ul class="episode-strip list-unstyled">${items.map(continueCard)}</ul>`);
  }

  function refresh() {
    const time = Date.now();
    const days = scheduleDays(time);
    const entries = selectScheduleEpisodes(catalog.shows, filters, days[0], days.at(-1) + DAY_MS, time);
    const episodes = selectTodayEpisodes(catalog.shows, filters, time);

    refreshContinue(time);
    shownDay = todayStart(time);
    // Sang ngày mới khi trang đang mở: chuyển theo nếu người xem đang ở tab hôm nay.
    if (todayStart(time) !== today) {
      if (selectedDay === today || !days.includes(selectedDay)) selectedDay = todayStart(time);
      today = todayStart(time);
    }
    todayNote.textContent = formatDayLabel(shownDay);
    mount(todayList, episodes.length
      ? html`<ul class="episode-strip list-unstyled">${episodes.map((entry, index) => todayCard(entry, time, index < 3))}</ul>`
      : emptyState('event_busy', 'Hôm nay chưa có phim nào lên sóng.'));
    mount(weekTabs, dayTabs(days, selectedDay, today));
    mount(weekList, dayPanel(selectedDay, entries));
    // Thanh ngày cuộn ngang trên điện thoại: đưa ngày đang chọn vào giữa (chỉ cuộn ngang, không kéo trang).
    const strip = weekTabs.querySelector('.day-tabs');
    const selected = strip.querySelector('[aria-pressed="true"]');
    strip.scrollLeft = selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
  }

  bindFilters(root.querySelector('#home-filters'), filters, refresh);
  weekTabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-day]');
    if (!tab) return;
    selectedDay = Number(tab.dataset.day);
    refresh();
    weekTabs.querySelector(`[data-day="${selectedDay}"]`).focus();
  });

  continueList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-clear-progress]');
    if (!button) return;
    clearTooltips();
    clearProgress(Number(button.dataset.clearProgress));
    refreshContinue(Date.now());
  });

  refresh();

  // Phim mùa cũ không có sẵn trong data.js: tải riêng rồi vẽ lại mục Tiếp tục xem.
  const missing = recentProgressIds(CONTINUE_LIMIT).filter((id) => !catalog.shows.some((show) => show.id === id));
  Promise.all(missing.map((id) => loadArchivedShow(catalog, id))).then((added) => {
    if (added.some(Boolean) && continueList.isConnected) refreshContinue(Date.now());
  });

  // Một đồng hồ chung, tự dừng khi rời trang. Tới giờ chiếu hoặc sang ngày mới thì vẽ lại.
  const timer = setInterval(() => {
    if (!todayList.isConnected) {
      clearInterval(timer);
      return;
    }
    const time = Date.now();
    const badges = [...todayList.querySelectorAll('[data-countdown-to]')];
    if (todayStart(time) !== shownDay || badges.some((badge) => Number(badge.dataset.countdownTo) <= time)) {
      refresh();
      return;
    }
    badges.forEach((badge) => {
      badge.textContent = formatCountdown(Number(badge.dataset.countdownTo) - time);
    });
  }, 1e3);

  return { refresh };
}
