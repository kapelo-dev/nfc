const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const [admins] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    
    if (admins.length === 0) {
      return res.render('admin/login', { error: 'Identifiants invalides' });
    }
    
    const admin = admins[0];
    const isValid = await bcrypt.compare(password, admin.password);
    
    if (!isValid) {
      return res.render('admin/login', { error: 'Identifiants invalides' });
    }
    
    req.session.isAdmin = true;
    req.session.adminId = admin.id;
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { error: 'Erreur serveur' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards ORDER BY created_at DESC');
    res.render('admin/dashboard', { cards });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.get('/cards/new', isAuthenticated, (req, res) => {
  res.render('admin/card-form', { card: null, error: null });
});

router.post('/cards', isAuthenticated, async (req, res) => {
  const { name, title, bio, photo_url, theme_color, snapchat, tiktok, whatsapp, linkedin, instagram, facebook } = req.body;
  
  try {
    const cardId = uuidv4().replace(/-/g, '').substring(0, 12);
    
    await db.query(
      `INSERT INTO cards (card_id, name, title, bio, photo_url, theme_color, snapchat, tiktok, whatsapp, linkedin, instagram, facebook) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cardId, name, title, bio, photo_url, theme_color || '#42a5f5', snapchat, tiktok, whatsapp, linkedin, instagram, facebook]
    );
    
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Create card error:', error);
    res.render('admin/card-form', { 
      card: req.body, 
      error: 'Erreur lors de la création de la carte' 
    });
  }
});

router.get('/cards/:id/edit', isAuthenticated, async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    
    if (cards.length === 0) {
      return res.status(404).send('Carte non trouvée');
    }
    
    res.render('admin/card-form', { card: cards[0], error: null });
  } catch (error) {
    console.error('Edit card error:', error);
    res.status(500).send('Erreur serveur');
  }
});

router.post('/cards/:id', isAuthenticated, async (req, res) => {
  const { name, title, bio, photo_url, theme_color, snapchat, tiktok, whatsapp, linkedin, instagram, facebook, is_active } = req.body;
  
  try {
    await db.query(
      `UPDATE cards SET name = ?, title = ?, bio = ?, photo_url = ?, theme_color = ?, snapchat = ?, tiktok = ?, whatsapp = ?, linkedin = ?, instagram = ?, facebook = ?, is_active = ? WHERE id = ?`,
      [name, title, bio, photo_url, theme_color || '#42a5f5', snapchat, tiktok, whatsapp, linkedin, instagram, facebook, is_active ? 1 : 0, req.params.id]
    );
    
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Update card error:', error);
    const [cards] = await db.query('SELECT * FROM cards WHERE id = ?', [req.params.id]);
    res.render('admin/card-form', { 
      card: cards[0], 
      error: 'Erreur lors de la mise à jour de la carte' 
    });
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
