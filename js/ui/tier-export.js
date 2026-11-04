/* Vẽ bảng tier list thành ảnh PNG bằng canvas, nên ảnh giống nhau trên mọi thiết bị.
   Poster đi qua poster.php trên host: đọc thẳng từ CDN của AniList rất chậm, có poster còn lỗi.
   Host không chạy được poster.php thì mới đọc thẳng từ CDN. */

import { hueOf } from '../components/common.js';

const CANVAS_WIDTH = 1200;
const PADDING = 24;
const LABEL_WIDTH = 128;
const COLUMNS = 8;
const CELL_GAP = 6;
const ROW_GAP = 6;
const HEADER_HEIGHT = 116;
const FOOTER_HEIGHT = 52;
const EMPTY_ROW_HEIGHT = 96;
const TITLE_BLOCK_HEIGHT = 46;
const POSTER_PROXY = '/poster.php';
const IMAGE_TIMEOUT_MS = 12_000;
const PARALLEL_DOWNLOADS = 6;

const COLORS = {
  page: '#292a2a',
  header: '#2e4fa0',
  onHeader: '#ffffff',
  row: '#323334',
  ink: '#ececec',
  muted: '#b4b7bb',
};

const FONT_BODY = '"Be Vietnam Pro", system-ui, sans-serif';
const FONT_BRAND = '"Cal Sans", "Be Vietnam Pro", system-ui, sans-serif';

/** Poster đã tải, để đổi tuỳ chọn rồi xuất lại không phải tải lần nữa. */
const posterCache = new Map();

/** Đổi thành false khi host không chạy được poster.php, để khỏi thử lại với từng poster. */
let proxyAvailable = true;

const proxyUrlOf = (url) => {
  const name = url.match(/\/cover\/medium\/([A-Za-z0-9_-]+\.[a-z]+)$/)?.[1];
  return name ? `${POSTER_PROXY}?f=${encodeURIComponent(name)}` : '';
};

async function fetchImage(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const isImage = response.ok && response.headers.get('content-type')?.startsWith('image/');
    if (!isImage) return { status: response.status, bitmap: null };
    return { status: response.status, bitmap: await createImageBitmap(await response.blob()) };
  } finally {
    clearTimeout(timer);
  }
}

async function fromProxy(url) {
  const proxyUrl = proxyUrlOf(url);
  if (!proxyAvailable || !proxyUrl) return null;
  const { status, bitmap } = await fetchImage(proxyUrl).catch(() => ({ status: 0, bitmap: null }));
  // 502 chỉ là lỗi của một poster. Mã khác nghĩa là bản thân poster.php không chạy.
  if (!bitmap && status !== 502 && status !== 0) proxyAvailable = false;
  return bitmap;
}

/** Bản lưu từ thẻ <img> không đọc được khi vẽ canvas, nên phải bỏ qua bộ nhớ đệm. */
async function fromCdn(url) {
  const { bitmap } = await fetchImage(url, { mode: 'cors', cache: 'reload' });
  return bitmap;
}

async function loadPoster(url) {
  if (!url) return null;
  if (posterCache.has(url)) return posterCache.get(url);
  try {
    const bitmap = (await fromProxy(url)) ?? (await fromCdn(url));
    if (bitmap) posterCache.set(url, bitmap);
    return bitmap;
  } catch (error) {
    console.warn('Không tải được poster', url, error);
    return null;
  }
}

async function loadPosters(shows, onProgress) {
  const queue = [...shows];
  const bitmaps = new Map();
  let done = 0;

  const worker = async () => {
    while (queue.length) {
      const show = queue.shift();
      bitmaps.set(show.id, await loadPoster(show.poster));
      done += 1;
      onProgress?.(done, shows.length);
    }
  };

  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
  return bitmaps;
}

/** Chờ font, gồm cả phần chữ tiếng Việt vốn được tải riêng. */
async function loadFonts() {
  const sample = 'Tiếng Việt ắấờữ';
  await Promise.allSettled([
    document.fonts.load(`600 40px "Be Vietnam Pro"`, sample),
    document.fonts.load(`500 15px "Be Vietnam Pro"`, sample),
    document.fonts.load(`400 40px "Cal Sans"`, 'A4VFamily'),
  ]);
}

function roundedPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function fitFontSize(ctx, text, maxWidth, largest, smallest, fontOf) {
  let size = largest;
  ctx.font = fontOf(size);
  while (size > smallest && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = fontOf(size);
  }
  return size;
}

/** Ngắt chữ thành tối đa `maxLines` dòng, dòng cuối thêm dấu … nếu thiếu chỗ. */
function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  const words = text.split(/\s+/).filter(Boolean);

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  const used = lines.join(' ').length;
  if (used < words.join(' ').length || ctx.measureText(lines.at(-1) ?? '').width > maxWidth) {
    let last = lines[lines.length - 1] ?? '';
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

/** Thiếu ảnh thì vẽ bìa màu kèm tên phim, giống bìa dự phòng trên website. */
function drawFallback(ctx, show, x, y, width, height) {
  const hue = hueOf(show.title);
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, `hsl(${hue} 58% 44%)`);
  gradient.addColorStop(1, `hsl(${(hue + 50) % 360} 55% 27%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 14px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, show.title, width - 14, 5);
  lines.forEach((line, index) => {
    ctx.fillText(line, x + width / 2, y + height / 2 + (index - (lines.length - 1) / 2) * 18);
  });
}

function drawPoster(ctx, show, bitmap, x, y, width, height) {
  ctx.save();
  roundedPath(ctx, x, y, width, height, 6);
  ctx.clip();

  if (bitmap) {
    // Giống object-fit: cover: cắt phần thừa, giữ tâm ảnh.
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const drawWidth = bitmap.width * scale;
    const drawHeight = bitmap.height * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  } else {
    drawFallback(ctx, show, x, y, width, height);
  }
  ctx.restore();
}

function drawHeader(ctx, { title, subtitle }) {
  ctx.fillStyle = COLORS.header;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HEADER_HEIGHT);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.onHeader;
  const titleWidth = CANVAS_WIDTH - PADDING * 2 - 190;
  fitFontSize(ctx, title, titleWidth, 38, 20, (size) => `600 ${size}px ${FONT_BODY}`);
  ctx.fillText(title, PADDING, 60);

  ctx.font = `500 19px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fillText(subtitle, PADDING, 92);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.onHeader;
  ctx.font = `400 32px ${FONT_BRAND}`;
  ctx.fillText('A4VFamily', CANVAS_WIDTH - PADDING, 60);
  ctx.font = `500 17px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fillText('a4vf.net', CANVAS_WIDTH - PADDING, 92);
}

function drawTierLabel(ctx, tier, x, y, height) {
  ctx.fillStyle = tier.color;
  roundedPath(ctx, x, y, LABEL_WIDTH, height, [6, 0, 0, 6]);
  ctx.fill();

  ctx.fillStyle = tier.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = tier.label || ' ';
  const size = fitFontSize(ctx, label, LABEL_WIDTH - 16, 46, 15, (px) => `600 ${px}px ${FONT_BODY}`);
  ctx.font = `600 ${size}px ${FONT_BODY}`;
  ctx.fillText(label, x + LABEL_WIDTH / 2, y + height / 2);
}

/**
 * @param {{title: string, subtitle: string, withTitles: boolean,
 *   tiers: {label: string, color: string, ink: string, shows: object[]}[]}} board
 * @returns {Promise<{blob: Blob, missing: number}>}
 */
export async function renderTierImage(board, onProgress) {
  const { tiers, withTitles } = board;
  const shows = tiers.flatMap((tier) => tier.shows);
  const [bitmaps] = await Promise.all([loadPosters(shows, onProgress), loadFonts()]);

  const rowLeft = PADDING + LABEL_WIDTH;
  const rowWidth = CANVAS_WIDTH - PADDING - rowLeft;
  const cellWidth = (rowWidth - CELL_GAP * (COLUMNS + 1)) / COLUMNS;
  const posterHeight = Math.round(cellWidth * 1.4);
  const cellHeight = posterHeight + (withTitles ? TITLE_BLOCK_HEIGHT : 0);

  const rowHeightOf = ({ shows: list }) => {
    if (!list.length) return EMPTY_ROW_HEIGHT;
    const rows = Math.ceil(list.length / COLUMNS);
    return rows * cellHeight + (rows + 1) * CELL_GAP;
  };

  const boardHeight = tiers.reduce((sum, tier) => sum + rowHeightOf(tier) + ROW_GAP, 0);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = HEADER_HEIGHT + PADDING + boardHeight + FOOTER_HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawHeader(ctx, board);

  let y = HEADER_HEIGHT + PADDING;
  for (const tier of tiers) {
    const height = rowHeightOf(tier);
    ctx.fillStyle = COLORS.row;
    roundedPath(ctx, rowLeft, y, rowWidth, height, [0, 6, 6, 0]);
    ctx.fill();
    drawTierLabel(ctx, tier, PADDING, y, height);

    tier.shows.forEach((show, index) => {
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const cellX = rowLeft + CELL_GAP + column * (cellWidth + CELL_GAP);
      const cellY = y + CELL_GAP + row * (cellHeight + CELL_GAP);
      drawPoster(ctx, show, bitmaps.get(show.id), cellX, cellY, cellWidth, posterHeight);

      if (withTitles) {
        ctx.fillStyle = COLORS.ink;
        ctx.font = `500 13px ${FONT_BODY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        wrapText(ctx, show.title, cellWidth - 2, 2).forEach((line, lineIndex) => {
          ctx.fillText(line, cellX + cellWidth / 2, cellY + posterHeight + 18 + lineIndex * 18);
        });
      }
    });
    y += height + ROW_GAP;
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 16px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Tạo tier list anime theo mùa tại a4vf.net', CANVAS_WIDTH / 2, canvas.height - FOOTER_HEIGHT / 2 - 4);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Không tạo được ảnh'))), 'image/png');
  });
  const missing = shows.filter((show) => !bitmaps.get(show.id)).length;
  return { blob, missing };
}
