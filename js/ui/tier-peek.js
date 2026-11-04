/* Trang Tier List: rê chuột lên poster thì hiện bản lớn. Chỉ bật trên máy có chuột.
   Khung nằm ngoài kho phim và các hàng, nên không bị vùng cuộn cắt mất. */

const HOVER_DEVICE = '(hover: hover) and (pointer: fine)';
const SHOW_DELAY_MS = 120;
const GAP = 12;
const MARGIN = 8;

/** CDN của AniList: thư mục medium rộng 230px, large rộng khoảng gấp đôi. */
const sharperPoster = (url) => url.replace('/cover/medium/', '/cover/large/');

function placeBeside(peek, item) {
  const box = item.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = peek;
  const fitsRight = box.right + GAP + width + MARGIN <= innerWidth;
  const left = fitsRight ? box.right + GAP : Math.max(MARGIN, box.left - GAP - width);
  const centered = box.top + box.height / 2 - height / 2;
  const top = Math.min(Math.max(MARGIN, centered), innerHeight - height - MARGIN);
  peek.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

export function bindTierPeek(container, showsById) {
  if (!matchMedia(HOVER_DEVICE).matches) return { pause() {}, resume() {} };

  const peek = document.createElement('div');
  peek.className = 'tier-peek';
  peek.hidden = true;
  peek.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = '';
  const caption = document.createElement('p');
  peek.append(image, caption);
  container.append(peek);

  let timer = 0;
  let current = null;
  let paused = false;

  function hide() {
    clearTimeout(timer);
    current = null;
    peek.hidden = true;
  }

  function show(item, film) {
    image.src = film.poster;
    caption.textContent = film.title;
    peek.hidden = false;
    placeBeside(peek, item);

    const sharper = new Image();
    sharper.onload = () => { if (current === item) image.src = sharper.src; };
    sharper.src = sharperPoster(film.poster);
  }

  container.addEventListener('pointerover', ({ target, pointerType }) => {
    const item = target.closest?.('[data-peek]');
    if (!item || item === current || paused || pointerType !== 'mouse') return;
    const film = showsById.get(Number(item.dataset.peek));
    hide();
    if (!film?.poster) return;
    current = item;
    timer = setTimeout(() => show(item, film), SHOW_DELAY_MS);
  });

  container.addEventListener('pointerout', ({ target, relatedTarget }) => {
    const item = target.closest?.('[data-peek]');
    if (item && !item.contains(relatedTarget)) hide();
  });

  container.addEventListener('pointerdown', hide);

  const onScroll = () => {
    if (container.isConnected) hide();
    else document.removeEventListener('scroll', onScroll, true);
  };
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });

  return {
    pause() { paused = true; hide(); },
    resume() { paused = false; },
  };
}
