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
| `ngon_ngu` | Vietsub / Engsub (bỏ trống = Vietsub). Có thể ghi `Lồng tiếng` nếu nền tảng chỉ có bản lồng tiếng |
| `long_tieng` | Ghi `x` nếu nền tảng này **có thêm bản lồng tiếng** (phim hiện cả nhãn Vietsub và Lồng tiếng). Thêm cột này vào cuối Sheet, tên đúng `long_tieng` |
| `gio_tap1_vn` | Giờ chiếu tập 1 tại Việt Nam, dạng `2026-10-04 21:30`. Bỏ trống thì dùng giờ AniList |
| `an` | Điền `x` để tạm ẩn phim |
| `mo_ta` | (Tuỳ chọn) Nội dung phim bằng tiếng Việt, hiện trong ô phim và trang chi tiết |

| `link_cac_tap` | **Tự động điền.** Mỗi dòng dạng `số tập|link`. Để trống nếu dùng một link chung |

| `gio_cac_tap` | (Tuỳ chọn) Mốc giờ khi lịch bị lệch, mỗi dòng `số tập|yyyy-MM-dd HH:mm` |

Logo nền tảng: xem `logos/README.txt`.

## Một phim nhiều nền tảng
Mỗi nền tảng là **một dòng** trong Sheet, lặp lại cùng `anilist_id`. Mỗi dòng có `nen_tang`, `link_xem`, `ngon_ngu`, `gio_tap1_vn` và `link_cac_tap` riêng. Dòng **đầu tiên** của phim là nền tảng chính: quyết định vị trí trong Lịch chiếu và các cột `ten_viet`, `mo_ta`.

## Giờ chiếu lệch so với quốc tế
- Cả phim lệch đều đặn (ví dụ chiếu chậm 1 ngày): điền `gio_tap1_vn` của tập 1 trên dòng nền tảng đó. Để trống thì dùng giờ AniList.
- Lịch bị hoãn giữa chừng: điền `gio_cac_tap`, ví dụ `4|2026-11-05 19:00` nghĩa là từ tập 4 chiếu lúc đó, các tập sau tính tiếp mỗi tuần.

## Tự điền link từng tập
Dán link playlist YouTube vào cột `link_xem`, script `apps-script/link-tap.gs` (chạy trong Google Sheet) tự tìm video, đọc số tập từ tiêu đề và điền vào cột `link_cac_tap` mỗi ngày. Script chỉ bổ sung tập còn thiếu nên link bạn sửa tay được giữ nguyên. Tập nào chưa có link riêng thì nút tập dùng link chung ở `link_xem`.

Mỗi phim hiện dùng dòng đầu tiên tìm thấy (một nền tảng).

## Sửa thông tin chung
Mở `index.html`, tìm phần footer để đổi link Facebook, Discord và email liên hệ.

## Chạy thử trên máy (local)
Cần cài [Node.js](https://nodejs.org) (bản LTS, từ 18 trở lên).
1. `cap-nhat-local.bat` (Windows) hoặc `./cap-nhat-local.sh`: kéo dữ liệu thật từ Google Sheet + AniList về `data.js`. Link Sheet nằm trong `sheet-url.txt` (dòng đầu tiên).
2. `chay-local.bat` hoặc `./chay-local.sh`: mở website tại http://localhost:8080.
3. Sửa Sheet xong, chạy lại bước 1 rồi nhấn Ctrl+F5 trên trình duyệt. Sửa `index.html` thì chỉ cần Ctrl+F5.
Lưu ý: đợi khoảng 5 phút sau khi sửa Sheet vì Google cập nhật bản "Publish to web" chậm.

## Tự động lấy toàn bộ anime của mùa (mới)

Script `scripts/update.mjs` tự lấy **toàn bộ anime TV/ONA** của mùa trước, mùa hiện tại và mùa sau từ AniList, không cần dán từng phim vào Sheet.

- Phim **có trong Sheet** → dùng link/nền tảng/ngôn ngữ trong Sheet (cột `ngon_ngu` để trống = Vietsub; có thể ghi `Tiếng Việt`).
- Phim **không có trong Sheet** → tự hiện ở mọi tab, phụ đề **Engsub**, nền tảng lấy từ link streaming của AniList (không có thì dẫn về trang AniList).
- Muốn ẩn một phim: thêm dòng với `anilist_id` và điền bất kỳ ký tự nào vào cột `an`.
- Đổi các mùa lấy tự động: biến môi trường `SEASONS="fall-2026,winter-2027"`; tắt hẳn: `SEASONS=off`.
- Sheet trống vẫn chạy được (chỉ có Engsub).
