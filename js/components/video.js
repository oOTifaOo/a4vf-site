/* Nhúng video YouTube/Dailymotion: khung chỉ tải khi người xem bấm phát. */

const VIDEO_ID = /^[\w-]{6,20}$/;

/** Lấy mã video từ link một video cụ thể. Link playlist hay kênh trả về null. */
export function youtubeVideoId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^(www|m)\./, '');
  const path = parsed.pathname.split('/').filter(Boolean);
  let id = null;
  if (host === 'youtu.be') [id] = path;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = path[0] === 'watch' ? parsed.searchParams.get('v') : null;
    if (['embed', 'shorts', 'live'].includes(path[0])) [, id] = path;
  }
  return VIDEO_ID.test(id ?? '') ? id : null;
}

export const youtubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
export const dailymotionEmbedUrl = (id) => `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
export const youtubeThumbnail = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** Thẻ meta referrer của trang đặt no-referrer cho ảnh AniList; YouTube lại cần referrer nên đặt riêng ở đây. */
export function createVideoFrame(src, title) {
  const frame = document.createElement('iframe');
  frame.src = src;
  frame.title = title;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  return frame;
}
