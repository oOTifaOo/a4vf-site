# A4VFamily – Lịch chiếu Anime (static site)

## Cấu trúc
- `index.html`: khung trang (đầu trang, menu, chân trang, link CDN của Bootstrap, Material Symbols, Google Fonts).
- `css/tokens.css`: màu, font, bo góc. `css/app.css`: kiểu dáng các thành phần (mobile-first).
- `js/app.js`: khởi động và bảng đường dẫn. `js/config.js`: nhãn và icon.
- `js/domain/`: quy tắc nghiệp vụ (giờ chiếu, lọc, sắp xếp, theo dõi). `js/domain/catalog.js` đổi dữ liệu `data.js` sang tên trường dễ đọc.
- `js/components/`, `js/views/`, `js/ui/`: mảnh giao diện dùng chung, từng trang, tooltip/toast/giao diện sáng tối.
- `data.js`: dữ liệu phim. Hiện là **dữ liệu mẫu**, sẽ được script ghi đè. Định dạng không đổi.
- `scripts/update.mjs`: lấy thông tin từ AniList, ghép với link bản quyền trong Google Sheet, ghi lại `data.js`.
- `.github/workflows/update.yml`: chạy script mỗi 6 giờ và khi bạn bấm chạy tay.
- `data/links.csv`: bản dự phòng của Google Sheet (dùng khi chưa cấu hình `SHEET_CSV_URL`).

## Cột của Google Sheet (hàng 1 là tiêu đề, giữ đúng tên cột)
Phim nào có trong Sheet nghĩa là **có tiếng Việt** (hiện nhãn Vietsub). Phim không có trong Sheet tự động là Engsub, nên **không cần cột ngôn ngữ**.

| Cột | Bắt buộc | Ý nghĩa |
|---|---|---|
| `anilist_id` | Có | Số ID cuối URL AniList, ví dụ anilist.co/anime/**12345** |
| `ten_viet` | Không | Tên tiếng Việt. Bỏ trống thì dùng tên Anh/Romaji |
| `nen_tang` | Có | Tên nền tảng, ví dụ `Ani-One Việt Nam` (quyết định logo, xem `logos/README.txt`) |
| `link_xem` | Có | Link xem hợp pháp (playlist hoặc trang phim) |
| `gio_tap1_vn` | Không | Giờ chiếu tập 1 **theo giờ Việt Nam**, dạng `2026-10-04 21:30` (năm-tháng-ngày giờ:phút). Bỏ trống thì dùng giờ AniList. Xem lưu ý bên dưới |
| `long_tieng` | Không | Ghi `x` nếu nền tảng này có thêm bản **lồng tiếng**. Bỏ trống nếu không |
| `an` | Không | Ghi `x` để **ẩn phim khỏi website** (phim bị thêm nhầm, hết bản quyền, 18+...). Xoá `x` để hiện lại. Phim bị ẩn cũng không được tự động thêm lại từ AniList |
| `mo_ta` | Không | Nội dung phim tiếng Việt. Bỏ trống thì hiện mô tả tiếng Anh của AniList. Có thể tự điền bằng `apps-script/mo-ta.gs` (dịch máy, bạn sửa lại được) |
| `link_cac_tap` | Tự động | Mỗi dòng dạng `số tập|link`. Do Apps Script điền. Để trống nếu dùng một link chung |
| `gio_cac_tap` | Không | Mốc giờ khi lịch bị lệch, mỗi dòng `số tập|yyyy-MM-dd HH:mm` |
| `ngon_ngu` | Không dùng nữa | Có thể xoá cột. Nếu còn và có giá trị (ví dụ `Engsub`) thì vẫn được dùng |

**Lưu ý khi nhập `gio_tap1_vn`:** Google Sheets hay tự đổi ngày giờ thành định dạng ngày của nó. Hãy bôi đen cả cột, chọn *Định dạng > Số > Văn bản thuần túy* (Plain text) **trước khi** nhập. Script cũng đọc được dạng `04/10/2026 21:30` (ngày/tháng/năm). Nếu giờ sai định dạng, script bỏ qua và dùng giờ AniList, đồng thời ghi cảnh báo trong nhật ký workflow.

Logo nền tảng: xem `logos/README.txt`.

## Một phim nhiều nền tảng
Mỗi nền tảng là **một dòng** trong Sheet, lặp lại cùng `anilist_id`. Mỗi dòng có `nen_tang`, `link_xem`, `long_tieng`, `gio_tap1_vn` và `link_cac_tap` riêng. Dòng **đầu tiên** của phim là nền tảng chính: quyết định vị trí trong Lịch chiếu và các cột `ten_viet`, `mo_ta`.

## Giờ chiếu lệch so với quốc tế
- Cả phim lệch đều đặn (ví dụ chiếu chậm 1 ngày): điền `gio_tap1_vn` của tập 1 trên dòng nền tảng đó. Để trống thì dùng giờ AniList.
- Lịch bị hoãn giữa chừng: điền `gio_cac_tap`, ví dụ `4|2026-11-05 19:00` nghĩa là từ tập 4 chiếu lúc đó, các tập sau tính tiếp mỗi tuần.

## Đường dẫn và SEO
- `js/lib/paths.js` quy định đường dẫn, `js/domain/seo.js` quy định tiêu đề, mô tả và dữ liệu có cấu trúc của từng trang.
- Thêm đường dẫn mới thì sửa cả `deploy/them-vao-htaccess.txt` và `appRoute` trong `scripts/serve.mjs`.
- `scripts/update.mjs` tạo `sitemap.xml`. Chỉ phim có bản tiếng Việt mới vào sitemap, phim chỉ có Engsub để noindex (xem `hasVietnameseRelease`).

## Kho toàn bộ anime của AniList
`apps-script/kho-anilist.gs` đưa toàn bộ anime của AniList vào tab `Kho AniList`. Tab này không lên website.

1. Dán file vào cùng dự án Apps Script rồi chạy `layKhoAniList` một lần. Script tự chạy tiếp từng đợt tới khi xong. Xong thì chạy `taoLichCapNhatKho` một lần để mỗi tuần tự thêm phim mới.
2. Tick cột `them` ở những phim cần dùng rồi chạy `themPhimDaChon`. Phim được thêm vào `Sheet1` với chữ `x` ở cột `an`, nên chưa lên web.
3. Ở `Sheet1`, điền `nen_tang`, `link_xem`, các cột khác nếu cần, rồi xóa chữ `x`.

## Tự điền link từng tập
Dán link playlist YouTube vào cột `link_xem`, script `apps-script/link-tap.gs` (chạy trong Google Sheet) tự tìm video, đọc số tập từ tiêu đề và điền vào cột `link_cac_tap` mỗi ngày. Script chỉ bổ sung tập còn thiếu nên link bạn sửa tay được giữ nguyên. Tập nào chưa có link riêng thì nút tập dùng link chung ở `link_xem`.

Website chỉ phát được trên trang khi có link từng tập, vì một số playlist không nhúng được. Dòng mới dán vào Sheet cần chạy `capNhatLinkTap` một lần, hoặc đợi lịch 7 giờ sáng. Không có khóa API thì RSS chỉ lấy 15 video mới nhất mỗi playlist.

Nếu playlist đánh số nối tiếp mùa trước (mùa 2 bắt đầu từ Tập 14), website hiện đúng số như YouTube. `scripts/update.mjs` tự nhận ra khi số tập lớn hơn tổng số tập của phim. Có thể điền cột `lech_tap`, ví dụ `13`, để chỉ định rõ.

FPT Play không cần `link_cac_tap`: `scripts/update.mjs` tự tạo link từng tập bằng cách thêm `/tap-<số tập>` vào link ở `link_xem`. Tập nào bạn điền tay trong `link_cac_tap` thì dùng link đó.

Netflix cũng vậy nếu `link_xem` là link xem **tập 1** dạng `https://www.netflix.com/watch/83050561`: tập 2 là số cuối + 1, tập 3 là + 2... Link dạng `/title/` không tạo được link từng tập. Nếu số tập trên Netflix không liền nhau, điền tập đó vào `link_cac_tap`.

Tập có link video YouTube riêng trong `link_cac_tap` sẽ phát ngay trên trang phim. Link playlist hoặc link kênh không nhúng được theo từng tập nên vẫn mở sang YouTube. Nếu chủ video tắt nhúng, người xem bấm nút "Mở trên YouTube" dưới khung phát.

Mỗi phim hiện dùng dòng đầu tiên tìm thấy (một nền tảng).

## Tìm kiếm
Ô tìm ở Theo mùa và trang Tìm Anime tìm theo tên trong Sheet (`ten_viet`), tên tiếng Anh và Romaji của AniList, có dấu hay không dấu đều được. Phim không có `ten_viet` thì chỉ tìm được bằng tên Anh hoặc Romaji.

## Tab Engsub
Phim có trong Sheet được `scripts/update.mjs` thêm các nền tảng lấy từ link streaming của AniList. Chúng nằm ở tab Engsub trên trang phim, giờ chiếu theo AniList, và không hiện trên thẻ phim. Bộ lọc Engsub cũng tìm thấy các phim này. AniList không cho biết phụ đề của từng link, nên một số link (nhất là YouTube) có thể không có tiếng Anh.

## Sửa thông tin chung
Mở `index.html`, tìm phần footer để đổi link Facebook và email liên hệ.

## Sửa giao diện
| Việc | Sửa ở đâu |
|---|---|
| Đổi màu, font | `css/tokens.css` |
| Đổi nhãn, icon | `js/config.js` |
| Thêm trang | Thêm file trong `js/views/`, một dòng trong `ROUTES` ở `js/app.js`, một link trong `index.html` |
| Thêm tooltip | Thêm `data-bs-title="..."` vào phần tử; nút chỉ có icon cần thêm `aria-label` |

Icon lấy từ Material Symbols, tên icon tra tại fonts.google.com/icons.

## Chạy thử trên máy (local)
Cần cài [Node.js](https://nodejs.org) (bản LTS, từ 18 trở lên).
1. `cap-nhat-local.bat` (Windows) hoặc `./cap-nhat-local.sh`: kéo dữ liệu thật từ Google Sheet + AniList về `data.js`. Link Sheet nằm trong `sheet-url.txt` (dòng đầu tiên).
2. `chay-local.bat` hoặc `./chay-local.sh`: mở website tại http://localhost:8080.
3. Sửa Sheet xong, chạy lại bước 1 rồi nhấn Ctrl+F5 trên trình duyệt. Sửa `index.html`, `css/` hoặc `js/` thì chỉ cần Ctrl+F5.
Giao diện dùng ES module nên phải mở qua máy chủ web như trên, không mở trực tiếp bằng cách nhấp đúp `index.html`.
Lưu ý: đợi khoảng 5 phút sau khi sửa Sheet vì Google cập nhật bản "Publish to web" chậm.

## Tự động lấy toàn bộ anime của mùa (mới)

Script `scripts/update.mjs` tự lấy **toàn bộ anime TV/ONA** của mùa trước, mùa hiện tại và mùa sau từ AniList, không cần dán từng phim vào Sheet.

- Phim **có trong Sheet** → dùng link/nền tảng/ngôn ngữ trong Sheet (cột `ngon_ngu` để trống = Vietsub; có thể ghi `Tiếng Việt`).
- Phim **không có trong Sheet** → tự hiện ở mọi tab, phụ đề **Engsub**, nền tảng lấy từ link streaming của AniList (không có thì dẫn về trang AniList).
- Muốn ẩn một phim: thêm dòng với `anilist_id` và điền bất kỳ ký tự nào vào cột `an`.
- Đổi các mùa lấy tự động: biến môi trường `SEASONS="fall-2026,winter-2027"`; tắt hẳn: `SEASONS=off`.
- Sheet trống vẫn chạy được (chỉ có Engsub).
