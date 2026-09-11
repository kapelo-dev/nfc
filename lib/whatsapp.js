function isConfigured() {
  return Boolean(
    process.env.GOWA_BASE_URL &&
    process.env.GOWA_BASIC_AUTH_USER &&
    process.env.GOWA_BASIC_AUTH_PASSWORD
  );
}

function authHeader() {
  const token = Buffer.from(
    `${process.env.GOWA_BASIC_AUTH_USER}:${process.env.GOWA_BASIC_AUTH_PASSWORD}`
  ).toString('base64');
  return `Basic ${token}`;
}

function toWhatsAppId(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  return `${digits}@s.whatsapp.net`;
}

async function sendWhatsAppMessage(phone, message) {
  if (!isConfigured() || !phone) {
    if (!isConfigured()) console.warn('GoWA not configured, skipping WhatsApp message');
    return { skipped: true };
  }
  try {
    const res = await fetch(`${process.env.GOWA_BASE_URL}/send/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ phone: toWhatsAppId(phone), message })
    });
    if (!res.ok) {
      console.error('GoWA send/message failed:', res.status, await res.text().catch(() => ''));
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (error) {
    console.error('GoWA send/message error:', error.message);
    return { ok: false, error: error.message };
  }
}

async function sendWhatsAppDocument(phone, buffer, filename, caption) {
  if (!isConfigured() || !phone) {
    if (!isConfigured()) console.warn('GoWA not configured, skipping WhatsApp document');
    return { skipped: true };
  }
  try {
    const form = new FormData();
    form.append('phone', toWhatsAppId(phone));
    if (caption) form.append('caption', caption);
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);

    const res = await fetch(`${process.env.GOWA_BASE_URL}/send/file`, {
      method: 'POST',
      headers: { Authorization: authHeader() },
      body: form
    });
    if (!res.ok) {
      console.error('GoWA send/file failed:', res.status, await res.text().catch(() => ''));
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (error) {
    console.error('GoWA send/file error:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = { isConfigured, sendWhatsAppMessage, sendWhatsAppDocument };
