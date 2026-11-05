/* Nhãn và icon tập trung một chỗ. Đổi chữ hoặc icon ở đây, không sửa trong các view. */

export const SITE_NAME = 'A4VFamily';
export const SITE_URL = 'https://a4vf.net';
export const SITE_IMAGE = `${SITE_URL}/og-image.png`;
export const SITE_DESCRIPTION = 'Lịch chiếu anime Vietsub và lồng tiếng bản quyền tại Việt Nam, cập nhật theo tuần và theo mùa trên Ani-One, Muse, FPT Play, Netflix.';

/**
 * Địa chỉ data.js trên GitHub Pages, ví dụ 'https://TENGITHUB.github.io/TENREPO/data.js'.
 * Để trống thì website đọc file data.js nằm cạnh index.html.
 */
export const REMOTE_DATA_URL = 'https://ootifaoo.github.io/a4vf-site/data.js';

/** Trang riêng cho từng nền tảng Việt Nam. `names` là giá trị cột nen_tang trong Sheet. */
export const PLATFORM_PAGES = [
  { slug: 'muse-viet-nam', label: 'Muse Việt Nam', names: ['Muse Việt Nam'], note: 'kênh YouTube miễn phí' },
  { slug: 'ani-one-viet-nam', label: 'Ani-One Việt Nam', names: ['Ani-one Việt Nam'], note: 'kênh YouTube miễn phí' },
  { slug: 'pops', label: 'POPS', names: ['POPS'], note: 'kênh YouTube miễn phí', dubbed: true },
  { slug: 'netflix', label: 'Netflix', names: ['Netflix'], note: 'dịch vụ trả phí' },
  { slug: 'fpt-play', label: 'FPT Play', names: ['FPT Play'], note: 'dịch vụ có quảng cáo và gói trả phí' },
  { slug: 'crunchyroll', label: 'Crunchyroll', names: ['Crunchyroll'], note: 'dịch vụ anime có phụ đề tiếng Việt' },
  { slug: 'iq', label: 'iQIYI', names: ['iQ'], note: 'dịch vụ phim châu Á' },
  { slug: 'bilibili-tv', label: 'Bilibili TV', names: ['Bilibili TV'], note: 'dịch vụ xem anime có phụ đề tiếng Việt' },
];

export const CONTACT_EMAIL = 'a4vtranslation@gmail.com';

/** Mã đo của Google Analytics 4. Xem tại Admin > Data streams > a4vf.net. */
export const GA_MEASUREMENT_ID = 'G-HJQ209GCYN';

/**
 * Đường dẫn Web app của apps-script/bao-loi.gs, kết thúc bằng /exec.
 * Để trống thì web thật ẩn nút báo lỗi và Hòm thư góp ý.
 */
export const REPORT_ENDPOINT = '';

/** Sửa danh sách ở đây thì sửa cả BL_SOURCES trong apps-script/bao-loi.gs. */
export const REPORT_FORMS = {
  show: {
    source: 'phim',
    title: 'Báo lỗi phim',
    question: 'Phim này gặp lỗi gì?',
    types: [
      { value: 'thieu-tap', label: 'Thiếu tập', fields: ['episode', 'platform'], placeholder: 'Ví dụ: tập mới đã có trên nền tảng nhưng web chưa hiện' },
      { value: 'sai-lich', label: 'Sai lịch chiếu', fields: ['episode', 'platform'], placeholder: 'Ví dụ: giờ chiếu đúng là 22:00 thứ Bảy' },
      { value: 'link-loi', label: 'Link hỏng hoặc sai', fields: ['episode', 'platform'], placeholder: 'Ví dụ: link dẫn sang phim khác' },
      { value: 'sai-thong-tin', label: 'Sai thông tin phim', fields: [], placeholder: 'Thông tin nào cần sửa?' },
      { value: 'khac', label: 'Khác', fields: [], noteRequired: true, placeholder: 'Bạn mô tả giúp nhóm nhé' },
    ],
  },
  site: {
    source: 'chung',
    title: 'Hòm thư góp ý',
    intro: 'Báo thiếu phim, lỗi website hoặc góp ý về phụ đề.',
    question: 'Bạn muốn gửi điều gì?',
    types: [
      { value: 'thieu-anime', label: 'Thiếu anime', fields: ['anime', 'platform'], animeRequired: true, placeholder: 'Phim chiếu ở đâu, từ ngày nào?' },
      { value: 'phu-de', label: 'Góp ý phụ đề', fields: ['anime', 'episode', 'platform'], animeRequired: true, noteRequired: true, placeholder: 'Câu nào, ở phút nào, nên sửa thế nào?' },
      { value: 'website', label: 'Lỗi website', fields: [], noteRequired: true, placeholder: 'Lỗi ở trang nào, trên điện thoại hay máy tính?' },
      { value: 'gop-y', label: 'Góp ý khác', fields: [], noteRequired: true, placeholder: 'Nhóm luôn lắng nghe ý kiến của bạn' },
    ],
  },
};

/** Phim sắp chiếu trong số ngày này mới hiện ở Lịch chiếu. */
export const UPCOMING_WINDOW_DAYS = 14;

/** Mục Hôm nay kéo dài tới giờ này của sáng hôm sau, theo giờ Việt Nam. */
export const TODAY_END_HOUR = 2;

export const FOLLOW_STORAGE_KEY = 'a4vf_follow';
export const PROGRESS_STORAGE_KEY = 'a4vf_progress';

export const STATUS = {
  air: { label: 'Đang chiếu', icon: 'play_circle' },
  soon: { label: 'Sắp chiếu', icon: 'schedule' },
  done: { label: 'Đã chiếu', icon: 'task_alt' },
};

export const LANGUAGES = [
  { value: 'all', label: 'Tất cả', icon: 'video_library' },
  { value: 'vi', label: 'Vietsub', icon: 'closed_caption' },
];

/** Bộ lọc Bản dịch của trang Tìm Anime; các trang khác chỉ lọc Tất cả và Vietsub. */
export const SEARCH_LANGUAGES = [
  { value: 'vi', label: 'Vietsub' },
  { value: 'dub', label: 'Lồng tiếng' },
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
