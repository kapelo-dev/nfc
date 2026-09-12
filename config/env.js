const WEAK_SECRETS = new Set([
  'your-secret-key',
  'your_secret_key_here',
  'change-me',
  'secret',
  'session_secret'
]);

const WEAK_PASSWORDS = new Set([
  'admin123',
  'admin',
  'password',
  'password123',
  '12345678',
  'changeme'
]);

function sslConfig() {
  if (process.env.DB_SSL === 'false' || process.env.DB_SSL === '0') return undefined;
  if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
    return { rejectUnauthorized: process.env.DB_SSL_REJECT !== 'false' };
  }
  return undefined;
}

function dbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nfc_cards_db',
    port: Number(process.env.DB_PORT) || 3306,
    ssl: sslConfig()
  };
}

function requireSessionSecret() {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32 || WEAK_SECRETS.has(secret)) {
    console.error('SESSION_SECRET must be a random string of at least 32 characters.');
    process.exit(1);
  }
  return secret;
}

function requireAdminPassword() {
  const password = process.env.ADMIN_PASSWORD || '';
  if (password.length < 12 || WEAK_PASSWORDS.has(password.toLowerCase())) {
    console.error('ADMIN_PASSWORD must be at least 12 characters and not a common password.');
    process.exit(1);
  }
  return password;
}

// Every call site builds URLs as `https://${baseDomain}/...` — BASE_DOMAIN is meant to be a
// bare host (e.g. "moncardnfc.com"), but it's an easy mistake to paste it with a scheme and/or
// a trailing slash (e.g. "https://moncardnfc.com/"), which silently produces broken
// "https://https://..." URLs. Strip both defensively instead of trusting every env var value.
function getBaseDomain() {
  const raw = process.env.BASE_DOMAIN || 'localhost:3000';
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

module.exports = {
  dbConfig,
  requireSessionSecret,
  requireAdminPassword,
  getBaseDomain
};
