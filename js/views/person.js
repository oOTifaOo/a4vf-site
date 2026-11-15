/* Trang một dịch giả hoặc studio lồng tiếng: giới thiệu và mọi phim họ tham gia. */

import { chip, emptyState, icon, isExternalUrl } from '../components/common.js';
import { SHOW_GRID_CLASS, showGrid } from '../components/show-card.js';
import { ROLE_LABELS, worksOf } from '../domain/people.js';
import { html, mount } from '../lib/html.js';

const byNewest = (a, b) => String(b.firstAiredAt).localeCompare(String(a.firstAiredAt));

function workSection(id, iconName, title, shows, now) {
  if (!shows.length) return '';
  return html`
    <section aria-labelledby="${id}">
      <header class="section-header">
        <h2 id="${id}">${icon(iconName)}${title}</h2>
        <span class="section-header__note">${shows.length} phim</span>
      </header>
      <ul class="${SHOW_GRID_CLASS}">${showGrid([...shows].sort(byNewest), now)}</ul>
    </section>`;
}

export function mountPerson(root, { catalog }, person) {
  const { translated, dubbed } = worksOf(person, catalog.shows);
  const now = Date.now();
  mount(root, html`
    <header class="person-head">
      <span class="person-head__avatar" aria-hidden="true">
        ${icon({ studio: 'mic', 'dien-vien': 'record_voice_over' }[person.role] ?? 'subtitles')}
        ${person.image ? html`<img src="${person.image}" alt="" data-remove-on-error>` : ''}
      </span>
      <div>
        <h1 class="page-title" tabindex="-1">${person.name}</h1>
        <ul class="chip-list">
          ${chip(ROLE_LABELS[person.role] ?? person.role)}
          ${person.group ? chip(person.group) : ''}
        </ul>
      </div>
    </header>
    ${person.bio ? html`<p class="page-intro">${person.bio}</p>` : ''}
    ${isExternalUrl(person.link) ? html`
      <p><a class="btn btn-outline-primary" href="${person.link}" target="_blank" rel="noopener">${icon('open_in_new')}Trang của ${person.name}</a></p>` : ''}
    ${workSection('person-translated', 'subtitles', 'Phim đã dịch', translated, now)}
    ${workSection('person-dubbed', 'mic', 'Phim đã lồng tiếng', dubbed, now)}
    ${translated.length || dubbed.length ? '' : emptyState('movie', 'Chưa có phim nào được ghi công.')}`);
  return null;
}
