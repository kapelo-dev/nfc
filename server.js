const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { requireSessionSecret } = require('./config/env');
const db = require('./config/database');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(express.urlencoded({ extended: true, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionStore = new MySQLStore({
  createDatabaseTable: true,
  clearExpired: true,
  endConnectionOnClose: false
}, db);

app.use(session({
  name: 'nfc.sid',
  secret: requireSessionSecret(),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use('/admin', adminRoutes);
app.use('/c', profileRoutes);

app.get('/', (req, res) => {
  res.status(200).type('html').send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFC Card</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f6f8; color: #0f172a; }
    main { text-align: center; }
    h1 { font-size: 1.4rem; font-weight: 650; }
    p { color: #64748b; margin-top: 8px; }
  </style>
</head>
<body>
  <main>
    <h1>NFC Card</h1>
    <p>Cartes de profil</p>
  </main>
</body>
</html>`);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
