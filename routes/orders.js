const express = require('express');
const router = express.Router();
const multer = require('multer');
const { randomUUID: uuidv4 } = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { uploadBuffer, uploadDesignBuffer } = require('../config/cloudinary');
const { ensureCsrf, verifyCsrf } = require('../middleware/csrf');
const { sanitizeCardInput, sanitizePhone } = require('../lib/sanitize');
const { categories, templates, resolve, getTheme } = require('../config/templates');
const { physicalStyles, resolvePhysicalStyle } = require('../config/physicalStyles');
const { getPhysicalStyleQrCodes } = require('../lib/physicalStyleQr');
const { sendWhatsAppMessage } = require('../lib/whatsapp');
const { notifyApprovedCustomer } = require('../lib/cardApproval');
const { recordTransactionInit, updateTransactionStatus } = require('../lib/transactions');
const geniuspay = require('../config/geniuspay');

const SOCIAL_NETWORKS = ['snapchat', 'tiktok', 'whatsapp', 'linkedin', 'instagram', 'facebook'];
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: SOCIAL_NETWORKS.length + 3 },
  fileFilter(req, file, cb) {
    cb(null, ALLOWED_MIME_TYPES.has(file.mimetype));
  }
});

const uploadFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'custom_design_photo', maxCount: 1 },
  { name: 'custom_design_back_photo', maxCount: 1 },
  ...SOCIAL_NETWORKS.map((n) => ({ name: `${n}_photo`, maxCount: 1 }))
]);

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Express doesn't parse the standardized "Forwarded" header (only X-Forwarded-*), so
  // express-rate-limit warns that it's present but unused — harmless here since trust proxy
  // already derives req.ip correctly from X-Forwarded-For, which Vercel always sets too.
  validate: { forwardedHeader: false },
  message: 'Trop de demandes envoyées. Réessayez plus tard.'
});

const previewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { forwardedHeader: false },
  message: 'Trop de requêtes. Réessayez plus tard.'
});

// Registered before ensureCsrf on purpose: this endpoint is called by GeniusPay's server, not a
// browser with our session cookie, so it has no business touching req.session (ensureCsrf would
// otherwise mint and persist a throwaway session on every webhook delivery).
router.post('/webhooks/geniuspay', async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (!geniuspay.verifyWebhookSignature(req.rawBody || '', signature, timestamp)) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  // Acknowledge immediately — GeniusPay expects a fast response, and any failure past this
  // point shouldn't cause it to keep retrying a webhook we've already validated.
  res.status(200).json({ received: true });

  try {
    const event = req.body && req.body.event;
    const data = (req.body && req.body.data) || {};
    const cardId = parseInt(data.metadata && data.metadata.card_id, 10);
    if (!Number.isInteger(cardId)) return;

    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [cardId]);
    const card = cards[0];
    if (!card) return;

    const reference = data.reference;
    const paymentMethod = data.payment_method || data.provider || null;

    if (event === 'payment.success') {
      if (card.payment_status === 'paid') return;
      await db.query('UPDATE cards SET payment_status = ? WHERE id = ?', ['paid', cardId]);
      await updateTransactionStatus(reference, 'paid', paymentMethod);
      card.payment_status = 'paid';

      const baseUrl = process.env.BASE_DOMAIN || 'localhost:3000';
      const templateName = (templates.find((t) => t.id === card.template) || {}).name || card.template;
      const styleName = (physicalStyles.find((s) => s.id === card.physical_style) || {}).name || 'Design personnalisé';

      if (Number(card.is_request) === 1) {
        // A confirmed payment is the approval for a pending request — no manual review
        // step needed, this mirrors exactly what the admin "approve" button used to do.
        await db.query('UPDATE cards SET is_active = 1, is_request = 0 WHERE id = ?', [cardId]);
        card.is_active = 1;
        card.is_request = 0;
        notifyApprovedCustomer(card);
      } else if (card.contact_phone) {
        // Already an active (e.g. admin-created) card being paid via a manually-sent link.
        sendWhatsAppMessage(
          card.contact_phone,
          `Bonjour ${card.name}, nous confirmons la réception de votre paiement pour votre carte NFC. Merci !`
        );
      }

      sendWhatsAppMessage(
        process.env.GOWA_ADMIN_PHONE,
        `Paiement confirmé\nNom : ${card.name}\nContact WhatsApp : ${card.contact_phone}\nStyle web : ${templateName}\nDesign physique : ${styleName}\nVoir la carte : https://${baseUrl}/admin/dashboard`
      );
    } else if (['payment.failed', 'payment.cancelled', 'payment.expired'].includes(event)) {
      if (card.payment_status !== 'paid') {
        await db.query('UPDATE cards SET payment_status = ? WHERE id = ?', ['failed', cardId]);
        await updateTransactionStatus(reference, 'failed', paymentMethod);
      }
    }
  } catch (error) {
    console.error('GeniusPay webhook processing error:', error);
  }
});

router.use(ensureCsrf);

function renderPreview(req, res) {
  const source = req.method === 'GET' ? req.query : req.body;
  const fields = sanitizeCardInput(source);
  const card = {
    name: fields.name || 'Votre nom',
    title: fields.title,
    bio: fields.bio,
    photo_url: fields.photo_url,
    theme_color: fields.theme_color,
    template: resolve(fields.template),
    snapchat: fields.snapchat,
    tiktok: fields.tiktok,
    whatsapp: fields.whatsapp,
    linkedin: fields.linkedin,
    instagram: fields.instagram,
    facebook: fields.facebook
  };
  SOCIAL_NETWORKS.forEach((n) => {
    // A network checked on the order form should show up in the preview right away,
    // even before a username/link is typed (e.g. when the visitor picks "photo" mode instead).
    card[`${n}_pending`] = !card[n] && Boolean(source[`${n}_selected`]);
  });
  res.render(`profile/${card.template}`, { card, theme: getTheme(card) });
}

router.get('/preview', previewLimiter, renderPreview);
router.post('/preview', previewLimiter, renderPreview);

async function renderForm(res, status, error, submitted) {
  const qrCodes = await getPhysicalStyleQrCodes();
  res.status(status).render('public/order-form', {
    templates,
    categories,
    physicalStyles,
    socialNetworks: SOCIAL_NETWORKS,
    qrCodes,
    error,
    fields: submitted || {},
    success: false,
    cardPrice: geniuspay.getCardPrice()
  });
}

router.get('/', async (req, res) => {
  const qrCodes = await getPhysicalStyleQrCodes();
  const fields = {};
  if (req.query.template) fields.template = resolve(req.query.template);
  if (req.query.physical) fields.physical_style = resolvePhysicalStyle(req.query.physical);
  res.render('public/order-form', {
    templates,
    categories,
    physicalStyles,
    socialNetworks: SOCIAL_NETWORKS,
    qrCodes,
    error: req.query.paiement === 'echec' ? 'Le paiement a été annulé ou a échoué. Vous pouvez réessayer.' : null,
    fields,
    success: req.query.envoye === '1',
    cardPrice: geniuspay.getCardPrice()
  });
});

router.post('/', orderLimiter, (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err) {
      console.error('Order upload error:', err.name, err.message);
      return await renderForm(res, 400, 'Fichier invalide ou trop volumineux (5 Mo maximum par photo, formats jpg/png/gif/webp).', req.body);
    }

    verifyCsrf(req, res, async () => {
      const cardPrice = geniuspay.getCardPrice();
      if (!geniuspay.isConfigured() || !cardPrice) {
        console.error('GeniusPay not configured (missing API keys or CARD_PRICE_XOF)');
        return await renderForm(res, 500, 'Le paiement en ligne n\'est pas disponible pour le moment. Merci de nous contacter directement sur WhatsApp.', req.body);
      }

      let recordId = null;
      try {
        const fields = sanitizeCardInput(req.body);
        const contactPhone = sanitizePhone(req.body.contact_phone);

        if (!fields.name) {
          return await renderForm(res, 400, 'Le nom est requis.', req.body);
        }
        if (!contactPhone) {
          return await renderForm(res, 400, 'Merci de renseigner votre numéro WhatsApp.', req.body);
        }

        const files = req.files || {};

        let photoUrl = '';
        if (files.photo && files.photo[0]) {
          const result = await uploadBuffer(files.photo[0].buffer);
          photoUrl = result.secure_url;
        }

        let customDesignUrl = '';
        if (resolvePhysicalStyle(fields.physical_style) === 'custom' && files.custom_design_photo && files.custom_design_photo[0]) {
          const result = await uploadDesignBuffer(files.custom_design_photo[0].buffer);
          customDesignUrl = result.secure_url;
        }

        let customDesignBackUrl = '';
        if (resolvePhysicalStyle(fields.physical_style) === 'custom' && files.custom_design_back_photo && files.custom_design_back_photo[0]) {
          const result = await uploadDesignBuffer(files.custom_design_back_photo[0].buffer);
          customDesignBackUrl = result.secure_url;
        }

        const socialValues = {};
        const socialPhotos = {};

        for (const network of SOCIAL_NETWORKS) {
          const selected = req.body[`${network}_selected`] === '1';
          if (!selected) {
            socialValues[network] = '';
            socialPhotos[network] = null;
            continue;
          }
          socialValues[network] = fields[network] || '';
          if (files[`${network}_photo`] && files[`${network}_photo`][0]) {
            const result = await uploadBuffer(files[`${network}_photo`][0].buffer);
            socialPhotos[network] = result.secure_url;
          } else {
            socialPhotos[network] = null;
          }
        }

        const cardId = uuidv4().replace(/-/g, '');

        const [insertResult] = await db.query(
          `INSERT INTO cards
            (card_id, name, title, bio, photo_url, theme_color, template, physical_style, custom_design_url, custom_design_back_url, is_active, is_request, payment_status, contact_phone,
             snapchat, tiktok, whatsapp, linkedin, instagram, facebook,
             snapchat_photo, tiktok_photo, whatsapp_photo, linkedin_photo, instagram_photo, facebook_photo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cardId, fields.name, fields.title, fields.bio, photoUrl, fields.theme_color, resolve(fields.template), resolvePhysicalStyle(fields.physical_style), customDesignUrl, customDesignBackUrl,
            contactPhone,
            socialValues.snapchat, socialValues.tiktok, socialValues.whatsapp, socialValues.linkedin, socialValues.instagram, socialValues.facebook,
            socialPhotos.snapchat, socialPhotos.tiktok, socialPhotos.whatsapp, socialPhotos.linkedin, socialPhotos.instagram, socialPhotos.facebook
          ]
        );
        recordId = insertResult.insertId;

        const baseUrl = process.env.BASE_DOMAIN || 'localhost:3000';
        const payment = await geniuspay.createPayment({
          amount: cardPrice,
          description: `Carte NFC - ${fields.name}`,
          customer: { name: fields.name, phone: contactPhone },
          metadata: { card_id: recordId },
          successUrl: `https://${baseUrl}/commander?envoye=1`,
          errorUrl: `https://${baseUrl}/commander?paiement=echec`
        });

        await db.query('UPDATE cards SET payment_reference = ? WHERE id = ?', [payment.reference, recordId]);
        await recordTransactionInit({
          cardId: recordId,
          reference: payment.reference,
          amount: cardPrice,
          contactPhone,
          cardName: fields.name
        });

        res.redirect(payment.checkout_url || payment.payment_url);
      } catch (error) {
        console.error('Order creation error:', error);
        if (recordId) {
          db.query('DELETE FROM cards WHERE id = ?', [recordId]).catch((cleanupError) => {
            console.error('Failed to clean up pending order after payment init error:', cleanupError);
          });
        }
        await renderForm(res, 500, 'Erreur lors de l\'initialisation du paiement. Merci de réessayer.', req.body);
      }
    });
  });
});

module.exports = router;
