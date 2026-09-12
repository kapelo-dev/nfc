const path = require('path');
const QRCode = require('qrcode');

const PT_PER_MM = 72 / 25.4;
const mm = (v) => v * PT_PER_MM;

const NAME_FONT_PATH = path.join(__dirname, '../assets/fonts/AlexBrush-Regular.ttf');

const FINISHED_W = 85;
const FINISHED_H = 55;
const BLEED = 3;
const SAFE = 4;
const ARTBOARD_W = FINISHED_W + BLEED * 2;
const ARTBOARD_H = FINISHED_H + BLEED * 2;

const PAGE_MARGIN = 8;
const GAP_X = 6;
const GAP_Y = 8;
const ROWS_PER_PAGE = 4;

const STYLE_META = {
  'mat-noir-or': { colors: ['#1a1510', '#0d0a07'], fg: '#f2ece1', accent: '#c9a24d', align: 'left' },
  'blanc-minimal': { colors: ['#ffffff', '#fbfbfa'], fg: '#141414', accent: '#6b6b66', align: 'center' },
  'couleur-reseau': { colors: ['#2fd480', '#0f9d58'], fg: '#ffffff', accent: '#e8fff3', align: 'center' },
  'pop-createur': { colors: ['#7c3aed', '#2a1250'], fg: '#ffffff', accent: '#ffe8a3', align: 'center' },
  'geometrique-sombre': { colors: ['#151515', '#0a0a0a'], fg: '#ffffff', accent: '#c9a24d', align: 'right' },
  'dore-elegant': { colors: ['#faf6ef', '#f7f2ea'], fg: '#3a2f22', accent: '#a1793f', align: 'center' },
  'eco-nature': { colors: ['#eef2e4', '#d7e6c4'], fg: '#22391c', accent: '#4d7a3f', align: 'left' },
  'metal-brosse': { colors: ['#5c6169', '#24262b'], fg: '#f2f3f5', accent: '#b7bac0', align: 'left' },
  'perle-nacre': { colors: ['#fdfcf9', '#f1eee6'], fg: '#4a453c', accent: '#9a9484', align: 'center' },
  'bicolore-pro': { colors: ['#ffffff', '#ffffff'], fg: '#111111', accent: '#4f46e5', align: 'left' }
};

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255
  };
}

function hexToCmyk(hex) {
  const { r, g, b } = hexToRgb(hex);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return [c * 100, m * 100, y * 100, k * 100];
}

function drawCropMarks(doc, x, y, w, h) {
  const len = mm(4);
  const gap = mm(1.5);
  const color = [0, 0, 0, 100];
  doc.save().lineWidth(0.4).strokeColor(color);

  const corners = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1]
  ];

  corners.forEach(([cx, cy, dx, dy]) => {
    doc.moveTo(cx + dx * gap, cy).lineTo(cx + dx * (gap + len), cy).stroke();
    doc.moveTo(cx, cy + dy * gap).lineTo(cx, cy + dy * (gap + len)).stroke();
  });

  doc.restore();
}

function fillBackground(doc, x, y, w, h, meta) {
  const [c1, c2] = meta.colors;
  if (c1 === c2) {
    doc.rect(x, y, w, h).fill(hexToCmyk(c1));
    return;
  }
  const grad = doc.linearGradient(x, y, x + w, y + h);
  grad.stop(0, c1).stop(1, c2);
  doc.rect(x, y, w, h).fill(grad);
}

function drawNfcChip(doc, x, y, accentHex) {
  const cmyk = hexToCmyk(accentHex);
  doc.save().lineWidth(0.7).strokeColor(cmyk);
  doc.roundedRect(x, y, mm(7), mm(4.6), mm(0.8)).stroke();
  doc.circle(x + mm(3.5), y + mm(2.3), mm(1.1)).stroke();
  doc.restore();
}

function fitNameFontSize(doc, text, maxWidth, maxSize, minSize) {
  doc.font('AlexBrush');
  let size = maxSize;
  while (size > minSize && doc.fontSize(size).widthOfString(text) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawCustomDesignFront(doc, x, y, imageBuffer) {
  const w = mm(ARTBOARD_W);
  const h = mm(ARTBOARD_H);

  if (imageBuffer) {
    doc.save();
    doc.rect(x, y, w, h).clip();
    doc.image(imageBuffer, x, y, { cover: [w, h], align: 'center', valign: 'center' });
    doc.restore();
  } else {
    doc.rect(x, y, w, h).fill([0, 0, 0, 15]);
    doc.fillColor([0, 0, 0, 60]).font('Helvetica').fontSize(8);
    doc.text('Design non fourni', x, y + h / 2 - 4, { width: w, align: 'center' });
  }

  drawCropMarks(doc, x, y, w, h);
}

function drawCardFront(doc, x, y, card, meta) {
  fillBackground(doc, x, y, mm(ARTBOARD_W), mm(ARTBOARD_H), meta);
  drawCropMarks(doc, x, y, mm(ARTBOARD_W), mm(ARTBOARD_H));

  const safeX = x + mm(BLEED + SAFE);
  const safeY = y + mm(BLEED + SAFE);
  const safeW = mm(ARTBOARD_W) - mm((BLEED + SAFE) * 2);
  const safeH = mm(ARTBOARD_H) - mm((BLEED + SAFE) * 2);

  drawNfcChip(doc, x + mm(ARTBOARD_W) - mm(BLEED + SAFE + 7), y + mm(BLEED + SAFE), meta.accent);

  const name = card.name || 'Votre nom';
  const title = card.title || '';

  const nameSize = fitNameFontSize(doc, name, safeW, 20, 10);
  doc.fillColor(hexToCmyk(meta.fg)).font('AlexBrush').fontSize(nameSize);
  const nameOpts = { width: safeW, align: meta.align, lineBreak: false };
  const nameY = safeY + safeH - mm(16);
  doc.text(name, safeX, nameY, nameOpts);

  if (title) {
    doc.font('Helvetica').fontSize(8).fillColor(hexToCmyk(meta.accent));
    doc.text(title, safeX, nameY + mm(8), { width: safeW, align: meta.align, lineBreak: false });
  }
}

function drawCustomDesignBack(doc, x, y, imageBuffer, qrBuffer) {
  const w = mm(ARTBOARD_W);
  const h = mm(ARTBOARD_H);

  if (imageBuffer) {
    doc.save();
    doc.rect(x, y, w, h).clip();
    doc.image(imageBuffer, x, y, { cover: [w, h], align: 'center', valign: 'center' });
    doc.restore();
  } else {
    doc.rect(x, y, w, h).fill([0, 0, 0, 100]);
  }

  const centerX = x + w / 2;
  const qrSize = mm(24);
  const panelPad = mm(2);
  const qrY = y + mm(BLEED + 6);
  const qrBoxH = qrSize + panelPad * 2;

  doc.roundedRect(centerX - qrSize / 2 - panelPad, qrY, qrSize + panelPad * 2, qrBoxH, mm(1.5)).fill('white');
  doc.image(qrBuffer, centerX - qrSize / 2, qrY + panelPad, { width: qrSize, height: qrSize });

  const captionY = qrY + qrBoxH + mm(3);
  const safeW = w - mm((BLEED + SAFE) * 2);
  if (imageBuffer) {
    // A photo can be light or dark anywhere, so give the white caption a translucent backing for legibility.
    doc.save().fillOpacity(0.55);
    doc.roundedRect(x + mm(BLEED + SAFE), captionY - mm(1.5), safeW, mm(7), mm(1)).fill('black');
    doc.restore();
  }
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
  doc.text('Scanner pour commander', x + mm(BLEED + SAFE), captionY, { width: safeW, align: 'center' });

  drawCropMarks(doc, x, y, w, h);
}

function drawCardBack(doc, x, y, card, meta, qrBuffer, baseUrl) {
  fillBackground(doc, x, y, mm(ARTBOARD_W), mm(ARTBOARD_H), meta);
  drawCropMarks(doc, x, y, mm(ARTBOARD_W), mm(ARTBOARD_H));

  const centerX = x + mm(ARTBOARD_W) / 2;
  const qrSize = mm(24);
  const panelPad = mm(2);

  doc.roundedRect(centerX - qrSize / 2 - panelPad, y + mm(BLEED + 6), qrSize + panelPad * 2, qrSize + panelPad * 2, mm(1.5))
    .fill('white');
  doc.image(qrBuffer, centerX - qrSize / 2, y + mm(BLEED + 6) + panelPad, { width: qrSize, height: qrSize });

  doc.fillColor(hexToCmyk(meta.fg)).font('Helvetica-Bold').fontSize(8);
  doc.text('Scanner pour commander', x + mm(BLEED + SAFE), y + mm(BLEED + 6) + qrSize + panelPad * 2 + mm(3), {
    width: mm(ARTBOARD_W) - mm((BLEED + SAFE) * 2),
    align: 'center'
  });
}

// PDFKit can only decode JPEG and PNG, but uploads accept GIF/WebP too — force Cloudinary
// to deliver a JPEG regardless of how the original file was stored.
function toPdfCompatibleUrl(url) {
  return url.replace('/image/upload/', '/image/upload/f_jpg/');
}

async function fetchImageBuffer(url) {
  const res = await fetch(toPdfCompatibleUrl(url));
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function buildPrintSheet(doc, cards, options) {
  const baseUrl = (options && options.baseUrl) || process.env.BASE_DOMAIN || 'localhost:3000';
  doc.registerFont('AlexBrush', NAME_FONT_PATH);

  const qrBuffers = {};
  const customImageBuffers = {};
  const customBackImageBuffers = {};
  for (const card of cards) {
    const styleId = card.physical_style || 'mat-noir-or';
    const orderUrl = `https://${baseUrl}/commander?physical=${encodeURIComponent(styleId)}`;
    qrBuffers[card.id] = await QRCode.toBuffer(orderUrl, {
      width: 400,
      margin: 1,
      color: { dark: '#111111', light: '#FFFFFF' }
    });

    if (card.physical_style === 'custom' && card.custom_design_url) {
      try {
        customImageBuffers[card.id] = await fetchImageBuffer(card.custom_design_url);
      } catch (error) {
        console.error('Custom design fetch error for card', card.id, error.message);
        customImageBuffers[card.id] = null;
      }
    }

    if (card.physical_style === 'custom' && card.custom_design_back_url) {
      try {
        customBackImageBuffers[card.id] = await fetchImageBuffer(card.custom_design_back_url);
      } catch (error) {
        console.error('Custom design back fetch error for card', card.id, error.message);
        customBackImageBuffers[card.id] = null;
      }
    }
  }

  const rowW = ARTBOARD_W * 2 + GAP_X;
  const pageW = 210;
  const startX = (pageW - rowW) / 2;

  cards.forEach((card, i) => {
    const rowInPage = i % ROWS_PER_PAGE;
    if (i > 0 && rowInPage === 0) doc.addPage({ size: 'A4', margin: 0 });
    else if (i === 0) { /* first page already created by caller */ }

    const rowY = PAGE_MARGIN + rowInPage * (ARTBOARD_H + GAP_Y);
    const meta = STYLE_META[card.physical_style] || STYLE_META['mat-noir-or'];

    if (card.physical_style === 'custom') {
      drawCustomDesignFront(doc, mm(startX), mm(rowY), customImageBuffers[card.id]);
      drawCustomDesignBack(doc, mm(startX + ARTBOARD_W + GAP_X), mm(rowY), customBackImageBuffers[card.id], qrBuffers[card.id]);
    } else {
      drawCardFront(doc, mm(startX), mm(rowY), card, meta);
      drawCardBack(doc, mm(startX + ARTBOARD_W + GAP_X), mm(rowY), card, meta, qrBuffers[card.id], baseUrl);
    }
  });
}

module.exports = { buildPrintSheet, ARTBOARD_W, ARTBOARD_H, FINISHED_W, FINISHED_H, BLEED, SAFE };
