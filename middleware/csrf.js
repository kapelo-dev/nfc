const crypto = require('crypto');

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function ensureCsrf(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session ? req.session.csrfToken : '';
  next();
}

function verifyCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  const sent = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  const expected = req.session && req.session.csrfToken;
  if (!expected || !safeEqual(sent, expected)) {
    return res.status(403).send('Requête refusée');
  }
  next();
}

module.exports = { ensureCsrf, verifyCsrf };
