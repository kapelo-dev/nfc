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

const SOCIAL_NETWORKS = ['snapchat', 'tiktok', 'whatsapp', 'linkedin', 'instagram', 'facebook'];
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: SOCIAL_NETWORKS.length + 2 },
  fileFilter(req, file, cb) {
    cb(null, ALLOWED_MIME_TYPES.has(file.mimetype));
  }
});

const uploadFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'custom_design_photo', maxCount: 1 },
  ...SOCIAL_NETWORKS.map((n) => ({ name: `${n}_photo`, maxCount: 1 }))
]);

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Trop de demandes envoyées. Réessayez plus tard.'
});

const previewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Trop de requêtes. Réessayez plus tard.'
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
    success: false
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
    error: null,
    fields,
    success: req.query.envoye === '1'
  });
});

router.post('/', orderLimiter, (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err) {
      console.error('Order upload error:', err.name, err.message);
      return await renderForm(res, 400, 'Fichier invalide ou trop volumineux (5 Mo maximum par photo, formats jpg/png/gif/webp).', req.body);
    }

    verifyCsrf(req, res, async () => {
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

        await db.query(
          `INSERT INTO cards
            (card_id, name, title, bio, photo_url, theme_color, template, physical_style, custom_design_url, is_active, is_request, contact_phone,
             snapchat, tiktok, whatsapp, linkedin, instagram, facebook,
             snapchat_photo, tiktok_photo, whatsapp_photo, linkedin_photo, instagram_photo, facebook_photo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cardId, fields.name, fields.title, fields.bio, photoUrl, fields.theme_color, resolve(fields.template), resolvePhysicalStyle(fields.physical_style), customDesignUrl,
            contactPhone,
            socialValues.snapchat, socialValues.tiktok, socialValues.whatsapp, socialValues.linkedin, socialValues.instagram, socialValues.facebook,
            socialPhotos.snapchat, socialPhotos.tiktok, socialPhotos.whatsapp, socialPhotos.linkedin, socialPhotos.instagram, socialPhotos.facebook
          ]
        );

        const baseUrl = process.env.BASE_DOMAIN || 'localhost:3000';
        const templateName = (templates.find((t) => t.id === resolve(fields.template)) || {}).name || fields.template;
        const styleName = (physicalStyles.find((s) => s.id === resolvePhysicalStyle(fields.physical_style)) || {}).name || 'Design personnalisé';
        sendWhatsAppMessage(
          process.env.GOWA_ADMIN_PHONE,
          `Nouvelle commande de carte NFC\nNom : ${fields.name}\nContact WhatsApp : ${contactPhone}\nStyle web : ${templateName}\nDesign physique : ${styleName}\nVoir la demande : https://${baseUrl}/admin/requests`
        );

        res.redirect('/commander?envoye=1');
      } catch (error) {
        console.error('Order creation error:', error);
        await renderForm(res, 500, 'Erreur lors de l\'envoi de votre demande. Merci de réessayer.', req.body);
      }
    });
  });
});

module.exports = router;
