const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { ensureCsrf, verifyCsrf } = require('../middleware/csrf');
const { sanitizeCardInput } = require('../lib/sanitize');
const { categories, templates, resolve, getTheme, buildPreviewCard } = require('../config/templates');

const DUMMY_HASH = bcrypt.hashSync('timing-pad', 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Trop de tentatives. Réessayez plus tard.'
});

router.use(ensureCsrf);
router.use(verifyCsrf);

function formLocals(card, error) {
  return { card, error, templates, categories };
}

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

router.post('/login', loginLimiter, async (req, res) => {
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

router.post('/logout', isAuthenticated, (req, res) => {
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

router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards ORDER BY created_at DESC');
    const templateNames = Object.fromEntries(templates.map((t) => [t.id, t.name]));
    res.render('admin/dashboard', { cards, templateNames });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.get('/cards/new', isAuthenticated, (req, res) => {
  res.render('admin/card-form', formLocals(null, null));
});

router.post('/cards', isAuthenticated, async (req, res) => {
  const fields = sanitizeCardInput(req.body);

  if (!fields.name) {
    return res.render('admin/card-form', formLocals(fields, 'Le nom est requis'));
  }

  try {
    const cardId = uuidv4().replace(/-/g, '');

    await db.query(
      `INSERT INTO cards (card_id, name, title, bio, photo_url, theme_color, template, snapchat, tiktok, whatsapp, linkedin, instagram, facebook) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cardId, fields.name, fields.title, fields.bio, fields.photo_url, fields.theme_color, resolve(fields.template), fields.snapchat, fields.tiktok, fields.whatsapp, fields.linkedin, fields.instagram, fields.facebook]
    );

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Create card error:', error);
    res.render('admin/card-form', formLocals(fields, 'Erreur lors de la création de la carte'));
  }
});

router.get('/cards/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);

    if (cards.length === 0) {
      return res.status(404).send('Carte non trouvée');
    }

    res.render('admin/card-form', formLocals(cards[0], null));
  } catch (error) {
    console.error('Edit card error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.post('/cards/:id', isAuthenticated, async (req, res) => {
  const fields = sanitizeCardInput(req.body);

  if (!fields.name) {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    return res.render('admin/card-form', formLocals(cards[0] || fields, 'Le nom est requis'));
  }

  try {
    await db.query(
      `UPDATE cards SET name = ?, title = ?, bio = ?, photo_url = ?, theme_color = ?, template = ?, snapchat = ?, tiktok = ?, whatsapp = ?, linkedin = ?, instagram = ?, facebook = ?, is_active = ? WHERE id = ?`,
      [fields.name, fields.title, fields.bio, fields.photo_url, fields.theme_color, resolve(fields.template), fields.snapchat, fields.tiktok, fields.whatsapp, fields.linkedin, fields.instagram, fields.facebook, fields.is_active ? 1 : 0, req.params.id]
    );

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Update card error:', error);
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    res.render('admin/card-form', formLocals(cards[0], 'Erreur lors de la mise à jour de la carte'));
  }
});

router.post('/cards/:id/delete', isAuthenticated, async (req, res) => {
  try {
    await db.query('DELETE FROM cards WHERE id = ?', [req.params.id]);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
