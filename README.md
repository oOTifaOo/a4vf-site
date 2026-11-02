# A4VFamily – Lịch chiếu Anime (static site)

## Cấu trúc
- `index.html`: giao diện (danh sách + trang chi tiết từng phim, đường dẫn dạng `#phim-<id>`).
- `data.js`: dữ liệu phim. Hiện là **dữ liệu mẫu**, sẽ được script ghi đè.
- `scripts/update.mjs`: lấy thông tin từ AniList, ghép với link bản quyền trong Google Sheet, ghi lại `data.js`.
- `.github/workflows/update.yml`: chạy script mỗi 6 giờ và khi bạn bấm chạy tay.
- `data/links.csv`: bản dự phòng của Google Sheet (dùng khi chưa cấu hình `SHEET_CSV_URL`).

## Cột của Google Sheet (hàng 1 là tiêu đề, giữ đúng tên cột)
| Cột | Ý nghĩa |
|---|---|
| `anilist_id` | Số ID cuối URL AniList, ví dụ anilist.co/anime/**12345** (bắt buộc) |
| `ten_viet` | Tên tiếng Việt, bỏ trống thì dùng tên Anh/Romaji |
| `nen_tang` | Tên nền tảng, ví dụ Ani-One Việt Nam |
| `link_xem` | Link xem hợp pháp (playlist hoặc trang phim) |
| `ngon_ngu` | Vietsub / Lồng tiếng |
| `gio_tap1_vn` | Giờ chiếu tập 1 tại Việt Nam, dạng `2026-10-04 21:30`. Bỏ trống thì dùng giờ AniList |
| `an` | Điền `x` để tạm ẩn phim |

Mỗi phim hiện dùng dòng đầu tiên tìm thấy (một nền tảng).

## Sửa thông tin chung
Mở `index.html`, tìm phần footer để đổi link Facebook, Discord và email liên hệ.
