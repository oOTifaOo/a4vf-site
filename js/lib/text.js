/* Xử lý chữ tiếng Việt. Không phụ thuộc trình duyệt, nên scripts/update.mjs dùng chung được. */

/** Viết thường, bỏ dấu tiếng Việt, để "kiem si" tìm được "Kiếm Sĩ". */
export function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

const MAX_SLUG_LENGTH = 70;

/** "Thám Tử Lừng Danh!" thành "tham-tu-lung-danh", dùng cho đường dẫn. */
export function slugify(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/** Cắt ở ranh giới từ để mô tả tìm kiếm không dừng giữa chữ. */
export function truncateWords(text, maxLength) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}
