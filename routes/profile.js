const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { resolve, getTheme } = require('../config/templates');

router.get('/:card_id', async (req, res) => {
  try {
    const [cards] = await db.query('SELECT * FROM cards WHERE card_id = ? AND is_active = true', [req.params.card_id]);
    
    if (cards.length === 0) {
      return res.status(404).render('profile/not-found');
    }
    
    const card = cards[0];
    res.render(`profile/${resolve(card.template)}`, { card, theme: getTheme(card) });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).render('profile/not-found');
  }
});

module.exports = router;
