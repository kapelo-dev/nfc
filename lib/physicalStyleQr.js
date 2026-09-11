const QRCode = require('qrcode');
const { physicalStyles } = require('../config/physicalStyles');

let cachedQrCodes = null;

async function getPhysicalStyleQrCodes() {
  if (cachedQrCodes) return cachedQrCodes;
  const baseUrl = process.env.BASE_DOMAIN || 'localhost:3000';
  const ids = [...physicalStyles.map((s) => s.id), 'custom'];
  const entries = await Promise.all(
    ids.map(async (id) => {
      const orderUrl = `https://${baseUrl}/commander?physical=${encodeURIComponent(id)}`;
      const dataUrl = await QRCode.toDataURL(orderUrl, {
        width: 260,
        margin: 1,
        color: { dark: '#111111', light: '#FFFFFF' }
      });
      return [id, dataUrl];
    })
  );
  cachedQrCodes = Object.fromEntries(entries);
  return cachedQrCodes;
}

module.exports = { getPhysicalStyleQrCodes };
