const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { randomUUID: uuidv4 } = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { ensureCsrf, verifyCsrf } = require('../middleware/csrf');
const { sanitizeCardInput, sanitizeHttpsUrl } = require('../lib/sanitize');
const { categories, templates, resolve, getTheme, buildPreviewCard } = require('../config/templates');
const { physicalStyles, resolvePhysicalStyle } = require('../config/physicalStyles');
const { buildPrintSheet } = require('../lib/printSheet');
const { getPhysicalStyleQrCodes } = require('../lib/physicalStyleQr');
const { upload, uploadBuffer, uploadDesignBuffer } = require('../config/cloudinary');
const { sendWhatsAppMessage, sendWhatsAppDocument } = require('../lib/whatsapp');
const fulfillment = require('../config/fulfillment');

const DUMMY_HASH = bcrypt.hashSync('timing-pad', 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Trop de tentatives. Réessayez plus tard.'
});

router.use(ensureCsrf);

const SOCIAL_NETWORKS = ['snapchat', 'tiktok', 'whatsapp', 'linkedin', 'instagram', 'facebook'];

async function formLocals(card, error) {
  const physicalQrCodes = await getPhysicalStyleQrCodes();
  return { card, error, templates, categories, physicalStyles, physicalQrCodes };
}

const uploadCardFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'custom_design_photo', maxCount: 1 },
  { name: 'custom_design_back_photo', maxCount: 1 }
]);

function handlePhotoUpload(req, res, next) {
  uploadCardFields(req, res, (err) => {
    if (err) {
      console.error('Admin photo upload error:', err.name, err.message);
      req.uploadError = 'Fichier invalide ou trop volumineux (5 Mo maximum, formats jpg/png/gif/webp).';
    }
    next();
  });
}

async function withPendingCount(req, res, next) {
  try {
    const [[requests]] = await db.query('SELECT COUNT(*) AS count FROM cards WHERE is_request = 1');
    res.locals.pendingRequestsCount = requests.count;
    const [[toPrint]] = await db.query(
      "SELECT COUNT(*) AS count FROM cards WHERE is_active = 1 AND is_request = 0 AND (print_status IS NULL OR print_status != 'sent')"
    );
    res.locals.pendingPrintCount = toPrint.count;
  } catch (error) {
    console.error('Pending count error:', error);
    res.locals.pendingRequestsCount = 0;
    res.locals.pendingPrintCount = 0;
  }
  next();
}

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

router.post('/login', loginLimiter, verifyCsrf, async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim().slice(0, 255) : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  try {
    const [admins] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);

    if (admins.length === 0) {
      await bcrypt.compare(password || 'x', DUMMY_HASH);
      return res.render('admin/login', { error: 'Identifiants invalides' });
    }

    const admin = admins[0];
    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      return res.render('admin/login', { error: 'Identifiants invalides' });
    }

    const csrfToken = req.session.csrfToken;
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
        return res.render('admin/login', { error: 'Erreur serveur' });
      }
      req.session.isAdmin = true;
      req.session.adminId = admin.id;
      req.session.csrfToken = csrfToken;
      req.session.save(() => res.redirect('/admin/dashboard'));
    });
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { error: 'Erreur serveur' });
  }
});

router.post('/logout', isAuthenticated, verifyCsrf, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('nfc.sid');
    res.redirect('/admin/login');
  });
});

function renderPreview(req, res) {
  const source = req.method === 'GET' ? req.query : req.body;
  const card = buildPreviewCard(source);
  res.render(`profile/${resolve(card.template)}`, { card, theme: getTheme(card) });
}

router.get('/preview', isAuthenticated, renderPreview);
router.post('/preview', isAuthenticated, renderPreview);

router.get('/dashboard', isAuthenticated, withPendingCount, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE is_request = 0 ORDER BY created_at DESC');
    const templateNames = Object.fromEntries(templates.map((t) => [t.id, t.name]));
    res.render('admin/dashboard', { cards, templateNames });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.get('/print-queue', isAuthenticated, withPendingCount, async (req, res) => {
  try {
    const [cards] = await db.query(
      "SELECT * FROM cards WHERE is_active = 1 AND is_request = 0 AND (print_status IS NULL OR print_status != 'sent') ORDER BY created_at ASC"
    );
    const templateNames = Object.fromEntries(templates.map((t) => [t.id, t.name]));
    res.render('admin/print-queue', { cards, templateNames });
  } catch (error) {
    console.error('Print queue error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.get('/requests', isAuthenticated, withPendingCount, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE is_request = 1 ORDER BY created_at DESC');
    const physicalStyleNames = Object.fromEntries(physicalStyles.map((s) => [s.id, s.name]));
    res.render('admin/requests', { cards, socialNetworks: SOCIAL_NETWORKS, physicalStyleNames });
  } catch (error) {
    console.error('Requests list error:', error);
    res.status(500).send('Erreur serveur');
  }
});

async function notifyApprovedCustomer(card) {
  if (!card || !card.contact_phone) return;
  try {
    const baseUrl = process.env.BASE_DOMAIN || 'localhost:3000';
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

router.post('/requests/:id/approve', isAuthenticated, verifyCsrf, async (req, res) => {
  try {
    await db.query('UPDATE cards SET is_active = 1, is_request = 0 WHERE id = ?', [req.params.id]);
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    notifyApprovedCustomer(cards[0]);
    res.redirect('/admin/requests');
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.get('/cards/new', isAuthenticated, withPendingCount, async (req, res) => {
  res.render('admin/card-form', await formLocals(null, null));
});

router.post('/cards', isAuthenticated, handlePhotoUpload, verifyCsrf, async (req, res) => {
  const fields = sanitizeCardInput(req.body);

  if (req.uploadError) {
    return res.render('admin/card-form', await formLocals(fields, req.uploadError));
  }

  if (!fields.name) {
    return res.render('admin/card-form', await formLocals(fields, 'Le nom est requis'));
  }

  try {
    let photoUrl = sanitizeHttpsUrl(req.body.existing_photo_url, 500) || '';
    if (req.files && req.files.photo && req.files.photo[0]) {
      const result = await uploadBuffer(req.files.photo[0].buffer);
      photoUrl = result.secure_url;
    }

    let customDesignUrl = sanitizeHttpsUrl(req.body.existing_custom_design_url, 500) || '';
    if (resolvePhysicalStyle(fields.physical_style) === 'custom' && req.files && req.files.custom_design_photo && req.files.custom_design_photo[0]) {
      const result = await uploadDesignBuffer(req.files.custom_design_photo[0].buffer);
      customDesignUrl = result.secure_url;
    }

    let customDesignBackUrl = sanitizeHttpsUrl(req.body.existing_custom_design_back_url, 500) || '';
    if (resolvePhysicalStyle(fields.physical_style) === 'custom' && req.files && req.files.custom_design_back_photo && req.files.custom_design_back_photo[0]) {
      const result = await uploadDesignBuffer(req.files.custom_design_back_photo[0].buffer);
      customDesignBackUrl = result.secure_url;
    }

    const cardId = uuidv4().replace(/-/g, '');

    await db.query(
      `INSERT INTO cards (card_id, name, title, bio, photo_url, theme_color, template, physical_style, custom_design_url, custom_design_back_url, snapchat, tiktok, whatsapp, linkedin, instagram, facebook)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cardId, fields.name, fields.title, fields.bio, photoUrl, fields.theme_color, resolve(fields.template), resolvePhysicalStyle(fields.physical_style), customDesignUrl, customDesignBackUrl, fields.snapchat, fields.tiktok, fields.whatsapp, fields.linkedin, fields.instagram, fields.facebook]
    );

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Create card error:', error);
    res.render('admin/card-form', await formLocals(fields, 'Erreur lors de la création de la carte'));
  }
});

router.get('/cards/:id/edit', isAuthenticated, withPendingCount, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);

    if (cards.length === 0) {
      return res.status(404).send('Carte non trouvée');
    }

    res.render('admin/card-form', await formLocals(cards[0], null));
  } catch (error) {
    console.error('Edit card error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.post('/cards/:id', isAuthenticated, handlePhotoUpload, verifyCsrf, async (req, res) => {
  const fields = sanitizeCardInput(req.body);

  if (req.uploadError) {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    return res.render('admin/card-form', await formLocals(cards[0] || fields, req.uploadError));
  }

  if (!fields.name) {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    return res.render('admin/card-form', await formLocals(cards[0] || fields, 'Le nom est requis'));
  }

  try {
    let photoUrl = sanitizeHttpsUrl(req.body.existing_photo_url, 500) || '';
    if (req.files && req.files.photo && req.files.photo[0]) {
      const result = await uploadBuffer(req.files.photo[0].buffer);
      photoUrl = result.secure_url;
    }

    let customDesignUrl = sanitizeHttpsUrl(req.body.existing_custom_design_url, 500) || '';
    if (resolvePhysicalStyle(fields.physical_style) === 'custom' && req.files && req.files.custom_design_photo && req.files.custom_design_photo[0]) {
      const result = await uploadDesignBuffer(req.files.custom_design_photo[0].buffer);
      customDesignUrl = result.secure_url;
    }

    let customDesignBackUrl = sanitizeHttpsUrl(req.body.existing_custom_design_back_url, 500) || '';
    if (resolvePhysicalStyle(fields.physical_style) === 'custom' && req.files && req.files.custom_design_back_photo && req.files.custom_design_back_photo[0]) {
      const result = await uploadDesignBuffer(req.files.custom_design_back_photo[0].buffer);
      customDesignBackUrl = result.secure_url;
    }

    await db.query(
      `UPDATE cards SET name = ?, title = ?, bio = ?, photo_url = ?, theme_color = ?, template = ?, physical_style = ?, custom_design_url = ?, custom_design_back_url = ?, snapchat = ?, tiktok = ?, whatsapp = ?, linkedin = ?, instagram = ?, facebook = ?, is_active = ?, is_request = 0 WHERE id = ?`,
      [fields.name, fields.title, fields.bio, photoUrl, fields.theme_color, resolve(fields.template), resolvePhysicalStyle(fields.physical_style), customDesignUrl, customDesignBackUrl, fields.snapchat, fields.tiktok, fields.whatsapp, fields.linkedin, fields.instagram, fields.facebook, fields.is_active ? 1 : 0, req.params.id]
    );

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Update card error:', error);
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    res.render('admin/card-form', await formLocals(cards[0], 'Erreur lors de la mise à jour de la carte'));
  }
});

router.get('/cards/:id/card-preview', isAuthenticated, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);

    if (cards.length === 0) {
      return res.status(404).send('Carte non trouvée');
    }

    const card = cards[0];
    const styleId = resolvePhysicalStyle(card.physical_style);
    const style = physicalStyles.find((s) => s.id === styleId) || null;
    const styleName = styleId === 'custom' ? 'Design personnalisé' : style.name;
    const baseUrl = process.env.BASE_DOMAIN || 'localhost:3000';
    const orderUrl = `https://${baseUrl}/commander?physical=${encodeURIComponent(styleId)}`;
    const qrSrc = await QRCode.toDataURL(orderUrl, {
      width: 260,
      margin: 1,
      color: { dark: '#111111', light: '#FFFFFF' }
    });

    res.render('admin/partials/card-preview-fragment', { card, style, styleName, qrSrc });
  } catch (error) {
    console.error('Card preview error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.post('/print', isAuthenticated, verifyCsrf, async (req, res) => {
  let ids = req.body.card_ids;
  if (!ids) ids = [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = [...new Set(ids.map((id) => parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 200);

  if (ids.length === 0) {
    return res.status(400).send('Aucune carte sélectionnée.');
  }

  try {
    const [cards] = await db.query(
      'SELECT * FROM cards WHERE id IN (?) AND is_active = 1 AND is_request = 0',
      [ids]
    );

    if (cards.length === 0) {
      return res.status(400).send('Aucune carte active trouvée pour ces identifiants.');
    }

    const foundIds = cards.map((c) => c.id);

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const pdfDone = new Promise((resolve) => doc.on('end', resolve));
    await buildPrintSheet(doc, cards, { baseUrl: process.env.BASE_DOMAIN });
    doc.end();
    await pdfDone;

    await db.query(
      "UPDATE cards SET print_status = 'sent', sent_to_print_at = NOW() WHERE id IN (?)",
      [foundIds]
    );

    cards.forEach((card) => {
      if (card.contact_phone) {
        sendWhatsAppMessage(card.contact_phone, fulfillment.messageFor('production', card.name));
      }
    });

    const pdfBuffer = Buffer.concat(chunks);
    const filename = `planche-impression-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

    sendWhatsAppDocument(
      process.env.GOWA_ADMIN_PHONE,
      pdfBuffer,
      filename,
      `Planche d'impression — ${cards.length} carte(s)`
    );
  } catch (error) {
    console.error('Print sheet error:', error);
    if (!res.headersSent) res.status(500).send('Erreur lors de la génération du PDF.');
  }
});

router.get('/fulfillment', isAuthenticated, withPendingCount, async (req, res) => {
  try {
    const [cards] = await db.query(
      "SELECT * FROM cards WHERE is_active = 1 AND is_request = 0 AND print_status = 'sent' ORDER BY sent_to_print_at ASC"
    );
    cards.forEach((card) => {
      card.nextStage = fulfillment.nextStage(card.fulfillment_status);
    });
    res.render('admin/fulfillment', { cards, labels: fulfillment.LABELS, badgeClasses: fulfillment.BADGE_CLASSES });
  } catch (error) {
    console.error('Fulfillment list error:', error);
    res.status(500).send('Erreur serveur');
  }
});

async function advanceFulfillment(card) {
  const next = fulfillment.nextStage(card.fulfillment_status);
  if (!next) return null;
  await db.query('UPDATE cards SET fulfillment_status = ? WHERE id = ?', [next, card.id]);
  if (card.contact_phone) {
    const message = fulfillment.messageFor(next, card.name);
    sendWhatsAppMessage(card.contact_phone, message);
  }
  return next;
}

router.post('/fulfillment/:id/advance', isAuthenticated, verifyCsrf, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    if (cards.length === 0) return res.status(404).send('Carte non trouvée');
    await advanceFulfillment(cards[0]);
    res.redirect('/admin/fulfillment');
  } catch (error) {
    console.error('Advance fulfillment error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.post('/fulfillment/bulk-advance', isAuthenticated, verifyCsrf, async (req, res) => {
  let ids = req.body.card_ids;
  if (!ids) ids = [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = [...new Set(ids.map((id) => parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 200);

  if (ids.length === 0) {
    return res.status(400).send('Aucune carte sélectionnée.');
  }

  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE id IN (?)', [ids]);
    for (const card of cards) {
      await advanceFulfillment(card);
    }
    res.redirect('/admin/fulfillment');
  } catch (error) {
    console.error('Bulk advance fulfillment error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.post('/cards/:id/delete', isAuthenticated, verifyCsrf, async (req, res) => {
  const returnTo = req.body.return_to === '/admin/requests' ? '/admin/requests' : '/admin/dashboard';
  try {
    await db.query('DELETE FROM cards WHERE id = ?', [req.params.id]);
    res.redirect(returnTo);
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
