// Tự điền link từng tập vào Sheet từ link playlist YouTube.
// Dán file này vào CÙNG dự án Apps Script đã có (Extensions -> Apps Script), bấm Lưu.
// Không cần khóa API: mặc định dùng RSS của YouTube (tối đa 15 video mới nhất mỗi playlist).
// Muốn lấy đủ mọi tập (playlist dài): thêm khóa YouTube Data API v3 vào
// Project Settings -> Script properties, tên YT_API_KEY.

const SHEET_ID = "14Vzk3IeLlagP2YEm7LaGZRnoYcl5kHGPj4VzF5weT30";
const TAB_LINKS = "Sheet1";          // tab chứa bảng link của bạn
const COT_PLAYLIST = "link_xem";     // cột chứa link playlist
const COT_TAP = "link_cac_tap";      // cột script sẽ tự điền (tự tạo nếu chưa có)

function layPlaylistId(url) {
  const m = /[?&]list=([A-Za-z0-9_-]+)/.exec(String(url || ""));
  return m ? m[1] : null;
}

function giaiMaXml(s) {
  return String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// Đọc số tập từ tiêu đề video: "Tập 05", "Episode 5", "EP.5", "#5", hoặc số đứng riêng ở cuối.
function laySoTap(title) {
  const t = String(title || "");
  let m = /(?:tập|tap|episode|ep\.?|#)\s*0*(\d{1,3})\b/i.exec(t);
  if (m) return Number(m[1]);
  const re = /(?:^|[\s\-–|\[(])0*(\d{1,3})(?=$|[\s\-–|\])])/g;
  let last = null, mm;
  while ((mm = re.exec(t))) {
    const truoc = t.slice(0, mm.index).trim().toLowerCase();
    if (/(season|mùa|phần|part|s)$/.test(truoc)) continue; // bỏ "Season 2", "Phần 3"
    last = Number(mm[1]);
  }
  return last;
}

function docRss(id) {
  const res = UrlFetchApp.fetch("https://www.youtube.com/feeds/videos.xml?playlist_id=" + id, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("RSS lỗi " + res.getResponseCode() + " cho playlist " + id);
  const xml = res.getContentText(), out = [], re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml))) {
    const v = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(m[1]);
    const t = /<title>([^<]*)<\/title>/.exec(m[1]);
    if (v) out.push({ videoId: v[1], title: giaiMaXml(t ? t[1] : ""), viTri: null });
  }
  return out;
}

function docApi(id, key) {
  const out = [];
  let token = "";
  for (let i = 0; i < 20; i++) {
    const url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=" +
      id + "&key=" + key + (token ? "&pageToken=" + token : "");
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error("API lỗi " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200));
    const j = JSON.parse(res.getContentText());
    for (const it of j.items || []) {
      out.push({ videoId: it.snippet.resourceId.videoId, title: it.snippet.title, viTri: it.snippet.position });
    }
    token = j.nextPageToken || "";
    if (!token) break;
  }
  return out;
}

function docCell(text) {
  const map = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = /^\s*(\d{1,3})\s*[|=]\s*(\S+)\s*$/.exec(line);
    if (m) map[Number(m[1])] = m[2];
  }
  return map;
}

function ghiCell(map) {
  return Object.keys(map).map(Number).sort((a, b) => a - b).map((k) => k + "|" + map[k]).join("\n");
}

// Chỉ BỔ SUNG tập còn thiếu, không ghi đè link bạn đã sửa tay.
function capNhatLinkTap() {
  const key = PropertiesService.getScriptProperties().getProperty("YT_API_KEY");
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_LINKS);
  if (!sh) throw new Error("Không tìm thấy tab " + TAB_LINKS);
  const lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map((s) => String(s).trim().toLowerCase());
  const cPl = header.indexOf(COT_PLAYLIST);
  if (cPl < 0) throw new Error("Thiếu cột " + COT_PLAYLIST);
  let cTap = header.indexOf(COT_TAP);
  if (cTap < 0) {
    cTap = lastCol;
    sh.getRange(1, cTap + 1).setValue(COT_TAP);
  }
  const rows = sh.getRange(2, 1, lastRow - 1, Math.max(lastCol, cTap + 1)).getValues();
  let them = 0, boQua = 0;
  rows.forEach((r, i) => {
    const id = layPlaylistId(r[cPl]);
    if (!id) return;
    let videos;
    try {
      videos = key ? docApi(id, key) : docRss(id);
    } catch (e) {
      console.error("Dòng " + (i + 2) + ": " + e.message);
      return;
    }
    const map = docCell(r[cTap]);
    const truoc = Object.keys(map).length;
    for (const v of videos) {
      let ep = laySoTap(v.title);
      if (ep == null && v.viTri != null) ep = v.viTri + 1; // dự phòng: theo thứ tự trong playlist (chỉ khi dùng API)
      if (ep == null) { boQua++; console.warn("Không đọc được số tập: " + v.title); continue; }
      if (!map[ep]) map[ep] = "https://www.youtube.com/watch?v=" + v.videoId + "&list=" + id;
    }
    if (Object.keys(map).length !== truoc) {
      sh.getRange(i + 2, cTap + 1).setNumberFormat("@").setValue(ghiCell(map));
      them += Object.keys(map).length - truoc;
    }
    Utilities.sleep(500);
  });
  console.log("Đã thêm " + them + " link tập mới, bỏ qua " + boQua + " video không đọc được số tập.");
}

// Chạy MỘT lần để bật lịch tự động hằng ngày (7 giờ sáng).
function taoLichChayLinkTap() {
  ScriptApp.newTrigger("capNhatLinkTap").timeBased().everyDays(1).atHour(7).create();
}
