/* "Lịch chiếu": phim lên sóng hôm nay và lịch cả tuần. */

import { emptyState, followButton, icon, poster } from '../components/common.js';
import { bindFilters, languageFilter, mineToggle } from '../components/filters.js';
import { WEEK_ORDER, WEEKDAYS, WEEKDAYS_SHORT } from '../config.js';
import { isFollowing } from '../domain/follow.js';
import { airWeekday, selectWeekShows, todayEpisode } from '../domain/shows.js';
import { html, mount } from '../lib/html.js';
import { formatDayLabel, formatTime, toIso, weekdayOf } from '../lib/time.js';

const followMark = (show) => (isFollowing(show.id) ? icon('star', 'follow-mark') : '');

function todayCard({ show, airing }, now) {
  const { justAired, time, episode } = todayEpisode(show, airing, now);
  return html`
    <li class="poster-card">
      ${followButton(show)}
      <span class="poster-card__cover">
        ${poster(show, 'poster--fill')}
        <time class="poster-card__badge" datetime="${toIso(time)}">${formatTime(time)}</time>
      </span>
      <a class="poster-card__title stretched-link" href="#phim-${show.id}" title="${show.title}">${show.title}</a>
      <span class="poster-card__meta">${justAired ? 'Đã chiếu' : 'Sắp chiếu'} · Tập ${episode}/${show.episodes}</span>
    </li>`;
}

function weekItem({ show, airing }) {
  const episode = airing.next ? airing.aired + 1 : airing.aired;
  return html`
    <li>
      <a class="week-item" href="#phim-${show.id}">
        ${poster(show, 'poster--week')}
        <span class="week-item__body">
          <span class="week-item__meta">
            <time>${formatTime(Date.parse(show.firstAiredAt))}</time> · Tập ${episode}
          </span>
          <span class="week-item__title">${followMark(show)}${show.title}</span>
          <span class="week-item__platform">${show.platforms.map((platform) => platform.name).join(' · ')}</span>
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
  const today = weekdayOf(now);
  let selectedDay = today;

  mount(root, html`
    <h1 class="visually-hidden" tabindex="-1">Lịch chiếu</h1>
    <form class="filter-bar" id="home-filters">
      ${languageFilter(filters.language)}
      ${mineToggle(filters.mine)}
    </form>
    <section aria-labelledby="today-title">
      <header class="section-header">
        <h2 id="today-title">Hôm nay</h2>
        <span class="section-header__note">${formatDayLabel(now)}</span>
      </header>
      <div id="today-list"></div>
    </section>
    <section aria-labelledby="week-title">
      <header class="section-header">
        <h2 id="week-title">Lịch tuần</h2>
        <span class="section-header__note">Giờ Việt Nam (UTC+7)</span>
      </header>
      <div id="week-tabs"></div>
      <div class="week-grid" id="week-list"></div>
    </section>`);

  const todayList = root.querySelector('#today-list');
  const weekTabs = root.querySelector('#week-tabs');
  const weekList = root.querySelector('#week-list');

  function refresh() {
    const time = Date.now();
    const entries = selectWeekShows(catalog.shows, filters, time);
    const todayEntries = entries.filter(({ show }) => airWeekday(show) === today);

    mount(todayList, todayEntries.length
      ? html`<ul class="today-strip list-unstyled">${todayEntries.map((entry) => todayCard(entry, time))}</ul>`
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

  refresh();
  return { refresh };
}
