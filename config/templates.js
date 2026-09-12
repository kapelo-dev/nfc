const categories = [
  { id: 'pro', label: 'Professionnel' },
  { id: 'dark', label: 'Fond sombre' },
  { id: 'pink', label: 'Rose' }
];

const templates = [
  { id: 'default', name: 'Classique', category: 'pro', preview: { bg: '#dbeafe', card: '#42a5f5', text: '#fff' } },
  { id: 'douceur', name: 'Douceur', category: 'pro', preview: { bg: '#faf8f4', card: '#8a9a7e', text: '#3a362f' } },
  { id: 'carte', name: 'Carte premium', category: 'pro', preview: { bg: '#eef0f2', card: '#23262b', text: '#1b1d21' } },
  { id: 'prestige', name: 'Prestige', category: 'dark', preview: { bg: '#0f0c09', card: '#c9a24d', text: '#f2ece1' } },
  { id: 'neon', name: 'Néon', category: 'dark', preview: { bg: '#050510', card: '#00f0ff', text: '#ff2fd0' } },
  { id: 'barbie', name: 'Barbie', category: 'pink', preview: { bg: '#ffd1e8', card: '#ff2f92', text: '#fff' } }
];

const { sanitizeThemeColor, sanitizeCardInput } = require('../lib/sanitize');

const ids = new Set(templates.map((t) => t.id));

function resolve(id) {
  return ids.has(id) ? id : 'default';
}

function buildPreviewCard(input) {
  const src = sanitizeCardInput(input || {});
  const socialKeys = ['snapchat', 'tiktok', 'whatsapp', 'linkedin', 'instagram', 'facebook'];
  const hasSocial = socialKeys.some((k) => src[k]);
  const demo = {
    snapchat: 'preview',
    tiktok: '@preview',
    whatsapp: '33600000000',
    linkedin: 'preview',
    instagram: 'preview',
    facebook: 'preview'
  };
  const card = {
    name: src.name || 'Alex Martin',
    title: src.title,
    bio: src.bio,
    photo_url: src.photo_url,
    theme_color: src.theme_color,
    template: resolve(src.template)
  };
  socialKeys.forEach((k) => {
    card[k] = hasSocial ? (src[k] || '') : demo[k];
  });
  return card;
}

function getTheme(card) {
  const themeColor = sanitizeThemeColor(card && card.theme_color);
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(themeColor);
  const rgb = result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 66, g: 165, b: 245 };
  return {
    color: themeColor,
    rgb,
    light: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
    medium: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`
  };
}

module.exports = { categories, templates, resolve, getTheme, buildPreviewCard };
