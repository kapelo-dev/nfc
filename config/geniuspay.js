const crypto = require('crypto');

const BASE_URL = 'https://geniuspay.ci/api/v1/merchant';

function isConfigured() {
  return Boolean(process.env.GENIUSPAY_API_KEY && process.env.GENIUSPAY_API_SECRET);
}

function getCardPrice() {
  const price = parseInt(process.env.CARD_PRICE_XOF, 10);
  return Number.isInteger(price) && price >= 200 ? price : null;
}

function authHeaders() {
  return {
    'X-API-Key': process.env.GENIUSPAY_API_KEY,
    'X-API-Secret': process.env.GENIUSPAY_API_SECRET,
    'Content-Type': 'application/json'
  };
}

// Temporary diagnostic: sandbox vs live is decided entirely by GeniusPay based on which API
// key is sent (this codebase never picks a sandbox/live URL itself), so when a "live" checkout
// still comes back sandboxed, the only way to tell whether it's a wrong/stale Vercel env var or
// a GeniusPay-side account issue is to see exactly what was sent and got back. Logs only the
// last 4 characters of the key, never the secret. Remove once this is resolved.
function maskKey(key) {
  if (!key) return '(vide)';
  return key.length <= 4 ? '****' : `...${key.slice(-4)}`;
}

async function createPayment({ amount, description, customer, metadata, successUrl, errorUrl }) {
  console.log(`GeniusPay: création paiement avec la clé API ${maskKey(process.env.GENIUSPAY_API_KEY)}`);

  const res = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      amount,
      description,
      customer,
      metadata,
      success_url: successUrl,
      error_url: errorUrl
    })
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.success) {
    const message = (json && json.error && json.error.message) || `GeniusPay error (${res.status})`;
    throw new Error(message);
  }
  console.log('GeniusPay: réponse reçue', JSON.stringify(json.data));
  return json.data;
}

// Format: HMAC-SHA256(timestamp + "." + rawJsonBody, webhook secret). Compares using a
// constant-time check to avoid leaking timing information about the expected signature.
function verifyWebhookSignature(rawBody, signature, timestamp) {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { isConfigured, getCardPrice, createPayment, verifyWebhookSignature };
