/* Xử lý ảnh lỗi cho toàn trang. Sự kiện error không nổi bọt nên phải bắt ở pha capture. */

const LOGO_EXTENSIONS = ['png', 'svg', 'webp'];

function replaceLogoWithText(image) {
  const fallback = document.createElement('span');
  fallback.className = 'platform-logo__text';
  fallback.textContent = image.dataset.logoText;
  fallback.style.setProperty('--logo-hue', image.dataset.logoHue);
  image.replaceWith(fallback);
}

function tryNextLogo(image) {
  const attempt = Number(image.dataset.logoAttempt ?? 0) + 1;
  if (attempt >= LOGO_EXTENSIONS.length) {
    replaceLogoWithText(image);
    return;
  }
  image.dataset.logoAttempt = attempt;
  image.src = `/logos/${image.dataset.logoSlug}.${LOGO_EXTENSIONS[attempt]}`;
}

export function initImageFallbacks() {
  document.addEventListener('error', ({ target }) => {
    if (target.tagName !== 'IMG') return;
    if (target.dataset.logoSlug) tryNextLogo(target);
    else if ('removeOnError' in target.dataset) target.remove();
  }, true);
}
