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

// One A4 sheet packed with identical QR codes pointing at the sign-up form, at the same
// 24mm size used on the back of a finished card, for the admin to print and hand out /
// display as a prospecting flyer. Maximized for count: 8x11 = 88 per sheet, with just enough
// gap (2mm) for an automatic cutter to separate them without any two codes touching.
async function buildQrOrderSheet(doc, url) {
  const qrBuffer = await QRCode.toBuffer(url, {
    width: 400,
    margin: 1,
    color: { dark: '#111111', light: '#FFFFFF' }
  });

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = MARGIN_X + col * (QR_SIZE + GAP);
      const y = MARGIN_Y + row * (QR_SIZE + GAP);
      doc.image(qrBuffer, mm(x), mm(y), { width: mm(QR_SIZE), height: mm(QR_SIZE) });
    }
  }
}

module.exports = { buildQrOrderSheet, QR_PER_SHEET, QR_SIZE };
