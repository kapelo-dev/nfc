const path = require('path');
const ejs = require('ejs');
const { getBrowser, hasLocalChrome } = require('./browser');
const { physicalStyles } = require('../config/physicalStyles');

const NATIVE_W = 180;
const CARD_ASPECT = 1.586;
const RENDER_SCALE = 6;

const TEMPLATE_PATH = path.join(__dirname, '../views/print/physical-card-print.ejs');

function baseHrefFor(baseUrl) {
  const isLocalHost = /^(localhost|127\.0\.0\.1)/.test(baseUrl);
  // A serverless function can never reach back into its own "localhost:3000" — that value
  // only makes sense against a real local dev server. Seeing it here means BASE_DOMAIN isn't
  // set for this environment; fail with a clear message instead of a cryptic ECONNREFUSED deep
  // inside Puppeteer once page.goto() tries (and fails) to connect to it.
  if (isLocalHost && !hasLocalChrome()) {
    throw new Error(
      `BASE_DOMAIN n'est pas configuré (valeur reçue : "${baseUrl}") — ajoutez la variable d'environnement BASE_DOMAIN sur Vercel avec votre vrai domaine de production.`
    );
  }
  const protocol = isLocalHost ? 'http' : 'https';
  return `${protocol}://${baseUrl}/`;
}

// Renders a batch of (non-custom) physical-style cards to front/back PNG buffers by loading
// the real physical-card.ejs partial in headless Chromium — the same markup the web preview
// uses — instead of a hand-drawn PDFKit approximation. This is the fix for the PDF/print
// output drifting from whatever style the customer actually picked: see memory
// pdf-print-matches-web-render.
async function renderPhysicalCardBatch(cards, { baseUrl, qrCaptionHtml, qrSrcFor }) {
  const width = Math.ceil(NATIVE_W * RENDER_SCALE);
  const height = Math.ceil((NATIVE_W / CARD_ASPECT) * RENDER_SCALE);
  const baseHref = baseHrefFor(baseUrl);

  const browser = await getBrowser();
  const results = {};
  try {
    for (const card of cards) {
      const style = physicalStyles.find((s) => s.id === card.physical_style) || physicalStyles[0];
      const html = await ejs.renderFile(TEMPLATE_PATH, {
        baseHref,
        nativeW: NATIVE_W,
        scale: RENDER_SCALE,
        style,
        qrSrc: qrSrcFor(card),
        qrCaption: qrCaptionHtml,
        card
      });

      // A fresh page per card, not a reused one: calling page.setContent() more than once on
      // the same page reliably hangs "networkidle0" past its timeout in this Chromium build
      // (the frame's lifecycle events don't refire the way they do after a real navigation).
      const page = await browser.newPage();
      try {
        await page.setViewport({ width, height });
        // Helmet sends Cross-Origin-Resource-Policy: same-origin on our static assets, so a
        // bare page.setContent() (origin "about:blank") gets every local CSS/image request
        // blocked with net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin. Navigating to a same-origin
        // page first gives the frame the right origin before swapping in the real markup.
        await page.goto(baseHref, { waitUntil: 'load' });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
        const el = await page.$('.render-scale');
        const front = await el.screenshot({ type: 'png' });

        await page.evaluate(() => {
          const inner = document.querySelector('[data-card-inner]');
          inner.style.transition = 'none';
          inner.style.transform = 'rotateY(180deg)';
        });
        const back = await el.screenshot({ type: 'png' });

        results[card.id] = { front, back };
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

module.exports = { renderPhysicalCardBatch };
