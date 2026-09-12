const QRCode = require('qrcode');
const { physicalStyles } = require('../config/physicalStyles');
const { getBaseDomain } = require('../config/env');

let cachedQrCodes = null;

async function getPhysicalStyleQrCodes() {
  if (cachedQrCodes) return cachedQrCodes;
  const baseUrl = getBaseDomain();
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
