// Nhận Báo lỗi và Hòm thư góp ý từ website rồi ghi vào spreadsheet.
// Tạo trong MỘT spreadsheet riêng: Extensions -> Apps Script, dán file này, Lưu,
// rồi Deploy -> New deployment -> Web app, Execute as: Me, Who has access: Anyone.
// Dán đường dẫn kết thúc bằng /exec vào REPORT_ENDPOINT trong js/config.js.
// KHÔNG dán vào dự án của Datasheet: file đó đang xuất bản ra web, và tên hằng số có thể trùng.

const BL_SHEET_ID = "";            // để trống là dùng spreadsheet chứa script này
const BL_TAB = "Báo lỗi";
const BL_SITE = "https://a4vf.net";
const BL_LIMIT_PER_HOUR = 60;      // vượt quá thì tạm từ chối, chống spam làm đầy sheet
const BL_DUPLICATE_SECONDS = 600;  // cùng nội dung trong 10 phút chỉ ghi một lần
const BL_STATUSES = ["Mới", "Đang xử lý", "Đã xong", "Bỏ qua"];
const BL_COLUMNS = ["Thời gian", "Nguồn", "Loại", "Mã AniList", "Tên phim", "Tập", "Nền tảng", "Nội dung", "Link trang", "Trạng thái"];

// Phải khớp với REPORT_FORMS trong js/config.js.
const BL_SOURCES = {
  phim: {
    label: "Báo lỗi phim",
    types: { "thieu-tap": "Thiếu tập", "sai-lich": "Sai lịch chiếu", "link-loi": "Link hỏng hoặc sai", "sai-thong-tin": "Sai thông tin phim", "khac": "Khác" },
  },
  chung: {
    label: "Hòm thư góp ý",
    types: { "thieu-anime": "Thiếu anime", "phu-de": "Góp ý phụ đề", "website": "Lỗi website", "gop-y": "Góp ý khác" },
  },
};

function blTraLoi(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Mở đường dẫn /exec trên trình duyệt để kiểm tra script còn chạy.
function doGet() {
  return blTraLoi({ ok: true });
}

// Bỏ ký tự điều khiển, cắt độ dài, và thêm dấu ' để ô chữ không bị Sheets hiểu là công thức.
function blChu(value, max) {
  const text = String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ").trim().slice(0, max);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function blKiemTra(body) {
  const source = BL_SOURCES[body.source];
  const type = source && source.types[body.type];
  if (!type) return null;
  const showId = /^\d{1,9}$/.test(String(body.showId)) ? String(body.showId) : "";
  const episode = /^\d{1,4}$/.test(String(body.episode)) ? String(body.episode) : "";
  const path = /^\/[\w\-./%]*$/.test(String(body.path)) ? String(body.path).slice(0, 200) : "/";
  const row = {
    source: source.label, type: type, showId: showId, title: blChu(body.title, 120), episode: episode,
    platform: blChu(body.platform, 60), note: blChu(body.note, 500), page: BL_SITE + path,
  };
  return row.title || row.note ? row : null;
}

function blVuotGioiHan(cache) {
  const key = "dem-" + Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMddHH");
  const count = Number(cache.get(key)) || 0;
  if (count >= BL_LIMIT_PER_HOUR) return true;
  cache.put(key, String(count + 1), 3700);
  return false;
}

function blLaTrung(cache, row) {
  const raw = [row.type, row.showId, row.title, row.episode, row.platform, row.note].join("|");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  const key = "trung-" + Utilities.base64EncodeWebSafe(digest);
  if (cache.get(key)) return true;
  cache.put(key, "1", BL_DUPLICATE_SECONDS);
  return false;
}

function blLayTab() {
  const book = BL_SHEET_ID ? SpreadsheetApp.openById(BL_SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(BL_TAB);
  if (sheet) return sheet;
  sheet = book.insertSheet(BL_TAB);
  sheet.getRange(1, 1, 1, BL_COLUMNS.length).setValues([BL_COLUMNS]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(BL_STATUSES, true).build();
  sheet.getRange(2, BL_COLUMNS.length, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, BL_COLUMNS.length).setNumberFormat("@").setVerticalAlignment("top");
  sheet.setColumnWidth(5, 240);
  sheet.setColumnWidth(8, 360);
  return sheet;
}

function blGhi(row) {
  const time = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
  blLayTab().appendRow([time, row.source, row.type, row.showId, row.title, row.episode, row.platform, row.note, row.page, BL_STATUSES[0]]);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return blTraLoi({ ok: false, error: "invalid" });
  }
  if (body.website) return blTraLoi({ ok: true }); // ô bẫy: bot điền vào thì bỏ qua, vẫn trả lời như thành công
  const row = blKiemTra(body);
  if (!row) return blTraLoi({ ok: false, error: "invalid" });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const cache = CacheService.getScriptCache();
    if (blLaTrung(cache, row)) return blTraLoi({ ok: true });
    if (blVuotGioiHan(cache)) return blTraLoi({ ok: false, error: "busy" });
    blGhi(row);
    return blTraLoi({ ok: true });
  } catch (err) {
    console.error(err);
    return blTraLoi({ ok: false, error: "server" });
  } finally {
    lock.releaseLock();
  }
}

// Chạy một lần trong trình sửa script để cấp quyền và tạo tab Báo lỗi.
function blChuanBi() {
  blLayTab();
}
