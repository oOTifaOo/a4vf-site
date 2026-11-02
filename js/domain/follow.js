/* Danh sách "Phim của tôi", lưu trong trình duyệt của người xem. */

import { FOLLOW_STORAGE_KEY } from '../config.js';

const followed = new Set();
let canPersist = true;

try {
  (JSON.parse(localStorage.getItem(FOLLOW_STORAGE_KEY) || '[]') || []).forEach((id) => followed.add(Number(id)));
} catch {
  canPersist = false;
}

export const isFollowing = (id) => followed.has(id);

/** Đổi trạng thái theo dõi. Trả về false nếu trình duyệt không cho lưu lại. */
export function toggleFollow(id) {
  if (followed.has(id)) followed.delete(id);
  else followed.add(id);

  try {
    localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify([...followed]));
    canPersist = true;
  } catch {
    canPersist = false;
  }
  return canPersist;
}
