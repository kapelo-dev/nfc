const db = require('../config/database');

// One row per payment attempt (order-form checkout, or an admin-triggered payment link),
// kept even after the card itself changes — a durable audit trail independent of the card's
// own current payment_status, which only reflects the latest attempt.
async function recordTransactionInit({ cardId, reference, amount, contactPhone, cardName }) {
  await db.query(
    `INSERT INTO transactions (card_id, reference, amount, status, contact_phone, card_name)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [cardId, reference, amount, contactPhone || null, cardName || null]
  );
}

async function updateTransactionStatus(reference, status, paymentMethod) {
  if (!reference) return;
  await db.query(
    'UPDATE transactions SET status = ?, payment_method = COALESCE(?, payment_method) WHERE reference = ?',
    [status, paymentMethod || null, reference]
  );
}

module.exports = { recordTransactionInit, updateTransactionStatus };
