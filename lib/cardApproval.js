const PDFDocument = require('pdfkit');
const { buildPrintSheet } = require('./printSheet');
const { sendWhatsAppMessage, sendWhatsAppDocument } = require('./whatsapp');
const { getBaseDomain } = require('../config/env');

// Shared by the manual "approve" action (admin/requests) and the automatic approval that
// follows a confirmed GeniusPay payment (routes/orders.js webhook) — both mean the same thing:
// the card is now active, and the customer gets their profile link + a print-ready PDF preview.
// Temporary diagnostic: customers report getting the first WhatsApp text but never the PDF
// that's supposed to follow. Both calls were sharing one try/catch, so a failure gave no clue
// which step died (headless-Chromium render vs. the WhatsApp document upload) or whether the
// function was killed by a Vercel timeout before either log line could run. Logs step timing
// and the full error/stack. Remove once this is resolved.
async function notifyApprovedCustomer(card) {
  if (!card || !card.contact_phone) return;
  const baseUrl = getBaseDomain();
  const profileUrl = `https://${baseUrl}/c/${card.card_id}`;
  const t0 = Date.now();

  try {
    await sendWhatsAppMessage(
      card.contact_phone,
      `Bonjour ${card.name}, votre carte NFC a été validée !\nVoici l'aperçu de votre profil en ligne : ${profileUrl}\nLe visuel de votre carte physique (recto/verso) suit dans le message suivant.`
    );
    console.log(`Approve notification: texte envoyé (+${Date.now() - t0}ms), carte ${card.id}`);
  } catch (error) {
    console.error(`Approve notification: échec envoi texte (+${Date.now() - t0}ms), carte ${card.id}:`, error.message, error.stack);
    return;
  }

  let pdfBuffer;
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const pdfDone = new Promise((resolve) => doc.on('end', resolve));
    await buildPrintSheet(doc, [card], { baseUrl });
    doc.end();
    await pdfDone;
    pdfBuffer = Buffer.concat(chunks);
    console.log(`Approve notification: PDF généré (+${Date.now() - t0}ms), carte ${card.id}, ${pdfBuffer.length} octets`);
  } catch (error) {
    console.error(`Approve notification: échec génération PDF (+${Date.now() - t0}ms), carte ${card.id}:`, error.message, error.stack);
    return;
  }

  try {
    await sendWhatsAppDocument(card.contact_phone, pdfBuffer, 'ma-carte-nfc.pdf', 'Aperçu de votre carte NFC (recto/verso)');
    console.log(`Approve notification: PDF envoyé (+${Date.now() - t0}ms), carte ${card.id}`);
  } catch (error) {
    console.error(`Approve notification: échec envoi PDF (+${Date.now() - t0}ms), carte ${card.id}:`, error.message, error.stack);
  }
}

module.exports = { notifyApprovedCustomer };
