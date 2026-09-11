const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter(req, file, cb) {
    cb(null, ALLOWED_MIME_TYPES.has(file.mimetype));
  }
});

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'nfc_cards',
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Higher-resolution upload for physical card designs meant for print (300 DPI at ~91x61mm ≈ 1075x718px with bleed).
function uploadDesignBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'nfc_cards/designs',
        transformation: [{ width: 2000, height: 2000, crop: 'limit' }]
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, upload, uploadBuffer, uploadDesignBuffer };
