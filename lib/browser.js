const fs = require('fs');

// Vercel's system env vars (VERCEL, VERCEL_ENV) aren't populated by default on this project
// (see memory: vercel-node-env-not-production), so branch on what's actually installed instead
// of guessing at the platform: if a system Chrome binary exists (local dev), use it; otherwise
// assume a serverless environment and fall back to @sparticuz/chromium's bundled binary.
const LOCAL_CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);

async function getBrowser() {
  const puppeteer = require('puppeteer-core');
  const localPath = LOCAL_CHROME_CANDIDATES.find((p) => fs.existsSync(p));

  if (localPath) {
    return puppeteer.launch({
      executablePath: localPath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  const chromium = require('@sparticuz/chromium');
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport
  });
}

module.exports = { getBrowser };
