const QRCode = require('qrcode');
const { renderPhysicalCardBatch } = require('./cardRenderer');

const PT_PER_MM = 72 / 25.4;
const mm = (v) => v * PT_PER_MM;

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

// Places a headless-rendered screenshot of the real physical-card.ejs face (see
// lib/cardRenderer.js) — guarantees the print output always matches whatever the customer
// saw and picked in the web preview, since it's literally the same markup.
function drawRenderedCardFace(doc, x, y, imageBuffer) {
  const w = mm(ARTBOARD_W);
  const h = mm(ARTBOARD_H);
  doc.save();
  doc.rect(x, y, w, h).clip();
  doc.image(imageBuffer, x, y, { cover: [w, h], align: 'center', valign: 'center' });
  doc.restore();
  drawCropMarks(doc, x, y, w, h);
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

  const qrBuffers = {};
  const qrDataUrls = {};
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
    qrDataUrls[card.id] = await QRCode.toDataURL(orderUrl, {
      width: 260,
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

  const styleCards = cards.filter((card) => card.physical_style !== 'custom');
  let renderedFaces = {};
  if (styleCards.length > 0) {
    renderedFaces = await renderPhysicalCardBatch(styleCards, {
      baseUrl,
      qrCaptionHtml: 'Scanner pour<br>commander',
      qrSrcFor: (card) => qrDataUrls[card.id]
    });
  }

  const rowW = ARTBOARD_W * 2 + GAP_X;
  const pageW = 210;
  const startX = (pageW - rowW) / 2;

  cards.forEach((card, i) => {
    const rowInPage = i % ROWS_PER_PAGE;
    if (i > 0 && rowInPage === 0) doc.addPage({ size: 'A4', margin: 0 });
    else if (i === 0) { /* first page already created by caller */ }

    const rowY = PAGE_MARGIN + rowInPage * (ARTBOARD_H + GAP_Y);

    if (card.physical_style === 'custom') {
      drawCustomDesignFront(doc, mm(startX), mm(rowY), customImageBuffers[card.id]);
      drawCustomDesignBack(doc, mm(startX + ARTBOARD_W + GAP_X), mm(rowY), customBackImageBuffers[card.id], qrBuffers[card.id]);
    } else {
      const faces = renderedFaces[card.id];
      drawRenderedCardFace(doc, mm(startX), mm(rowY), faces.front);
      drawRenderedCardFace(doc, mm(startX + ARTBOARD_W + GAP_X), mm(rowY), faces.back);
    }
  });
}

module.exports = { buildPrintSheet, ARTBOARD_W, ARTBOARD_H, FINISHED_W, FINISHED_H, BLEED, SAFE };
