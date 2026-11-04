/* Tập vừa chiếu mà dữ liệu chưa kịp cập nhật: hỏi tap-moi.php xem playlist YouTube đã có video chưa.
   Không tìm thấy hoặc lỗi thì giữ nguyên trang, nút tập vẫn mở playlist. */

const PLAYLIST_ID = /youtube\.com\/playlist\?(?:.*&)?list=([\w-]+)/i;
const NOT_AN_EPISODE = /trailer|teaser|preview|\bpv\b|tổng hợp|siêu clip|superclip/i;
const RECENT_MS = 14 * 864e5;
const RECENT_EPISODES = 3;
const VIDEO_ID = /^[\w-]{11}$/;

const checked = new WeakMap();

/** Số tập trong tiêu đề video, cùng quy tắc với apps-script/link-tap.gs. */
export function episodeFromTitle(title) {
  const named = /(?:tập|tap|episode|ep\.?|#)\s*0*(\d{1,4})\b/i.exec(title);
  if (named) return Number(named[1]);
  const trailing = /(?:^|[\s\-–|[(])0*(\d{1,4})(?=$|[\s\-–|\])])/g;
  let last = null;
  for (const match of title.matchAll(trailing)) {
    const before = title.slice(0, match.index).trim().toLowerCase();
    if (!/(season|mùa|phần|part|s)$/.test(before)) last = Number(match[1]);
  }
  return last;
}

function missingEpisodes(platform, airing, now) {
  if (!airing.aired || now - airing.timeOf(airing.aired) > RECENT_MS) return [];
  const newest = Array.from({ length: Math.min(RECENT_EPISODES, airing.aired) }, (_, i) => airing.aired - i);
  return newest.filter((episode) => !platform.episodeLinks[episode]);
}

/** Thêm link tập mới vào nền tảng. Trả về true nếu có tập mới để vẽ lại trang. */
export async function addLatestEpisodes(platform, airing, now = Date.now()) {
  const playlist = PLAYLIST_ID.exec(platform.url)?.[1];
  if (!playlist || !missingEpisodes(platform, airing, now).length) return false;
  if (checked.get(platform) === airing.aired) return false;
  checked.set(platform, airing.aired);

  try {
    const response = await fetch(`/tap-moi.php?list=${encodeURIComponent(playlist)}`);
    if (!response.ok) return false;
    const { videos = [] } = await response.json();
    let added = false;
    for (const { id, title } of videos) {
      if (!VIDEO_ID.test(id) || NOT_AN_EPISODE.test(title)) continue;
      const number = episodeFromTitle(title);
      if (number === null) continue;
      const episode = number - platform.episodeOffset;
      if (episode < 1 || episode > airing.aired || platform.episodeLinks[episode]) continue;
      platform.episodeLinks[episode] = `https://www.youtube.com/watch?v=${id}`;
      added = true;
    }
    return added;
  } catch {
    return false;
  }
}
