// "En production" isn't a stage here — it's the same event as sending the card to print
// (see routes/admin.js POST /print), which already notifies the client. This pipeline only
// covers what comes after that: the card is ready, then withdrawn.
const STAGES = ['ready', 'withdrawn'];

const LABELS = {
  production: 'En production',
  ready: 'Prête',
  withdrawn: 'Retirée'
};

const BADGE_CLASSES = {
  production: 'kt-badge-info',
  ready: 'kt-badge-warning',
  withdrawn: 'kt-badge-success'
};

function messageFor(stage, name) {
  const safeName = name || 'cher client';
  switch (stage) {
    case 'production':
      return `Bonjour ${safeName}, votre carte NFC est maintenant en cours de fabrication. Nous vous tiendrons informé(e) de son avancement.`;
    case 'ready':
      return `Bonjour ${safeName}, bonne nouvelle : votre carte NFC est prête ! Vous pouvez venir la récupérer.`;
    case 'withdrawn':
      return `Bonjour ${safeName}, nous confirmons que votre carte NFC a bien été retirée. Merci et à bientôt !`;
    default:
      return null;
  }
}

function nextStage(current) {
  if (!current) return STAGES[0];
  const idx = STAGES.indexOf(current);
  if (idx === -1 || idx === STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

module.exports = { STAGES, LABELS, BADGE_CLASSES, messageFor, nextStage };
