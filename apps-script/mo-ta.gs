// Tự điền cột mo_ta (nội dung phim tiếng Việt) cho các dòng đang để trống.
// Cách hoạt động: lấy mô tả tiếng Anh từ AniList rồi dịch máy sang tiếng Việt bằng LanguageApp của Google.
// Bản dịch máy chỉ là bản nháp: bạn sửa lại trong Sheet thì script KHÔNG ghi đè (chỉ điền ô trống).
// Dán file này vào cùng dự án Apps Script, chạy hàm dichMoTa (hoặc taoLichChayMoTa để chạy hằng ngày).

const MT_SHEET_ID = "14Vzk3IeLlagP2YEm7LaGZRnoYcl5kHGPj4VzF5weT30";
const MT_TAB = "Sheet1";
const MT_MAX = 25; // số phim xử lý mỗi lần chạy (tránh quá thời gian của Apps Script)

function dichMoTa() {
  const sh = SpreadsheetApp.openById(MT_SHEET_ID).getSheetByName(MT_TAB);
  if (!sh) throw new Error("Không tìm thấy tab " + MT_TAB);
  const lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  const head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map((s) => String(s).trim().toLowerCase());
  const cId = head.indexOf("anilist_id"), cMo = head.indexOf("mo_ta");
  if (cId < 0) throw new Error("Thiếu cột anilist_id");
  if (cMo < 0) throw new Error("Thiếu cột mo_ta. Hãy thêm một cột có tiêu đề đúng là mo_ta.");
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const cache = {}; // một anilist_id có nhiều dòng (nhiều nền tảng) chỉ dịch một lần
  let done = 0;
  for (let i = 0; i < rows.length && done < MT_MAX; i++) {
    const id = Number(rows[i][cId]);
    if (!Number.isInteger(id) || id <= 0 || String(rows[i][cMo]).trim()) continue;
    if (!(id in cache)) {
      cache[id] = layMoTaViet(id);
      done++;
      Utilities.sleep(800); // tôn trọng giới hạn của AniList
    }
    if (cache[id]) sh.getRange(i + 2, cMo + 1).setValue(cache[id]);
  }
  Logger.log("Đã dịch %s phim.", done);
}

function layMoTaViet(id) {
  const q = "query($id:Int){Media(id:$id,type:ANIME){description(asHtml:false)}}";
  const res = UrlFetchApp.fetch("https://graphql.anilist.co", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    payload: JSON.stringify({ query: q, variables: { id: id } }),
  });
  if (res.getResponseCode() !== 200) return "";
  const m = JSON.parse(res.getContentText()).data;
  let t = String((m && m.Media && m.Media.description) || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length > 600) t = t.slice(0, 597).replace(/\s+\S*$/, "") + "…";
  try { return LanguageApp.translate(t, "en", "vi"); } catch (e) { return ""; }
}

function taoLichChayMoTa() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "dichMoTa").forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("dichMoTa").timeBased().everyDays(1).atHour(5).create();
}
