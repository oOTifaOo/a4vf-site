/* Dữ liệu một bảng tier list: tạo, sắp xếp, lưu trong trình duyệt và đóng gói vào link chia sẻ.
   File này không đụng tới DOM. */

const STORAGE_PREFIX = 'a4vf_tier_';
const LINK_VERSION = '1';
const MAX_LINK_LENGTH = 8000;

export const MAX_TIERS = 10;
export const MAX_LABEL_LENGTH = 20;
export const MAX_TITLE_LENGTH = 60;

/** Bộ hàng mặc định. Đổi tên hoặc màu ở đây sẽ áp dụng cho các bảng tạo mới. */
const DEFAULT_TIERS = [
  ['S', '#ff7f7f'],
  ['A', '#ffbf7f'],
  ['B', '#ffdf7f'],
  ['C', '#fdfd7f'],
  ['D', '#bfff7f'],
];

const NEW_TIER_COLOR = '#7fbfff';

let nextTierId = 1;

export function createTier(label = '', color = NEW_TIER_COLOR, items = []) {
  nextTierId += 1;
  return { id: `t${nextTierId}`, label, color, items };
}

export function createBoard() {
  return { title: '', tiers: DEFAULT_TIERS.map(([label, color]) => createTier(label, color)) };
}

export const placedIds = (board) => new Set(board.tiers.flatMap((tier) => tier.items));

export const hasPlacedShows = (board) => board.tiers.some((tier) => tier.items.length > 0);

export const tierOfShow = (board, id) => board.tiers.find((tier) => tier.items.includes(id));

export function removeShow(board, id) {
  board.tiers.forEach((tier) => {
    tier.items = tier.items.filter((item) => item !== id);
  });
}

/** Đưa phim vào hàng, đứng trước beforeId; không có beforeId thì đứng cuối hàng. */
export function moveShow(board, id, tierId, beforeId = null) {
  const target = board.tiers.find((tier) => tier.id === tierId);
  if (!target) return;
  removeShow(board, id);
  const index = beforeId === null ? -1 : target.items.indexOf(beforeId);
  target.items.splice(index < 0 ? target.items.length : index, 0, id);
}

export function removeTier(board, tierId) {
  if (board.tiers.length > 1) board.tiers = board.tiers.filter((tier) => tier.id !== tierId);
}

export function shiftTier(board, tierId, step) {
  const from = board.tiers.findIndex((tier) => tier.id === tierId);
  const to = from + step;
  if (from < 0 || to < 0 || to >= board.tiers.length) return;
  const [tier] = board.tiers.splice(from, 1);
  board.tiers.splice(to, 0, tier);
}

/** Chữ đen hoặc trắng, tuỳ màu nền của nhãn hàng. */
export function inkOn(color) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#1d2330' : '#ffffff';
}

const cleanText = (value, limit) => Array.from(String(value ?? '').replace(/[\r\n|]+/g, ' ')).slice(0, limit).join('');
const cleanColor = (value) => (/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : NEW_TIER_COLOR);

/** Bỏ phim không còn trong dữ liệu và phim bị trùng, để dữ liệu cũ hoặc link sai không làm hỏng bảng. */
function sanitizeBoard(rawTitle, rawTiers, validIds) {
  const seen = new Set();
  const tiers = rawTiers.slice(0, MAX_TIERS).map(({ label, color, items }) => {
    const unique = items.filter((id) => {
      if (!validIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return createTier(cleanText(label, MAX_LABEL_LENGTH), cleanColor(color), unique);
  });
  return tiers.length ? { title: cleanText(rawTitle, MAX_TITLE_LENGTH), tiers } : null;
}

/** Đọc bảng đã lưu của mùa. Bộ nhớ bị chặn hoặc dữ liệu hỏng thì trả về bảng mới. */
export function loadBoard(seasonKey, validIds) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + seasonKey) || 'null');
    if (saved && Array.isArray(saved.tiers)) {
      const tiers = saved.tiers.map((tier) => ({ ...tier, items: Array.isArray(tier.items) ? tier.items : [] }));
      return sanitizeBoard(saved.title, tiers, validIds) ?? createBoard();
    }
  } catch { /* Dùng bảng mới bên dưới. */ }
  return createBoard();
}

/** Trả về false nếu trình duyệt không cho lưu. */
export function saveBoard(seasonKey, board) {
  try {
    localStorage.setItem(STORAGE_PREFIX + seasonKey, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/**
 * Link chia sẻ không cần máy chủ: toàn bộ bảng nằm sau dấu # của địa chỉ.
 * Mỗi hàng là một dòng "màu|tên|id,id,id", id viết theo cơ số 36 cho ngắn.
 */
export function encodeBoard(board) {
  const lines = board.tiers.map(({ label, color, items }) =>
    [color.slice(1), cleanText(label, MAX_LABEL_LENGTH), items.map((id) => id.toString(36)).join(',')].join('|'));
  return toBase64Url([LINK_VERSION, cleanText(board.title, MAX_TITLE_LENGTH), ...lines].join('\n'));
}

/** Trả về bảng từ link, hoặc null nếu link hỏng. */
export function decodeBoard(payload, validIds) {
  if (!payload || payload.length > MAX_LINK_LENGTH) return null;
  try {
    const [version, title, ...lines] = fromBase64Url(payload).split('\n');
    if (version !== LINK_VERSION) return null;
    const tiers = lines.map((line) => {
      const [color, label, ids] = line.split('|');
      const items = (ids ?? '').split(',').filter(Boolean).map((id) => parseInt(id, 36));
      return { label, color: `#${color}`, items };
    });
    return sanitizeBoard(title, tiers, validIds);
  } catch {
    return null;
  }
}
