const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const PT_PER_MM = 72 / 25.4;
const mm = (v) => v * PT_PER_MM;

const PAGE_W = 210;
const PAGE_H = 297;
const QR_SIZE = 24; // same visual size as the QR on the back of a finished card
const GAP = 2; // keeps codes apart for the automatic cutter — never touching
const COLS = 8;
const ROWS = 11;
const QR_PER_SHEET = COLS * ROWS;

const GRID_W = COLS * QR_SIZE + (COLS - 1) * GAP;
const GRID_H = ROWS * QR_SIZE + (ROWS - 1) * GAP;
const MARGIN_X = (PAGE_W - GRID_W) / 2;
const MARGIN_Y = (PAGE_H - GRID_H) / 2;

const LOGO_PATH = path.join(__dirname, '..', 'public', 'images', 'logo-kpass.png');

// Packs one A4 sheet with COLS x ROWS copies of the same square image buffer, at the
// 24mm size used on the back of a finished card, spaced 2mm apart for the automatic cutter.
function buildImageSheet(doc, imageBuffer) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = MARGIN_X + col * (QR_SIZE + GAP);
      const y = MARGIN_Y + row * (QR_SIZE + GAP);
      doc.image(imageBuffer, mm(x), mm(y), { width: mm(QR_SIZE), height: mm(QR_SIZE) });
    }
  }
}

async function getQrBuffer(url) {
  return QRCode.toBuffer(url, {
    width: 400,
    margin: 1,
    color: { dark: '#111111', light: '#FFFFFF' }
  });
}

function getLogoBuffer() {
  return fs.readFileSync(LOGO_PATH);
}

// One A4 sheet packed with identical QR codes pointing at the sign-up form, and/or one A4
// sheet packed with the K_Pass logo, both at the same 24mm size used on the back of a
// finished card, for the admin to print and hand out / display as a prospecting flyer.
// `mode` picks what to include: 'qr', 'logo', or 'both' (one page each, QR first).
async function buildQrOrderSheet(doc, url, mode = 'qr') {
  const includeQr = mode === 'qr' || mode === 'both';
  const includeLogo = mode === 'logo' || mode === 'both';

  let firstPage = true;
  if (includeQr) {
    const qrBuffer = await getQrBuffer(url);
    buildImageSheet(doc, qrBuffer);
    firstPage = false;
  }
  if (includeLogo) {
    if (!firstPage) doc.addPage({ size: 'A4', margin: 0 });
    buildImageSheet(doc, getLogoBuffer());
  }
}

module.exports = { buildQrOrderSheet, buildImageSheet, getQrBuffer, getLogoBuffer, QR_PER_SHEET, QR_SIZE };
