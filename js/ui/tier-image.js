/* Vẽ tier list thành ảnh PNG. Poster đi qua anh.php vì máy chủ ảnh AniList không cho canvas đọc trực tiếp. */

const WIDTH = 1200;
const LABEL_WIDTH = 120;
const TILE_WIDTH = 120;
const TILE_HEIGHT = 168;
const GAP = 4;
const HEADER = 96;
const FOOTER = 48;
const COLUMNS = Math.floor((WIDTH - LABEL_WIDTH - GAP) / (TILE_WIDTH + GAP));
const BACKGROUND = '#1a1d24';
const ROW_BACKGROUND = '#262a33';

function loadPoster(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `/anh.php?p=${encodeURIComponent(new URL(url).pathname)}`;
  });
}

function wrapText(context, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  return [...lines, line];
}

function drawTile(context, show, image, x, y) {
  if (image) {
    const scale = Math.max(TILE_WIDTH / image.width, TILE_HEIGHT / image.height);
    const width = TILE_WIDTH / scale;
    const height = TILE_HEIGHT / scale;
    context.drawImage(image, (image.width - width) / 2, (image.height - height) / 2, width, height, x, y, TILE_WIDTH, TILE_HEIGHT);
    return;
  }
  // Không lấy được poster thì ghi tên phim, ảnh vẫn tạo được.
  context.fillStyle = '#3a4150';
  context.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT);
  context.fillStyle = '#ffffff';
  context.font = `600 15px ${context.canvas.dataset.font}`;
  wrapText(context, show.title, TILE_WIDTH - 12).slice(0, 7).forEach((line, index) => {
    context.fillText(line, x + 6, y + 22 + index * 19);
  });
}

export async function renderTierImage({ title, tiers }) {
  await document.fonts.ready;
  const fontFamily = getComputedStyle(document.body).fontFamily;
  const rowHeights = tiers.map(({ shows }) => (
    Math.max(1, Math.ceil(shows.length / COLUMNS)) * (TILE_HEIGHT + GAP) + GAP
  ));
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEADER + rowHeights.reduce((sum, height) => sum + height + GAP, 0) + FOOTER;
  canvas.dataset.font = fontFamily;
  const context = canvas.getContext('2d');

  const images = new Map(await Promise.all(tiers.flatMap(({ shows }) => shows).map(
    async (show) => [show.id, await loadPoster(show.poster)],
  )));

  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#ffffff';
  context.font = `700 40px ${fontFamily}`;
  context.textAlign = 'left';
  context.fillText(title, 24, 62, WIDTH - 48);

  let top = HEADER;
  tiers.forEach(({ key, color, shows }, row) => {
    const height = rowHeights[row];
    context.fillStyle = ROW_BACKGROUND;
    context.fillRect(0, top, WIDTH, height);
    context.fillStyle = color;
    context.fillRect(0, top, LABEL_WIDTH, height);
    context.fillStyle = '#16181d';
    context.font = `800 48px ${fontFamily}`;
    context.textAlign = 'center';
    context.fillText(key, LABEL_WIDTH / 2, top + height / 2 + 17);
    context.textAlign = 'left';
    shows.forEach((show, index) => {
      const x = LABEL_WIDTH + GAP + (index % COLUMNS) * (TILE_WIDTH + GAP);
      const y = top + GAP + Math.floor(index / COLUMNS) * (TILE_HEIGHT + GAP);
      drawTile(context, show, images.get(show.id), x, y);
    });
    top += height + GAP;
  });

  context.fillStyle = '#aab2c0';
  context.font = `500 20px ${fontFamily}`;
  context.textAlign = 'right';
  context.fillText('Tạo tại a4vf.net', WIDTH - 24, canvas.height - 16);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh'))), 'image/png');
  });
}
