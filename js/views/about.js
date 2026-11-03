/* "Giới thiệu": hồ sơ nhóm A4VFamily theo phong cách trang truyện tranh. */

import { externalLink, icon } from '../components/common.js';
import { ABOUT_PAGE } from '../content/about.js';
import { PLATFORM_PAGES, SITE_NAME } from '../config.js';
import { html, mount } from '../lib/html.js';
import { PATHS, platformPath } from '../lib/paths.js';

const IMAGE_ROOT = '/images/gioi-thieu';

function sectionTitle(kana, title, note = '') {
  return html`
    <header class="about-heading">
      <span class="about-heading__kana" aria-hidden="true">${kana}</span>
      <h2>${title}</h2>
      ${note ? html`<p>${note}</p>` : ''}
    </header>`;
}

const hero = ({ tagline, intro }) => html`
  <section class="about-hero">
    <div class="about-hero__lines" aria-hidden="true"></div>
    <div class="about-hero__copy">
      <p class="about-hero__tag">${tagline}</p>
      <h1 tabindex="-1">Xin chào, chúng tôi là <span>${SITE_NAME}</span>!</h1>
      <p class="about-hero__intro">${intro}</p>
      <div class="about-hero__actions">
        <a class="about-button about-button--yellow" href="#du-an">Xem dự án tiêu biểu</a>
        <a class="about-button" href="#lien-he">Liên hệ hợp tác</a>
      </div>
    </div>
    <div class="about-hero__art">
      <p class="about-bubble" aria-hidden="true"><span lang="ja">よろしく!</span></p>
      <img class="about-hero__logo" src="${IMAGE_ROOT}/logo-a4v.webp" width="700" height="330" alt="Logo A4V và linh vật của nhóm" fetchpriority="high">
      <img class="about-hero__mascot" src="${IMAGE_ROOT}/linh-vat.webp" width="300" height="300" alt="">
    </div>
  </section>`;

const stats = (items) => html`
  <ul class="about-stats list-unstyled">
    ${items.map((item) => html`
      <li><strong>${item.value}</strong><span>${item.label}</span></li>`)}
  </ul>`;

const journey = (items) => html`
  <section class="about-section" aria-labelledby="hanh-trinh">
    ${sectionTitle('物語', html`<span id="hanh-trinh">Hành trình 20 năm</span>`)}
    <ol class="about-journey list-unstyled">
      ${items.map((item) => html`
        <li class="about-panel">
          <span class="about-journey__year">${item.year}</span>
          <h3>${item.title}</h3>
          <p>${item.text}</p>
        </li>`)}
    </ol>
  </section>`;

const services = (items) => html`
  <section class="about-section" aria-labelledby="dich-vu">
    ${sectionTitle('仕事', html`<span id="dich-vu">Chúng tôi làm gì</span>`)}
    <div class="about-services">
      ${items.map((item) => html`
        <article class="about-panel about-service">
          <span class="about-service__kana" aria-hidden="true">${item.kana}</span>
          ${icon(item.icon)}
          <h3>${item.title}</h3>
          <p>${item.text}</p>
          ${item.tags?.length ? html`<ul class="about-tags list-unstyled">${item.tags.map((tag) => html`<li>${tag}</li>`)}</ul>` : ''}
        </article>`)}
    </div>
  </section>`;

const reasons = (items) => html`
  <section class="about-section about-section--band" aria-labelledby="ly-do">
    ${sectionTitle('強み', html`<span id="ly-do">Vì sao chọn A4VFamily</span>`)}
    <ol class="about-reasons list-unstyled">
      ${items.map((item, index) => html`
        <li>
          <span class="about-reasons__number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
          <div><h3>${item.title}</h3><p>${item.text}</p></div>
        </li>`)}
    </ol>
  </section>`;

const partners = (items) => html`
  <section class="about-section" aria-labelledby="doi-tac">
    ${sectionTitle('仲間', html`<span id="doi-tac">Đối tác tiêu biểu</span>`)}
    <ul class="about-partners list-unstyled">
      ${items.map((item) => html`
        <li>
          ${item.file ? html`<img src="${IMAGE_ROOT}/doi-tac-${item.file}.webp" alt="Logo ${item.name}" loading="lazy" decoding="async">` : ''}
          <span>${item.name}</span>
        </li>`)}
    </ul>
  </section>`;

const workCard = (work) => html`
  <li class="about-work">
    <img src="${work.image || `${IMAGE_ROOT}/${work.file}.webp`}" width="320" height="450" alt="Poster ${work.title}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
    <h4>${work.title}</h4>
    ${work.note ? html`<p class="about-work__note">${work.note}</p>` : ''}
    ${work.platforms ? html`<p class="about-work__platforms">${work.platforms}</p>` : ''}
  </li>`;

const works = ({ series, movies }) => html`
  <section class="about-section" id="du-an" aria-labelledby="du-an-title">
    ${sectionTitle('作品', html`<span id="du-an-title">Dự án tiêu biểu</span>`, 'Một phần trong gần 1000 dự án phim bộ và phim điện ảnh mà nhóm đã thực hiện.')}
    <h3 class="about-works-title">Phim bộ</h3>
    <ul class="about-works list-unstyled">${series.map(workCard)}</ul>
    <h3 class="about-works-title">Phim điện ảnh</h3>
    <ul class="about-works list-unstyled">${movies.map(workCard)}</ul>
  </section>`;

const schedule = (sources) => html`
  <section class="about-section" aria-labelledby="ve-lich-chieu">
    ${sectionTitle('予定', html`<span id="ve-lich-chieu">Về lịch chiếu trên a4vf.net</span>`)}
    <div class="about-panel about-schedule">
      <p>${SITE_NAME} tổng hợp lịch chiếu anime có bản quyền tại Việt Nam. Website không lưu trữ video và không tải phim lên máy chủ.</p>
      <ul>${sources.map((item) => html`<li><strong>${item.title}</strong> ${item.text}</li>`)}</ul>
      <p>Giờ chiếu theo giờ Việt Nam (UTC+7) và được ghi riêng cho từng nền tảng.</p>
      <p class="about-schedule__links">
        <a href="${PATHS.home}">Xem lịch chiếu</a>
        ${PLATFORM_PAGES.map((platform) => html`<a href="${platformPath(platform.slug)}">${platform.label}</a>`)}
      </p>
    </div>
  </section>`;

const contact = ({ email, facebook }) => html`
  <section class="about-contact" id="lien-he" aria-labelledby="lien-he-title">
    <div class="about-contact__copy">
      <span class="about-heading__kana" aria-hidden="true">連絡</span>
      <h2 id="lien-he-title">Cùng đưa anime đến gần khán giả Việt</h2>
      <p>Bạn cần dịch thuật Anime, Manga, Game? Hãy liên hệ với nhóm.</p>
      <ul class="list-unstyled">
        <li>${icon('mail')}<span class="user-select-all">${email}</span></li>
        <li>${icon('public')}<a ${externalLink(facebook)}>Facebook ${SITE_NAME}</a></li>
      </ul>
    </div>
    <img src="${IMAGE_ROOT}/pho-dem.webp" width="735" height="1306" alt="Tranh phố đêm phong cách anime" loading="lazy" decoding="async">
  </section>`;

export function mountAbout(root) {
  const page = ABOUT_PAGE;
  mount(root, html`
    <div class="about">
      ${hero(page)}
      ${stats(page.stats)}
      ${journey(page.journey)}
      ${services(page.services)}
      ${reasons(page.reasons)}
      ${partners(page.partners)}
      ${works(page)}
      ${schedule(page.sources)}
      ${contact(page.contact)}
    </div>`);
  return null;
}
