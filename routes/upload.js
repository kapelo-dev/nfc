const express = require('express');
const router = express.Router();
const { upload, uploadBuffer } = require('../config/cloudinary');
const { isAuthenticated } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');

router.post('/image', isAuthenticated, verifyCsrf, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err.name, err.message);
      return res.status(400).json({ error: 'Erreur lors du téléchargement de l\'image' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie (formats acceptés : jpg, png, gif, webp)' });
    }

    try {
      const result = await uploadBuffer(req.file.buffer);
      res.json({
        success: true,
        url: result.secure_url,
        public_id: result.public_id
      });
    } catch (error) {
      console.error('Cloudinary upload error:', error.message);
      res.status(502).json({ error: 'Erreur lors du téléchargement de l\'image' });
    }
  });
});

module.exports = router;
