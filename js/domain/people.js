/* Dịch giả, studio và diễn viên lồng tiếng. Dữ liệu ở nhan-su.json, tạo từ tab "Nhân sự" trong Google Sheet. */

import { languageKind } from './shows.js';

export const ROLE_LABELS = {
  'dich-gia': 'Dịch giả',
  'studio': 'Studio lồng tiếng',
  'dien-vien': 'Diễn viên lồng tiếng',
};

export const personPath = (id) => `/nhan-su/${id}`;

/** Không tải được thì trang vẫn chạy, chỉ thiếu phần ghi công. Đổi địa chỉ mỗi giờ để không bị giữ bản cũ quá lâu. */
export async function loadPeople() {
  try {
    const response = await fetch(`/nhan-su.json?v=${Math.floor(Date.now() / 36e5)}`);
    if (!response.ok) return new Map();
    const list = await response.json();
    return new Map(list.filter((person) => person.shown).map((person) => [person.id, { ...person, works: person.w ?? [] }]));
  } catch {
    return new Map();
  }
}

/** Người chưa đồng ý hiện tên hoặc id gõ sai sẽ bị bỏ qua. */
export const peopleOf = (ids, people) => ids.map((id) => people.get(id)).filter(Boolean);

/** Gộp ghi công của mọi nền tảng. Dịch giả chỉ tính bản phụ đề Việt, và mỗi phim chỉ hiện một người. */
export function showCredits(show, people) {
  const all = [...show.platforms, ...show.otherPlatforms];
  const subtitled = all.filter((platform) => languageKind(platform.language) === 'vi');
  const unique = (list, key) => peopleOf([...new Set(list.flatMap((platform) => platform.credits[key]))], people);
  return { translator: unique(subtitled, 'translators')[0] ?? null, dubbers: unique(all, 'dubbers') };
}

/** Diễn viên lồng tiếng Việt theo từng nhân vật, gộp mọi nền tảng. Trả về Map id nhân vật -> danh sách người. */
export function vietnameseVoices(show, people) {
  const voices = new Map();
  for (const platform of [...show.platforms, ...show.otherPlatforms]) {
    for (const { character, person } of platform.credits.voices) {
      const found = people.get(person);
      if (!found) continue;
      const list = voices.get(character) ?? [];
      if (!list.includes(found)) list.push(found);
      voices.set(character, list);
    }
  }
  return voices;
}

/** Phim người này tham gia, chia theo vai trò. */
export function worksOf(person, shows) {
  const platformsOf = (show) => [...show.platforms, ...show.otherPlatforms];
  const has = (show, key) => platformsOf(show).some((platform) => platform.credits[key].includes(person.id));
  const voiced = (show) => platformsOf(show).some((platform) => platform.credits.voices.some((voice) => voice.person === person.id));
  return {
    translated: shows.filter((show) => has(show, 'translators')),
    dubbed: shows.filter((show) => has(show, 'dubbers') || voiced(show)),
  };
}
