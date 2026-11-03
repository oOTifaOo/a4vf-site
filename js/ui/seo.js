/* Ghi thông tin tìm kiếm và chia sẻ vào <head> mỗi khi đổi trang. */

import { SITE_IMAGE, SITE_URL } from '../config.js';

function setHeadTag(selector, attribute, value, create) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = create();
    document.head.append(tag);
  }
  tag.setAttribute(attribute, value);
}

const setMeta = (attribute, key, value) => setHeadTag(`meta[${attribute}="${key}"]`, 'content', value, () => {
  const meta = document.createElement('meta');
  meta.setAttribute(attribute, key);
  return meta;
});

export function applySeo({ title, description, path, image = SITE_IMAGE, type = 'website', noindex = false, jsonLd = null }) {
  const url = `${SITE_URL}${path}`;
  document.title = title;

  setMeta('name', 'description', description);
  setMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:type', type);
  setHeadTag('link[rel="canonical"]', 'href', url, () => {
    const link = document.createElement('link');
    link.rel = 'canonical';
    return link;
  });

  document.head.querySelector('#page-jsonld')?.remove();
  if (jsonLd) {
    const script = document.createElement('script');
    script.id = 'page-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.append(script);
  }
}
