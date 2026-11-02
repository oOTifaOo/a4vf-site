/* Trang phim: chia sẻ, đếm ngược, xem theo từng nền tảng, trailer và tổng quan. */

import {
  chip, emptyState, externalLink, followButton, icon, isExternalUrl, languageChip, poster, statusBadge,
} from '../components/common.js';
import {
  createVideoFrame, dailymotionEmbedUrl, youtubeEmbedUrl, youtubeThumbnail, youtubeVideoId,
} from '../components/video.js';
import { LANGUAGES } from '../config.js';
import { airingOf, languageKind } from '../domain/shows.js';
import { html, mount } from '../lib/html.js';
import { formatDateTime, padNumber, toIso } from '../lib/time.js';

const COUNTDOWN_UNITS = ['Ngày', 'Giờ', 'Phút', 'Giây'];

const X_LOGO_PATH = 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z';

/** Material Symbols không có logo thương hiệu nên X dùng SVG, MyAnimeList dùng chữ MAL. */
const xLogo = html`<svg class="btn-icon__logo" viewBox="0 0 24 24" aria-hidden="true"><path d="${X_LOGO_PATH}"/></svg>`;

const externalAction = (url, label, content) => (isExternalUrl(url) ? html`
  <a class="btn btn-icon" href="${url}" target="_blank" rel="noopener"
    aria-label="${label}" data-bs-title="${label}">${content}</a>` : '');

function actions(show) {
  return html`
    <div class="detail-actions">
      ${followButton(show, 'btn btn-icon btn-icon--star')}
      ${externalAction(show.websiteUrl, 'Trang chủ', icon('home'))}
      ${externalAction(show.xUrl, 'X (Twitter)', xLogo)}
      ${externalAction(show.malUrl, 'MyAnimeList', html`<span class="btn-icon__text">MAL</span>`)}
    </div>`;
}

/** Vietsub và Engsub là hai nhóm nền tảng; nhóm chính của phim đứng trước. */
function subtitleGroups(show) {
  const groupOf = (platforms) => {
    const kind = languageKind(platforms[0].language) === 'en' ? 'en' : 'vi';
    return { platforms, ...LANGUAGES.find((option) => option.value === kind) };
  };
  return [show.platforms, show.otherPlatforms].filter((list) => list.length).map(groupOf);
}

function subtitleTabs(groups, active) {
  if (groups.length < 2) return '';
  return html`
    <div class="subtitle-tabs" role="group" aria-label="Phụ đề">
      ${groups.map((group, index) => html`
        <button class="subtitle-tab" type="button" data-group="${index}" aria-pressed="${index === active}">
          ${icon(group.icon)}${group.label}
        </button>`)}
    </div>`;
}

function platformTabs(platforms, selected) {
  if (platforms.length < 2) {
    return html`<h2 id="watch-title">${icon('live_tv')}${platforms[0].name}</h2>`;
  }
  return html`
    <h2 class="visually-hidden" id="watch-title">Xem</h2>
    <div class="platform-tabs" role="group" aria-labelledby="watch-title">
      ${platforms.map((platform, index) => html`
        <button class="btn btn-sm platform-tab" type="button" data-platform="${index}"
          aria-pressed="${index === selected}">${platform.name}</button>`)}
    </div>`;
}

const episodeVideo = (platform, episode) => youtubeVideoId(platform.episodeLinks[episode]);

/** Tập mới nhất đã chiếu có video YouTube riêng, để mở sẵn trong khung phát. */
function latestPlayableEpisode(platform, airing) {
  for (let episode = airing.aired; episode > 0; episode -= 1) {
    if (episodeVideo(platform, episode)) return episode;
  }
  return null;
}

function episodeButton(platform, airing, episode, selectedEpisode) {
  const number = padNumber(episode);
  const when = formatDateTime(airing.timeOf(episode));

  if (episode > airing.aired) {
    return html`<li><button class="btn episode episode--upcoming" type="button" aria-disabled="true"
      aria-label="Tập ${number}, chiếu ${when}" data-bs-title="Chiếu ${when}">${number}</button></li>`;
  }

  if (episodeVideo(platform, episode)) {
    return html`<li><button class="btn episode" type="button" data-play-episode="${episode}"
      aria-pressed="${episode === selectedEpisode}" aria-label="Phát tập ${number}, đã chiếu ${when}"
      data-bs-title="${when}">${number}</button></li>`;
  }

  const url = platform.episodeLinks[episode] || platform.url;
  if (!isExternalUrl(url)) {
    return html`<li><button class="btn episode episode--upcoming" type="button" aria-disabled="true"
      aria-label="Tập ${number}, chưa có link xem" data-bs-title="Chưa có link xem">${number}</button></li>`;
  }

  const latest = episode === airing.aired && !selectedEpisode;
  return html`<li><a class="btn episode ${latest ? 'episode--latest' : ''}" ${externalLink(url)}
    aria-label="Xem tập ${number}, đã chiếu ${when}" data-bs-title="${when}">${number}</a></li>`;
}

function playerFacade(platform, episode) {
  const number = padNumber(episode);
  return html`
    <button class="video-frame__play" type="button" data-play-episode="${episode}" aria-label="Phát tập ${number}">
      <img src="${youtubeThumbnail(episodeVideo(platform, episode))}" alt="" loading="lazy" data-remove-on-error>
      <span class="video-frame__icon">${icon('play_arrow')}</span>
    </button>`;
}

function playerCaption(platform, airing, episode) {
  return html`
    <span>Tập ${padNumber(episode)} · <time>${formatDateTime(airing.timeOf(episode))}</time></span>
    <a class="btn btn-icon" href="${platform.episodeLinks[episode]}" target="_blank" rel="noopener"
      aria-label="Mở trên YouTube" data-bs-title="Mở trên YouTube">${icon('open_in_new')}</a>`;
}

function player(platform, airing, episode) {
  return html`
    <div class="player">
      <div class="video-frame" id="episode-player">${playerFacade(platform, episode)}</div>
      <div class="player__caption" id="player-caption">${playerCaption(platform, airing, episode)}</div>
      <p class="player__note">${icon('info')}<span>Phim được nhúng trực tiếp từ YouTube, mọi doanh thu từ quảng cáo đều thuộc về chủ kênh.</span></p>
    </div>`;
}

function watchSection(show, platform, airing, { groups, group, selected }) {
  const episodes = Array.from({ length: show.episodes }, (_, i) => i + 1);
  const playable = latestPlayableEpisode(platform, airing);
  return html`
    <section aria-labelledby="watch-title">
      ${subtitleTabs(groups, group)}
      <header class="section-header">
        ${platformTabs(groups[group].platforms, selected)}
        <button class="btn btn-icon" type="button" data-bs-toggle="collapse" data-bs-target="#episode-schedule"
          aria-expanded="false" aria-controls="episode-schedule" aria-label="Lịch từng tập"
          data-bs-title="Lịch từng tập">${icon('calendar_month')}</button>
      </header>
      ${playable ? player(platform, airing, playable) : ''}
      <ol class="episode-grid list-unstyled">
        ${episodes.map((episode) => episodeButton(platform, airing, episode, playable))}
      </ol>
      <div class="collapse" id="episode-schedule">
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <caption class="visually-hidden">Lịch chiếu từng tập, giờ Việt Nam</caption>
            <thead><tr><th scope="col">Tập</th><th scope="col">Giờ chiếu</th><th scope="col"><span class="visually-hidden">Trạng thái</span></th></tr></thead>
            <tbody>
              ${episodes.map((episode) => html`
                <tr>
                  <th scope="row">${padNumber(episode)}</th>
                  <td><time datetime="${toIso(airing.timeOf(episode))}">${formatDateTime(airing.timeOf(episode))}</time></td>
                  <td class="text-end">${episode <= airing.aired ? 'Đã chiếu' : 'Sắp chiếu'}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </div>
    </section>`;
}

const isValidTrailer = (trailer) =>
  /^[\w-]{3,40}$/.test(trailer?.id ?? '') && /^(youtube|dailymotion)$/.test(trailer?.s ?? '');

function trailerSection(show) {
  const { trailer } = show;
  if (!isValidTrailer(trailer)) return '';
  return html`
    <section aria-labelledby="trailer-title">
      <header class="section-header"><h2 id="trailer-title">${icon('smart_display')}Trailer</h2></header>
      <div class="video-frame video-frame--small">
        <button class="video-frame__play" type="button" data-trailer aria-label="Phát trailer ${show.title}">
          ${trailer.s === 'youtube' ? html`<img src="${youtubeThumbnail(trailer.id)}" alt="" loading="lazy" data-remove-on-error>` : ''}
          <span class="video-frame__icon">${icon('play_arrow')}</span>
        </button>
      </div>
    </section>`;
}

function playTrailer(button, { s: site, id }) {
  const src = site === 'dailymotion' ? dailymotionEmbedUrl(id) : youtubeEmbedUrl(id);
  button.replaceWith(createVideoFrame(src, 'Trailer'));
}

/** Icon thay cho tên trường; tên vẫn có trong tooltip và cho trình đọc màn hình. */
const fact = (iconName, label, value) => html`
  <div class="fact">
    <dt tabindex="0" data-bs-title="${label}">${icon(iconName)}<span class="visually-hidden">${label}</span></dt>
    <dd>${value}</dd>
  </div>`;

function overview(show, season) {
  const platformNames = [...new Set(show.platforms.map((platform) => platform.name))].join(', ');
  return html`
    <section aria-labelledby="overview-title">
      <header class="section-header"><h2 id="overview-title">${icon('info')}Tổng quan</h2></header>
      <dl class="fact-list">
        ${fact('translate', 'Tên Romaji', show.altTitle)}
        ${fact('format_list_numbered', 'Số tập', show.episodes)}
        ${fact('date_range', 'Mùa chiếu', season ? html`<a href="#mua-${season.key}">${season.name}</a>` : '')}
        ${fact('verified', 'Bản quyền', platformNames)}
        ${fact('local_fire_department', 'Độ phổ biến', show.popularity.toLocaleString('vi-VN'))}
      </dl>
      <ul class="chip-list">
        ${show.languages.map(languageChip)}
        ${chip(show.format)}
        ${show.genres.map(chip)}
      </ul>
    </section>`;
}

/** Đồng hồ tự dừng khi người xem rời trang và vẽ lại trang khi tới giờ chiếu. */
function startCountdown(box, show, airing, onReached) {
  const target = airing.next;
  if (!target) return;

  const episode = airing.aired + 1;
  mount(box, html`
    <span class="countdown__label">Tập ${episode} sẽ chiếu sau</span>
    <span class="countdown__units">${COUNTDOWN_UNITS.map((unit) => html`
      <span class="countdown__unit"><b data-countdown-value></b><small>${unit}</small></span>`)}
    </span>`);

  const values = box.querySelectorAll('[data-countdown-value]');
  const tick = () => {
    const remaining = target - Date.now();
    if (!box.isConnected) return clearInterval(timer);
    if (remaining <= 0) {
      clearInterval(timer);
      return onReached();
    }
    const seconds = Math.floor(remaining / 1e3);
    const parts = [Math.floor(seconds / 86400), Math.floor((seconds % 86400) / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
    parts.forEach((part, index) => { values[index].textContent = padNumber(part); });
    return undefined;
  };

  const timer = setInterval(tick, 1e3);
  tick();
}

export function mountDetail(root, { catalog, showId, backHash }) {
  const show = catalog.shows.find((item) => item.id === showId);
  if (!show) {
    mount(root, html`
      <h1 class="visually-hidden" tabindex="-1">Không tìm thấy</h1>
      ${emptyState('movie_off', 'Không tìm thấy anime này.')}`);
    return { title: 'Không tìm thấy' };
  }

  const season = catalog.seasons.find((item) => item.key === show.season);
  const groups = subtitleGroups(show);
  let group = 0;
  let selected = 0;

  const currentPlatform = () => groups[group].platforms[selected];

  function playEpisode(episode, airing) {
    const platform = currentPlatform();
    const box = root.querySelector('#episode-player');
    box.replaceChildren(createVideoFrame(
      youtubeEmbedUrl(episodeVideo(platform, episode)),
      `Tập ${padNumber(episode)} – ${show.title}`,
    ));
    mount(root.querySelector('#player-caption'), playerCaption(platform, airing, episode));
    root.querySelectorAll('.episode[data-play-episode]').forEach((button) => {
      button.setAttribute('aria-pressed', Number(button.dataset.playEpisode) === episode);
    });
    box.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    const platform = currentPlatform();
    const airing = airingOf(show, Date.now(), platform);

    mount(root, html`
      <article class="detail">
        <a class="btn btn-icon detail__back" href="${backHash}" aria-label="Quay lại" data-bs-title="Quay lại">${icon('arrow_back')}</a>
        <header class="detail-head">
          ${poster(show, 'poster--large')}
          <div class="detail-head__body">
            ${statusBadge(airing.status)}
            <h1 tabindex="-1">${show.title}</h1>
            <p class="detail-head__alt">${show.altTitle}</p>
            ${actions(show)}
          </div>
        </header>
        <p class="synopsis">${show.synopsis || 'Chưa có mô tả nội dung cho phim này.'}</p>
        <div class="countdown" id="countdown"></div>
        ${watchSection(show, platform, airing, { groups, group, selected })}
        ${trailerSection(show)}
        ${overview(show, season)}
      </article>`);

    // Tới giờ chiếu thì vẽ lại trang, trừ khi người xem đang phát video.
    startCountdown(root.querySelector('#countdown'), show, airing, () => {
      if (!root.querySelector('.video-frame iframe')) render();
    });

    root.querySelector('.detail').addEventListener('click', (event) => {
      const subtitle = event.target.closest('[data-group]');
      if (subtitle) {
        group = Number(subtitle.dataset.group);
        selected = 0;
        render();
        root.querySelector(`[data-group="${group}"]`).focus();
        return;
      }
      const tab = event.target.closest('[data-platform]');
      if (tab) {
        selected = Number(tab.dataset.platform);
        render();
        root.querySelector(`[data-platform="${selected}"]`).focus();
        return;
      }
      const episode = event.target.closest('[data-play-episode]');
      if (episode) {
        playEpisode(Number(episode.dataset.playEpisode), airing);
        return;
      }
      const trailer = event.target.closest('[data-trailer]');
      if (trailer) playTrailer(trailer, show.trailer);
    });
  }

  render();
  return { title: show.title };
}
