/* Nhãn và icon tập trung một chỗ. Đổi chữ hoặc icon ở đây, không sửa trong các view. */

export const SITE_NAME = 'A4VFamily';

/**
 * Địa chỉ data.js trên GitHub Pages, ví dụ 'https://TENGITHUB.github.io/TENREPO/data.js'.
 * Để trống thì website đọc file data.js nằm cạnh index.html.
 */
export const REMOTE_DATA_URL = '';

/** Phim sắp chiếu trong số ngày này mới hiện ở Lịch chiếu. */
export const UPCOMING_WINDOW_DAYS = 14;

export const FOLLOW_STORAGE_KEY = 'a4vf_follow';

export const STATUS = {
  air: { label: 'Đang chiếu', icon: 'play_circle' },
  soon: { label: 'Sắp chiếu', icon: 'schedule' },
  done: { label: 'Đã chiếu', icon: 'task_alt' },
};

export const LANGUAGES = [
  { value: 'all', label: 'Tất cả phụ đề', icon: 'apps' },
  { value: 'vi', label: 'Vietsub', icon: 'subtitles' },
  { value: 'en', label: 'Engsub', icon: 'language' },
  { value: 'dub', label: 'Lồng tiếng', icon: 'record_voice_over' },
];

export const SORTS = [
  { value: 'views', label: 'Phổ biến', icon: 'local_fire_department' },
  { value: 'air', label: 'Lịch chiếu', icon: 'event' },
  { value: 'name', label: 'Tên Anime', icon: 'sort_by_alpha' },
];

/** Phần trước năm trong mã mùa (fall-2026) quyết định tên, icon và màu tiêu đề. */
export const SEASON_NAMES = { winter: 'Đông', spring: 'Xuân', summer: 'Hạ', fall: 'Thu' };

export const SEASON_ICONS = {
  spring: 'local_florist',
  summer: 'sunny',
  fall: 'eco',
  winter: 'ac_unit',
};

/** Nền tảng trùng logo: tên file trong data.js -> file logo dùng chung. */
export const LOGO_ALIASES = { 'amazon-prime-video': 'prime-video' };

export const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Thứ tự cột trong Lịch tuần: Thứ hai trước, Chủ nhật sau cùng. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
