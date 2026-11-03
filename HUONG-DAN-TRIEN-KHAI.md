# Hướng dẫn triển khai A4VFamily (GitHub + Host.vn)

Mô hình hoạt động:
Google Sheet + AniList -> GitHub Actions (mỗi 6 giờ) -> cập nhật `data.js` trên GitHub -> GitHub Pages phục vụ `data.js` -> website trên host đọc thẳng từ GitHub Pages. Không cần Cron.
Giao diện (`index.html`, `css/`, `js/`, logo) chỉ cần tải lên host khi bạn sửa giao diện.

## Phần 1. Cập nhật mã nguồn trên GitHub

Repo của bạn đã chạy được workflow, nên chỉ cần thay file, không tạo lại.

1. Giải nén `a4vf-site.zip` ra một thư mục riêng.
2. Vào repo trên GitHub > **Add file > Upload files**.
3. Kéo vào các file/thư mục sau (ghi đè): `index.html`, `README.md`, `HUONG-DAN-TRIEN-KHAI.md`, thư mục `css/`, `js/`, `scripts/`, `apps-script/`, `logos/`.
   **KHÔNG upload `data.js` trong zip**: đó là dữ liệu mẫu, sẽ đè lên dữ liệu thật.
4. **KHÔNG upload `.github/workflows/update.yml`**: bản của bạn đang chứa link CSV riêng. Ghi đè là mất link.
5. Bấm **Commit changes**.
6. Vào **Actions > Cập nhật lịch chiếu > Run workflow**. Chờ dấu tích xanh.
7. Mở file `data.js` trên GitHub, kiểm tra có nhiều phim hơn trước (đã tự lấy cả mùa).
8. Nếu workflow báo lỗi "Permission denied to github-actions": **Settings > Actions > General > Workflow permissions > Read and write permissions > Save**.

Muốn thêm logo: bỏ file vào thư mục `logos/` (đúng tên trong `logos/README.txt`), commit, và tải thư mục này lên host (Phần 2, bước 4).

## Phần 2. Đưa lên Host.vn

### Bước 0. Sao lưu trước khi đụng vào public_html
Website đặt thẳng trong `public_html`, cùng chỗ với WordPress. Hãy tạo bản sao lưu toàn bộ `public_html` và tải về `.htaccess` hiện tại trước khi làm.

### Bước 1. Tải file website lên
- Vào **File Manager** > mở `public_html`.
- Upload `a4vf-host.zip` rồi **Extract**. Gồm: `index.html`, `css/`, `js/`, `logos/`.
- Gói này cố ý không có `.htaccess` và `data.js`, nên không đụng cấu hình WordPress và dữ liệu đang có.
- Nếu `public_html` đã có thư mục `css/`, `js/` hoặc `logos/` của trang cũ, dừng lại kiểm tra trước khi ghi đè.

### Bước 2. Sửa .htaccess của WordPress
Bật hiển thị file ẩn, mở `.htaccess` trong `public_html`, dán đoạn sau lên **trên** dòng `# BEGIN WordPress`, không sửa phần còn lại:

    DirectoryIndex index.html index.php
    <IfModule mod_headers.c>
      <FilesMatch "\.(html|js|css)$">
        Header set Cache-Control "no-cache"
      </FilesMatch>
    </IfModule>

### Bước 3. Bật GitHub Pages cho data.js
Repo GitHub phải ở chế độ **Public**.
1. Vào repo > **Settings > Pages**. Ở **Source** chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`, bấm **Save**.
2. Chờ 1-2 phút, mở `https://TENGITHUB.github.io/TENREPO/data.js` thấy nội dung bắt đầu bằng `const SEASONS` hoặc `/* Tạo tự động` là được.
3. Trong `js/config.js` điền địa chỉ đó vào `REMOTE_DATA_URL`, rồi tải lại file này lên host và GitHub.
4. Tải `data.js` thật trên máy bạn lên `public_html` để làm bản dự phòng khi GitHub Pages lỗi. Bản này không tự cập nhật.

**Quay lại trang cũ khi cần:** đổi tên `index.html` trong `public_html` thành `index-moi.html`, trang chủ WordPress sẽ hiện lại.

### Bước 4. Kiểm tra
- Mở `https://a4vf.net`: thấy lịch chiếu, danh sách theo mùa, poster, trang chi tiết.
- Mở một trang phim, tải lại bằng F5: trang vẫn hiện (website dùng `#` nên không cần cấu hình đặc biệt).
- Thử sao Theo dõi, bộ lọc "Phim của tôi" và bộ lọc phụ đề.
- Mở bằng điện thoại.
- Bấm Run workflow, chờ khoảng 2 phút rồi tải lại trang: dữ liệu mới phải hiện ra.

## Phần 3. Khi cần cập nhật về sau

| Việc | Cách làm |
|---|---|
| Thêm/sửa link phim, nền tảng | Sửa Google Sheet. Tự cập nhật trong tối đa 6 giờ |
| Cập nhật ngay | GitHub > Actions > Run workflow, chờ khoảng 2 phút |
| Thêm logo | Bỏ file vào `logos/` trên host (và trên GitHub để lưu trữ) |
| Sửa giao diện | Thay `index.html`, `css/`, `js/` trên host |
| Ẩn một phim | Thêm dòng `anilist_id` của phim vào Sheet, điền `x` vào cột `an` |

## Xử lý lỗi thường gặp

- **Trang báo không tải được dữ liệu:** kiểm tra `REMOTE_DATA_URL` trong `js/config.js`, mở thử địa chỉ đó trên trình duyệt, và kiểm tra `public_html` có `data.js` dự phòng.
- **Trang chỉ hiện vòng xoay tải:** thiếu thư mục `js/` trên host, hoặc đang mở file bằng cách nhấp đúp thay vì qua website.
- **Địa chỉ GitHub Pages báo 404:** repo đang Private, hoặc chưa bật Pages, hoặc sai tên repo.
- **Poster không hiện:** ảnh lấy từ AniList; kiểm tra mạng, thử tải lại. Nếu bị chặn hàng loạt, báo lại để chuyển sang lưu poster trên host.
- **Logo hiện hình tròn chữ viết tắt:** tên file chưa khớp với tên nền tảng trong Sheet (xem `logos/README.txt`).
- **Giao diện cũ sau khi cập nhật:** xóa cache trình duyệt (Ctrl+F5). File `.htaccess` đã đặt cache ngắn cho `data.js`.

## Cập nhật SEO (bản tĩnh, đường dẫn thật)
Web chuyển từ `#phim-123` sang trang thật như `/phim/123-ten-phim`, `/mua/thu-2026`, `/nen-tang/netflix`. Mỗi lần dữ liệu đổi, GitHub Actions dựng lại toàn bộ trang HTML rồi đưa lên host, nên công cụ tìm kiếm đọc được nội dung mà không cần chạy JavaScript. Link `#...` cũ tự chuyển sang link mới.

1. **Sao lưu:** tải về máy `.htaccess`, `index.html` và hai thư mục `js`, `css` trong `public_html`.
2. **GitHub:** vào Settings -> Secrets and variables -> Actions. Tab Secrets: thêm `FTP_HOST`, `FTP_USER`, `FTP_PASS`. Tab Variables: thêm `DEPLOY_TARGET` với giá trị `ftp`. Làm bước này trước khi tải code lên.
3. **Host:** dán nội dung `deploy/them-vao-htaccess.txt` lên đầu `.htaccess` trong `public_html` (chưa có thì tạo mới).
4. **GitHub:** tải toàn bộ nội dung `a4vf-seo-github.zip` lên repo, gồm cả `.github/workflows/build-site.yml`. Workflow "Dựng website" sẽ tự chạy; nếu không, vào Actions và bấm Run workflow. Nếu lỗi ở bước FTP, kiểm tra lại secret và đường dẫn `public_html/` trong workflow.
5. Kiểm tra `https://a4vf.net/robots.txt`, `https://a4vf.net/sitemap.xml`, `https://a4vf.net/mua/thu-2026` và một trang phim. Xem nguồn trang (Ctrl+U) phải thấy tên phim trong HTML.
6. Khai báo sitemap với Google Search Console và Bing Webmaster Tools. Brave không có công cụ quản trị, gửi trang chủ tại `search.brave.com/submit-url`.

Quay lại bản cũ: xóa khối `# BEGIN A4VFamily` trong `.htaccess`, tắt workflow "Dựng website", rồi tải lại bản `index.html` và thư mục `js`, `css` đã sao lưu.

## Bật Báo lỗi và Hòm thư góp ý

Khi `REPORT_ENDPOINT` còn trống, web thật tự ẩn nút báo lỗi và mục Hòm thư góp ý, nên có thể deploy trước rồi bật sau.

1. Tạo một Google Sheet **mới**, không dùng file Datasheet.
2. Trong file đó, chọn Extensions -> Apps Script, xóa code mẫu, dán toàn bộ `apps-script/bao-loi.gs`, bấm Lưu.
3. Chọn hàm `blChuanBi`, bấm Run, cấp quyền. Sheet sẽ có tab **Báo lỗi**.
4. Chọn Deploy -> New deployment -> Web app. Execute as: **Me**. Who has access: **Anyone**. Bấm Deploy, sao chép đường dẫn kết thúc bằng `/exec`.
5. Dán đường dẫn vào `REPORT_ENDPOINT` trong `js/config.js`, rồi deploy website.
6. Gửi thử một báo lỗi trên web và xem dòng mới trong tab Báo lỗi.

Khi sửa script: Deploy -> Manage deployments -> Edit -> Version: New version. Làm vậy đường dẫn `/exec` không đổi. Nếu sửa danh sách loại lỗi, hãy sửa cả `REPORT_FORMS` trong `js/config.js` và `BL_SOURCES` trong script.
