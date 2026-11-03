// Tự điền link từng tập vào Sheet từ link playlist YouTube.
// Dán file này vào CÙNG dự án Apps Script đã có (Extensions -> Apps Script), bấm Lưu.
// Không cần khóa API: mặc định dùng RSS của YouTube (tối đa 15 video mới nhất mỗi playlist).
// RSS của playlist có lúc trả 404 dù playlist vẫn còn, khi đó script tự đọc trang playlist (20 video đầu tiên trong playlist).
// Muốn lấy đủ mọi tập (playlist dài): thêm khóa YouTube Data API v3 vào
// Project Settings -> Script properties, tên YT_API_KEY.
// Playlist đánh số tập nối tiếp mùa trước (mùa 2 bắt đầu từ "Tập 14"): thêm cột lech_tap vào Sheet
// và điền số tập cần trừ, ví dụ 13. Dòng có lech_tap được ghi lại toàn bộ link theo số tập đã trừ.

const SHEET_ID = "14Vzk3IeLlagP2YEm7LaGZRnoYcl5kHGPj4VzF5weT30";
const TAB_LINKS = "Sheet1";          // tab chứa bảng link của bạn
const COT_PLAYLIST = "link_xem";     // cột chứa link playlist
const COT_TAP = "link_cac_tap";      // cột script sẽ tự điền (tự tạo nếu chưa có)
const COT_LECH = "lech_tap";         // cột không bắt buộc: số tập cần trừ
const GIOI_HAN_MS = 5 * 60 * 1000;   // dừng trước giới hạn 6 phút của Apps Script

function layPlaylistId(url) {
  const m = /(?:[?&]list=|\/show\/VL)([A-Za-z0-9_-]+)/.exec(String(url || ""));
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

// YouTube trả bản di động cho Apps Script: ytInitialData là chuỗi JS mã hóa \xHH thay vì object JSON.
function layDuLieuTrang(html) {
  const o = /ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
  if (o) return JSON.parse(o[1]);
  const c = /ytInitialData\s*=\s*'([^']*)'/.exec(html);
  if (!c) return null;
  return JSON.parse(c[1].replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[\s\S])/g, (_, k) => {
    if (k.length > 1) return String.fromCharCode(parseInt(k.slice(1), 16));
    return { n: "\n", r: "\r", t: "\t" }[k] || k;
  }));
}

// Dự phòng khi RSS lỗi: đọc dữ liệu có sẵn trong trang playlist. Không phải API chính thức nên có thể đổi.
function docTrang(id) {
  const res = UrlFetchApp.fetch("https://www.youtube.com/playlist?list=" + id, {
    muteHttpExceptions: true,
    headers: { "Accept-Language": "vi" },
  });
  if (res.getResponseCode() !== 200) throw new Error("Trang playlist lỗi " + res.getResponseCode() + " cho " + id);
  const data = layDuLieuTrang(res.getContentText());
  if (!data) throw new Error("Không đọc được dữ liệu trang playlist " + id);
  const out = [], daCo = {};
  const them = (videoId, title) => {
    if (!/^[\w-]{11}$/.test(videoId || "") || daCo[videoId]) return;
    daCo[videoId] = true;
    out.push({ videoId: videoId, title: title || "", viTri: null });
  };
  const duyet = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.lockupViewModel) {
      const l = o.lockupViewModel;
      them(l.contentId, l.metadata?.lockupMetadataViewModel?.title?.content);
    } else if (o.playlistVideoRenderer) {
      const v = o.playlistVideoRenderer;
      them(v.videoId, v.title?.runs?.[0]?.text);
    }
    Object.keys(o).forEach((k) => duyet(o[k]));
  };
  duyet(data);
  return out;
}

function docKhongKhoa(id) {
  try {
    return docRss(id);
  } catch (e) {
    return docTrang(id);
  }
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
  const batDau = Date.now();
  const luu = PropertiesService.getScriptProperties();
  const dongDau = Number(luu.getProperty("LINK_TAP_DONG")) || 0;
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "capNhatLinkTapTiep")
    .forEach((t) => ScriptApp.deleteTrigger(t));
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
  const cLech = header.indexOf(COT_LECH);
  const rows = sh.getRange(2, 1, lastRow - 1, Math.max(lastCol, cTap + 1)).getValues();
  let them = 0, boQua = 0;
  for (let i = dongDau; i < rows.length; i++) {
    if (Date.now() - batDau > GIOI_HAN_MS) {
      luu.setProperty("LINK_TAP_DONG", String(i));
      ScriptApp.newTrigger("capNhatLinkTapTiep").timeBased().after(60 * 1000).create();
      console.log("Đã thêm " + them + " link, sẽ chạy tiếp từ dòng " + (i + 2) + " sau 1 phút.");
      return;
    }
    const r = rows[i];
    const id = layPlaylistId(r[cPl]);
    if (!id) continue;
    let videos;
    try {
      videos = key ? docApi(id, key) : docKhongKhoa(id);
    } catch (e) {
      console.error("Dòng " + (i + 2) + ": " + e.message);
      continue;
    }
    if (!videos.length) { // không có video thì giữ nguyên ô, tránh xóa link cũ của dòng có lech_tap
      console.warn("Dòng " + (i + 2) + ": không đọc được video nào của playlist " + id);
      continue;
    }
    const lech = cLech >= 0 ? Number(r[cLech]) || 0 : 0;
    const cu = String(r[cTap] || "");
    // Không có khóa API thì danh sách bị giới hạn (RSS 15, trang playlist 20 video):
    // khi đó chỉ bổ sung, không ghi lại từ đầu, để khỏi mất link các tập ngoài danh sách.
    const biCat = !key && (videos.length === 15 || videos.length >= 20);
    const map = lech && !biCat ? {} : docCell(cu);
    const truoc = Object.keys(map).length;
    for (const v of videos) {
      let ep = laySoTap(v.title);
      if (ep == null && v.viTri != null) ep = v.viTri + 1; // dự phòng: theo thứ tự trong playlist (chỉ khi dùng API)
      if (ep == null) { boQua++; console.warn("Không đọc được số tập: " + v.title); continue; }
      if (ep != null) ep -= lech;
      if (ep < 1) continue; // video của mùa trước trong cùng playlist
      if (!map[ep]) map[ep] = "https://www.youtube.com/watch?v=" + v.videoId + "&list=" + id;
    }
    const moi = ghiCell(map);
    if (moi !== cu) {
      sh.getRange(i + 2, cTap + 1).setNumberFormat("@").setValue(moi);
      them += Math.max(0, Object.keys(map).length - truoc);
    }
    Utilities.sleep(500);
  }
  luu.deleteProperty("LINK_TAP_DONG");
  console.log("Đã thêm " + them + " link tập mới, bỏ qua " + boQua + " video không đọc được số tập.");
}

function capNhatLinkTapTiep() {
  capNhatLinkTap();
}

// Chạy MỘT lần để bật lịch tự động hằng ngày (7 giờ sáng).
function taoLichChayLinkTap() {
  ScriptApp.newTrigger("capNhatLinkTap").timeBased().everyDays(1).atHour(7).create();
}
