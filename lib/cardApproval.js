const PDFDocument = require('pdfkit');
const { buildPrintSheet } = require('./printSheet');
const { sendWhatsAppMessage, sendWhatsAppDocument } = require('./whatsapp');
const { getBaseDomain } = require('../config/env');

// Shared by the manual "approve" action (admin/requests) and the automatic approval that
// follows a confirmed GeniusPay payment (routes/orders.js webhook) — both mean the same thing:
// the card is now active, and the customer gets their profile link + a print-ready PDF preview.
async function notifyApprovedCustomer(card) {
  if (!card || !card.contact_phone) return;
  try {
    const baseUrl = getBaseDomain();
    const profileUrl = `https://${baseUrl}/c/${card.card_id}`;

    await sendWhatsAppMessage(
      card.contact_phone,
      `Bonjour ${card.name}, votre carte NFC a été validée !\nVoici l'aperçu de votre profil en ligne : ${profileUrl}\nLe visuel de votre carte physique (recto/verso) suit dans le message suivant.`
    );

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const pdfDone = new Promise((resolve) => doc.on('end', resolve));
    await buildPrintSheet(doc, [card], { baseUrl });
    doc.end();
    await pdfDone;

    await sendWhatsAppDocument(card.contact_phone, Buffer.concat(chunks), 'ma-carte-nfc.pdf', 'Aperçu de votre carte NFC (recto/verso)');
  } catch (error) {
    console.error('Approve notification error:', error.message);
  }
}

module.exports = { notifyApprovedCustomer };
