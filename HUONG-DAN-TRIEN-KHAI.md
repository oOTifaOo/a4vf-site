# Hướng dẫn triển khai A4VFamily (GitHub + Host.vn)

Mô hình hoạt động:
Google Sheet + AniList -> GitHub Actions (mỗi 6 giờ) -> cập nhật `data.js` trên GitHub -> Cron trên Host.vn tải `data.js` về website.
Giao diện (`index.html`, logo) chỉ cần tải lên host khi bạn sửa giao diện.

## Phần 1. Cập nhật mã nguồn trên GitHub

Repo của bạn đã chạy được workflow, nên chỉ cần thay file, không tạo lại.

1. Giải nén `a4vf-site.zip` trên máy.
2. Vào repo trên GitHub > **Add file > Upload files**.
3. Kéo vào các file/thư mục sau (ghi đè): `index.html`, `data.js`, `README.md`, `HUONG-DAN-TRIEN-KHAI.md`, thư mục `scripts/`, `data/`, `apps-script/`, `logos/`.
4. **KHÔNG upload `.github/workflows/update.yml`**: bản của bạn đang chứa link CSV riêng. Ghi đè là mất link.
5. Bấm **Commit changes**.
6. Vào **Actions > Cập nhật lịch chiếu > Run workflow**. Chờ dấu tích xanh.
7. Mở file `data.js` trên GitHub, kiểm tra có nhiều phim hơn trước (đã tự lấy cả mùa).
8. Nếu workflow báo lỗi "Permission denied to github-actions": **Settings > Actions > General > Workflow permissions > Read and write permissions > Save**.

Muốn thêm logo: bỏ file vào thư mục `logos/` (đúng tên trong `logos/README.txt`), commit, và tải thư mục này lên host (Phần 2, bước 4).

## Phần 2. Đưa lên Host.vn

### Bước 0. Quan trọng: đừng ghi đè WordPress
Website `a4vf.net` đang chạy WordPress trong `public_html`. Hãy đặt trang mới ở một **subdomain** (khuyên dùng), ví dụ `lich.a4vf.net`, để thử nghiệm mà không ảnh hưởng trang cũ.

### Bước 1. Tạo subdomain
- Đăng nhập trang quản trị hosting (cPanel hoặc DirectAdmin) > **Subdomains** > tạo `lich` cho `a4vf.net`.
- Ghi lại thư mục gốc của nó (thường `public_html/lich` hoặc `domains/a4vf.net/public_html/lich`).
- Nếu DNS a4vf.net do Host.vn quản lý, subdomain tự hoạt động. Nếu DNS đặt ở nơi khác (Cloudflare...), thêm bản ghi **A** cho `lich` trỏ tới IP hosting.

### Bước 2. Bật HTTPS
- Trong panel: **SSL/TLS** hoặc **Let's Encrypt** > cấp chứng chỉ cho `lich.a4vf.net`. Chờ vài phút.

### Bước 3. Tải file website lên
- Vào **File Manager** > mở thư mục gốc của subdomain.
- Upload `a4vf-host.zip` rồi **Extract**. Gồm: `index.html`, `data.js`, `.htaccess`, `logos/`.
- Bật hiển thị file ẩn (Show hidden files) để thấy `.htaccess`.

### Bước 4. Cập nhật tự động data.js bằng Cron
Repo GitHub phải ở chế độ **Public** (script tải qua raw.githubusercontent.com).

1. Upload `cap-nhat-data.sh` vào thư mục gốc tài khoản hosting (ngoài `public_html`).
2. Mở file, sửa 2 dòng:
   - `REPO_RAW`: thay `TENGITHUB` bằng tên tài khoản GitHub của bạn (nhánh `main`).
   - `DEST`: đường dẫn tuyệt đối tới `data.js` của subdomain, ví dụ `/home/TENTAIKHOAN/public_html/lich/data.js` (xem đường dẫn trong File Manager).
3. Panel > **Cron Jobs** > thêm lệnh, chạy mỗi 30 phút (hoặc mỗi giờ):
   `sh /home/TENTAIKHOAN/cap-nhat-data.sh`
   Lịch: `*/30 * * * *`
4. Bấm chạy thử một lần, kiểm tra thông báo "Đã cập nhật data.js" hoặc "Không có thay đổi".

### Bước 5. Kiểm tra
- Mở `https://lich.a4vf.net`: thấy lịch chiếu, danh sách theo mùa, poster, trang chi tiết.
- Mở một trang phim, tải lại bằng F5: trang vẫn hiện (website dùng `#` nên không cần cấu hình đặc biệt).
- Thử ☆ Theo dõi, bộ lọc "Phim của tôi" và bộ lọc phụ đề.
- Mở bằng điện thoại.
- Sau 6 giờ (hoặc bấm Run workflow rồi chờ tới lần cron kế tiếp), kiểm tra `data.js` trên host đã đổi.

### Bước 6. Chuyển trang cũ sang trang mới (khi đã ưng ý)
Chọn một trong hai:
- **Đơn giản:** trong WordPress, sửa menu "Lịch chiếu" trỏ tới `https://lich.a4vf.net`.
- **Chuyển hướng:** thêm vào `.htaccess` của WordPress (trước dòng `# BEGIN WordPress`):
  `Redirect 301 /lich-chieu/ https://lich.a4vf.net/`

## Phần 3. Khi cần cập nhật về sau

| Việc | Cách làm |
|---|---|
| Thêm/sửa link phim, nền tảng | Sửa Google Sheet. Tự cập nhật trong tối đa 6 giờ + chu kỳ cron |
| Cập nhật ngay | GitHub > Actions > Run workflow, sau đó chạy Cron thủ công trên host |
| Thêm logo | Bỏ file vào `logos/` trên host (và trên GitHub để lưu trữ) |
| Sửa giao diện | Thay `index.html` trên host |
| Ẩn một phim | Thêm dòng `anilist_id` của phim vào Sheet, điền `x` vào cột `an` |

## Xử lý lỗi thường gặp

- **Trang trắng hoặc không có phim:** `data.js` thiếu hoặc lỗi. Mở `https://lich.a4vf.net/data.js` kiểm tra; chạy lại Cron.
- **Cron báo "Tải lỗi":** repo đang Private hoặc `REPO_RAW` sai tên/nhánh.
- **Poster không hiện:** ảnh lấy từ AniList; kiểm tra mạng, thử tải lại. Nếu bị chặn hàng loạt, báo lại để chuyển sang lưu poster trên host.
- **Logo hiện hình tròn chữ viết tắt:** tên file chưa khớp với tên nền tảng trong Sheet (xem `logos/README.txt`).
- **Giao diện cũ sau khi cập nhật:** xóa cache trình duyệt (Ctrl+F5). File `.htaccess` đã đặt cache ngắn cho `data.js`.

## Phương án khác (nếu muốn nhanh hơn và không cần Cron)
Đưa thẳng repo lên **Cloudflare Pages** hoặc **GitHub Pages** (miễn phí): mỗi lần Actions cập nhật `data.js`, website tự cập nhật, không cần Cron trên Host.vn. Trỏ subdomain `lich` bằng bản ghi CNAME tới địa chỉ do dịch vụ cấp. Nếu muốn dùng, báo tôi để hướng dẫn chi tiết.
