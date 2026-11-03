// Kho toàn bộ anime của AniList, nằm ở một tab riêng và KHÔNG tự lên website.
// Muốn đưa phim nào lên web: tick ô "them" rồi chạy hàm themPhimDaChon.
//
// Cách dùng:
// 1. Dán file này vào cùng dự án Apps Script, bấm Lưu.
// 2. Chạy hàm layKhoAniList một lần. Script tự chạy tiếp từng đợt tới khi xong.
// 3. Sau khi xong, chạy taoLichCapNhatKho một lần để tự thêm phim mới mỗi tuần.

const KHO_SHEET_ID = "14Vzk3IeLlagP2YEm7LaGZRnoYcl5kHGPj4VzF5weT30";
const KHO_TAB = "Kho AniList";
const KHO_TAB_CHINH = "Sheet1";        // tab đang cấp dữ liệu cho website
const KHO_NAM_DAU = 1917;              // năm sớm nhất cần quét
const KHO_NGHI_MS = 2200;              // AniList cho khoảng 30 lượt gọi mỗi phút
const KHO_GIOI_HAN_MS = 4.5 * 60 * 1000; // dừng trước giới hạn 6 phút của Apps Script
const KHO_HAN_THU_LAI_MS = 5 * 60 * 1000; // sau mốc này không chờ thử lại nữa
const KHO_PHUT_CHO_LOI = 10;           // AniList lỗi: đợi chừng này phút rồi chạy tiếp
const KHO_SO_DOT_LOI = 6;              // lỗi liền chừng này đợt thì dừng và báo
const KHO_COT = ["them", "anilist_id", "ten_romaji", "ten_tieng_anh", "nam", "mua", "dinh_dang", "so_tap", "link_anilist"];
const KHO_QUERY = `query($page:Int,$from:FuzzyDateInt,$to:FuzzyDateInt){
  Page(page:$page,perPage:50){pageInfo{hasNextPage}
    media(type:ANIME,isAdult:false,format_not:MUSIC,startDate_greater:$from,startDate_lesser:$to,sort:START_DATE){
      id format season episodes startDate{year} title{romaji english}}}}`;

function khoGoiAniList(nam, trang, han) {
  // AniList giới hạn 5000 kết quả mỗi truy vấn, nên quét theo từng năm.
  const payload = JSON.stringify({
    query: KHO_QUERY,
    variables: { page: trang, from: (nam - 1) * 10000 + 1231, to: (nam + 1) * 10000 },
  });
  let loi = "";
  for (let lan = 1; lan <= 4; lan++) {
    let cho = 5000 * lan;
    try {
      const res = UrlFetchApp.fetch("https://graphql.anilist.co", {
        method: "post", contentType: "application/json", muteHttpExceptions: true, payload,
      });
      const ma = res.getResponseCode();
      if (ma === 200) return JSON.parse(res.getContentText()).data.Page;
      loi = "AniList trả mã " + ma + ": " + res.getContentText().slice(0, 200);
      if (ma === 429) cho = 65000; // vượt giới hạn: chờ qua phút sau
    } catch (e) {
      loi = String(e.message || e); // lỗi mạng, ví dụ Address unavailable
    }
    if (Date.now() + cho > han) break; // không đủ thời gian chờ trong đợt này
    Utilities.sleep(cho);
  }
  throw new Error(loi);
}

function khoLayTab() {
  const ss = SpreadsheetApp.openById(KHO_SHEET_ID);
  let sh = ss.getSheetByName(KHO_TAB);
  if (!sh) {
    sh = ss.insertSheet(KHO_TAB);
    sh.getRange(1, 1, 1, KHO_COT.length).setValues([KHO_COT]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function khoDaCo(sh) {
  const cuoi = sh.getLastRow();
  if (cuoi < 2) return new Set();
  return new Set(sh.getRange(2, 2, cuoi - 1, 1).getValues().map((r) => Number(r[0])));
}

function khoGhi(sh, dong) {
  if (!dong.length) return;
  const dau = sh.getLastRow() + 1;
  sh.getRange(dau, 1, dong.length, KHO_COT.length).setValues(dong);
  sh.getRange(dau, 1, dong.length, 1).insertCheckboxes();
}

function khoXoaLich(tenHam) {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === tenHam && t.getEventType() === ScriptApp.EventType.CLOCK)
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

// Thêm menu "Kho AniList" nếu dự án Apps Script được mở từ Google Sheet (Tiện ích mở rộng).
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Kho AniList")
    .addItem("Thêm phim đã tick vào tab chính", "themPhimDaChon")
    .addToUi();
}

// Quét từ chỗ đã dừng. Hết thời gian thì tự hẹn chạy tiếp sau 1 phút.
function layKhoAniList() {
  const batDau = Date.now();
  const luu = PropertiesService.getScriptProperties();
  const sh = khoLayTab();
  const daCo = khoDaCo(sh);
  const namCuoi = new Date().getFullYear() + 2;
  let nam = Number(luu.getProperty("KHO_NAM")) || KHO_NAM_DAU;
  let trang = Number(luu.getProperty("KHO_TRANG")) || 1;
  let them = 0;

  khoXoaLich("layKhoAniList");
  while (nam <= namCuoi) {
    if (Date.now() - batDau > KHO_GIOI_HAN_MS) {
      ScriptApp.newTrigger("layKhoAniList").timeBased().after(60 * 1000).create();
      console.log("Đã thêm " + them + " phim, dừng ở năm " + nam + ", tự chạy tiếp sau 1 phút.");
      return;
    }
    let page;
    try {
      page = khoGoiAniList(nam, trang, batDau + KHO_HAN_THU_LAI_MS);
    } catch (e) {
      const soLoi = (Number(luu.getProperty("KHO_LOI")) || 0) + 1;
      luu.setProperty("KHO_LOI", String(soLoi));
      if (soLoi >= KHO_SO_DOT_LOI) {
        luu.deleteProperty("KHO_LOI");
        throw new Error("Không kết nối được AniList sau " + soLoi + " đợt. Tiến độ đã lưu, chạy lại layKhoAniList để tiếp tục. Lỗi: " + e.message);
      }
      ScriptApp.newTrigger("layKhoAniList").timeBased().after(KHO_PHUT_CHO_LOI * 60 * 1000).create();
      console.log("Lỗi ở năm " + nam + " trang " + trang + " (" + e.message + "). Thử lại sau " + KHO_PHUT_CHO_LOI + " phút, đợt lỗi thứ " + soLoi + ".");
      return;
    }
    const moi = page.media.filter((m) => !daCo.has(m.id));
    moi.forEach((m) => daCo.add(m.id));
    khoGhi(sh, moi.map((m) => [
      false, m.id, m.title.romaji || "", m.title.english || "", m.startDate.year || nam,
      m.season || "", m.format || "", m.episodes || "", "https://anilist.co/anime/" + m.id,
    ]));
    them += moi.length;
    if (page.pageInfo.hasNextPage) trang++;
    else { nam++; trang = 1; }
    // Lưu sau mỗi trang để lần sau chạy tiếp đúng chỗ.
    luu.setProperties({ KHO_NAM: String(nam), KHO_TRANG: String(trang), KHO_LOI: "0" });
    Utilities.sleep(KHO_NGHI_MS);
  }
  // Lần sau chỉ quét lại các năm gần đây để lấy phim mới.
  luu.setProperties({ KHO_NAM: String(new Date().getFullYear() - 1), KHO_TRANG: "1" });
  console.log("Xong. Lần này thêm " + them + " phim, tổng cộng " + daCo.size + " phim trong kho.");
}

// Đưa các phim đã tick sang tab chính, kèm chữ x ở cột an để phim chưa lên web.
// Điền nen_tang, link_xem xong thì xóa chữ x.
function themPhimDaChon() {
  const ss = SpreadsheetApp.openById(KHO_SHEET_ID);
  const kho = ss.getSheetByName(KHO_TAB), chinh = ss.getSheetByName(KHO_TAB_CHINH);
  if (!kho || !chinh) throw new Error("Không tìm thấy tab " + KHO_TAB + " hoặc " + KHO_TAB_CHINH);
  const cuoi = kho.getLastRow();
  if (cuoi < 2) return;

  const head = chinh.getRange(1, 1, 1, chinh.getLastColumn()).getValues()[0].map((s) => String(s).trim().toLowerCase());
  const cId = head.indexOf("anilist_id");
  const cAn = head.indexOf("an");
  if (cId < 0 || cAn < 0) throw new Error("Tab chính thiếu cột anilist_id hoặc an");
  const coSan = new Set(chinh.getRange(1, cId + 1, chinh.getLastRow(), 1).getValues().map((r) => Number(r[0])));

  const hang = kho.getRange(2, 1, cuoi - 1, 2).getValues();
  let them = 0, trung = 0;
  hang.forEach((r, i) => {
    if (r[0] !== true) return;
    const id = Number(r[1]);
    if (coSan.has(id)) trung++;
    else {
      const dong = new Array(head.length).fill("");
      dong[cId] = id;
      dong[cAn] = "x";
      chinh.appendRow(dong);
      coSan.add(id);
      them++;
    }
    kho.getRange(i + 2, 1).setValue(false);
  });
  console.log("Đã thêm " + them + " phim sang " + KHO_TAB_CHINH + ", bỏ qua " + trung + " phim đã có.");
}

// Chạy MỘT lần, sau khi quét xong, để mỗi thứ Hai tự thêm phim mới vào kho.
function taoLichCapNhatKho() {
  khoXoaLich("capNhatKhoHangTuan");
  ScriptApp.newTrigger("capNhatKhoHangTuan").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
}

function capNhatKhoHangTuan() {
  layKhoAniList();
}
