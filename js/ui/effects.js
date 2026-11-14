/* Hiệu ứng trang trí nhẹ: sao bùng lên khi theo dõi phim, và hoa, lá, tuyết rơi theo mùa anime.
   Không hiệu ứng nào chặn hay làm chậm việc hiển thị trang. Tất cả tự tắt khi máy bật chế độ giảm chuyển động,
   và khách có thể tắt hiệu ứng mùa trong menu. */

import { isFollowing } from '../domain/follow.js';

const STORAGE_KEY = 'a4vf_season_effect';
const BURST_COLORS = ['#ffc53d', '#ff7ab8', '#7cc2f2', '#6fcf8f'];
const BURST_DOTS = 10;
const MAX_PARTICLES = 24;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function burstAt(rect) {
  const burst = document.createElement('span');
  burst.className = 'star-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  for (let i = 0; i < BURST_DOTS; i += 1) {
    const dot = document.createElement('i');
    dot.style.setProperty('--angle', `${(360 / BURST_DOTS) * i}deg`);
    dot.style.background = BURST_COLORS[i % BURST_COLORS.length];
    burst.append(dot);
  }
  document.body.append(burst);
  setTimeout(() => burst.remove(), 700);
}

/** Bắt ở pha capture để lấy vị trí nút trước khi trang vẽ lại, rồi chỉ bùng khi phim vừa được thêm vào theo dõi. */
function initFollowBurst() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-follow]');
    if (!button || reduceMotion.matches) return;
    const id = Number(button.dataset.follow);
    const rect = button.getBoundingClientRect();
    setTimeout(() => {
      if (isFollowing(id)) burstAt(rect);
    });
  }, true);
}

/** Mùa anime theo tháng: đông 12-2 tuyết, xuân 3-5 hoa anh đào, hạ 6-8 đom đóm, thu 9-11 lá phong. */
function seasonOf(date) {
  const month = date.getMonth() + 1;
  if (month === 12 || month <= 2) return 'snow';
  if (month <= 5) return 'sakura';
  if (month <= 8) return 'firefly';
  return 'maple';
}

const MAPLE_COLORS = ['#ff8a3d', '#e2553b', '#f2b33d'];

function drawParticle(ctx, kind, particle) {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation);
  ctx.globalAlpha = particle.alpha;
  ctx.beginPath();
  if (kind === 'sakura') {
    const r = particle.size;
    ctx.fillStyle = '#ffb3cc';
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r, -r, r, r * 0.6, 0, r);
    ctx.bezierCurveTo(-r, r * 0.6, -r, -r, 0, -r);
  } else if (kind === 'maple') {
    const r = particle.size;
    ctx.fillStyle = MAPLE_COLORS[particle.tone];
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
      ctx.lineTo(Math.cos(a + Math.PI / 5) * r * 0.5, Math.sin(a + Math.PI / 5) * r * 0.5);
    }
  } else if (kind === 'firefly') {
    ctx.fillStyle = '#ffe680';
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 8;
    ctx.arc(0, 0, particle.size * 0.35, 0, Math.PI * 2);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#9cc8ff';
    ctx.shadowBlur = 4;
    ctx.arc(0, 0, particle.size * 0.4, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function initSeasonEffect() {
  const canvas = document.createElement('canvas');
  canvas.className = 'season-effect';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const kind = seasonOf(new Date());
  let particles = [];
  let frame = 0;
  let width = 0;
  let height = 0;

  const spawn = (y = -16) => ({
    x: Math.random() * width,
    y,
    size: 5 + Math.random() * 5,
    speed: kind === 'firefly' ? 0.15 + Math.random() * 0.25 : 0.35 + Math.random() * 0.55,
    sway: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.03,
    tone: Math.floor(Math.random() * MAPLE_COLORS.length),
    alpha: kind === 'snow' ? 0.8 : 0.5,
  });

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(MAX_PARTICLES, Math.round(width / 60));
    particles = Array.from({ length: count }, () => spawn(Math.random() * height));
  }

  function tick() {
    ctx.clearRect(0, 0, width, height);
    for (const particle of particles) {
      particle.sway += 0.015;
      particle.x += Math.sin(particle.sway) * 0.5;
      particle.y += kind === 'firefly' ? Math.cos(particle.sway) * 0.4 - particle.speed : particle.speed;
      particle.rotation += particle.spin;
      if (kind === 'firefly') particle.alpha = 0.35 + Math.abs(Math.sin(particle.sway * 2)) * 0.5;
      if (particle.y > height + 16) Object.assign(particle, spawn());
      if (particle.y < -16) Object.assign(particle, spawn(height + 16));
      drawParticle(ctx, kind, particle);
    }
    frame = requestAnimationFrame(tick);
  }

  const enabled = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off' && !reduceMotion.matches;
    } catch {
      return !reduceMotion.matches;
    }
  };

  function sync() {
    cancelAnimationFrame(frame);
    const on = enabled() && !document.hidden;
    canvas.hidden = !on;
    if (on) tick();
  }

  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener?.('change', sync);
  sync();

  // Mục bật/tắt trong menu, đặt ngay trên mục đổi nền.
  const themeItem = document.querySelector('#theme-toggle')?.closest('li');
  if (!themeItem) return;
  const item = document.createElement('li');
  item.innerHTML = '<button class="dropdown-item" type="button" id="season-effect-toggle"><span class="material-symbols-rounded icon" aria-hidden="true"></span><span></span></button>';
  themeItem.before(item);
  const button = item.querySelector('button');
  const label = () => {
    const on = enabled();
    button.querySelector('.icon').dataset.icon = on ? 'motion_photos_off' : 'auto_awesome';
    button.lastElementChild.textContent = on ? 'Tắt hiệu ứng mùa' : 'Bật hiệu ứng mùa';
    button.hidden = reduceMotion.matches;
  };
  label();
  button.addEventListener('click', () => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled() ? 'off' : 'on');
    } catch { /* Không lưu được thì chỉ đổi trong lần xem này. */ }
    label();
    sync();
  });
}

export function initEffects() {
  initFollowBurst();
  initSeasonEffect();
}
