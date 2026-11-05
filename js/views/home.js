/* "Lịch chiếu": các tập trong hôm nay và lịch cả tuần. */

import { emptyState, followButton, icon, poster } from '../components/common.js';
import { bindFilters, freeToggle, languageFilter, mineToggle } from '../components/filters.js';
import { platformMarks } from '../components/platform-logo.js';
import { WEEK_ORDER, WEEKDAYS, WEEKDAYS_SHORT } from '../config.js';
import { loadArchivedShow } from '../domain/archive.js';
import { isFollowing } from '../domain/follow.js';
import { clearProgress, recentProgressIds, selectContinueWatching } from '../domain/progress.js';
import { airWeekday, episodeNumber, selectTodayEpisodes, selectWeekShows } from '../domain/shows.js';
import { html, mount } from '../lib/html.js';
import { showPath } from '../lib/paths.js';
import { formatCountdown, formatDayLabel, formatShortDateTime, formatTime, todayStart, toIso, weekdayOf } from '../lib/time.js';
import { clearTooltips } from '../ui/tooltips.js';

const CONTINUE_LIMIT = 12;

const followMark = (show) => (isFollowing(show.id) ? icon('star', 'follow-mark') : '');

function todayBadge(time, now) {
  if (time <= now) return html`<span class="poster-card__badge">Đã chiếu</span>`;
  return html`<time class="poster-card__badge poster-card__badge--countdown" datetime="${toIso(time)}"
    data-countdown-to="${time}">${formatCountdown(time - now)}</time>`;
}

function todayCard({ show, time, episode }, now) {
  const platform = show.platforms[0];
  return html`
    <li class="poster-card">
      ${followButton(show)}
      <span class="poster-card__cover">
        ${poster(show, 'poster--fill')}
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

function weekItem({ show, episode }) {
  return html`
    <li>
      <a class="week-item" href="${showPath(show.id, show.title)}" title="${show.title}">
        ${poster(show, 'poster--week')}
        <span class="week-item__body">
          <span class="week-item__meta">
            <time>${formatTime(Date.parse(show.firstAiredAt))}</time> · Tập ${episodeNumber(show.platforms[0], episode)}
          </span>
          <span class="week-item__title">${followMark(show)}${show.title}</span>
          ${platformMarks(show.platforms)}
        </span>
      </a>
    </li>`;
}

function dayTabs(selectedDay, today) {
  return html`
    <div class="day-tabs" role="group" aria-label="Chọn ngày trong tuần">
      ${WEEK_ORDER.map((day) => html`
        <button class="day-tab ${day === today ? 'day-tab--today' : ''}" type="button" data-day="${day}"
          aria-pressed="${day === selectedDay}" aria-label="${WEEKDAYS[day]}">${WEEKDAYS_SHORT[day]}</button>`)}
    </div>`;
}

function weekColumn(day, entries, { selectedDay, today }) {
  const shows = entries.filter(({ show }) => airWeekday(show) === day);
  return html`
    <section class="week-day ${day === today ? 'week-day--today' : ''} ${day === selectedDay ? 'week-day--selected' : ''}">
      <h3>${WEEKDAYS[day]}</h3>
      ${shows.length
        ? html`<ol class="list-unstyled">${shows.map(weekItem)}</ol>`
        : html`<p class="week-day__empty">Trống</p>`}
    </section>`;
}

export function mountHome(root, { catalog, state }) {
  const filters = state.home;
  const now = Date.now();
  let today = weekdayOf(now);
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
        <h2 id="week-title">Lịch tuần</h2>
        <span class="section-header__note">25:00 là 1 giờ sáng hôm sau (giờ VN)</span>
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
    const entries = selectWeekShows(catalog.shows, filters, time);
    const episodes = selectTodayEpisodes(catalog.shows, filters, time);

    refreshContinue(time);
    shownDay = todayStart(time);
    // Sang ngày mới khi trang đang mở: chuyển theo nếu người xem đang ở tab hôm nay.
    if (weekdayOf(time) !== today) {
      if (selectedDay === today) selectedDay = weekdayOf(time);
      today = weekdayOf(time);
    }
    todayNote.textContent = formatDayLabel(shownDay);
    mount(todayList, episodes.length
      ? html`<ul class="episode-strip list-unstyled">${episodes.map((entry) => todayCard(entry, time))}</ul>`
      : emptyState('event_busy', 'Hôm nay chưa có phim nào lên sóng.'));
    mount(weekTabs, dayTabs(selectedDay, today));
    mount(weekList, html`${WEEK_ORDER.map((day) => weekColumn(day, entries, { selectedDay, today }))}`);
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
