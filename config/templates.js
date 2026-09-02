const categories = [
  { id: 'pro', label: 'Professionnel' },
  { id: 'dark', label: 'Fond sombre' },
  { id: 'pink', label: 'Rose' },
  { id: 'influencer', label: 'Influenceur' }
];

const templates = [
  { id: 'default', name: 'Classique', category: 'pro', preview: { bg: '#dbeafe', card: '#42a5f5', text: '#fff' } },
  { id: 'executive', name: 'Executive', category: 'pro', preview: { bg: '#0f172a', card: '#1e3a5f', text: '#c9a227' } },
  { id: 'minimal', name: 'Minimal', category: 'pro', preview: { bg: '#fafafa', card: '#ffffff', text: '#111' } },
  { id: 'luxe', name: 'Luxe', category: 'pro', preview: { bg: '#f5f0e8', card: '#c9a227', text: '#1a1a1a' } },
  { id: 'midnight', name: 'Minuit', category: 'dark', preview: { bg: '#0a0a0a', card: '#1a1a1a', text: '#fff' } },
  { id: 'neon', name: 'Néon', category: 'dark', preview: { bg: '#050510', card: '#00f0ff', text: '#ff00ea' } },
  { id: 'obsidian', name: 'Obsidienne', category: 'dark', preview: { bg: '#12100e', card: '#c9a227', text: '#fff' } },
  { id: 'noir', name: 'Noir cinéma', category: 'dark', preview: { bg: '#111111', card: '#222', text: '#e8e8e8' } },
  { id: 'blush', name: 'Blush', category: 'pink', preview: { bg: '#fce7f3', card: '#f9a8d4', text: '#831843' } },
  { id: 'rose', name: 'Rose bold', category: 'pink', preview: { bg: '#db2777', card: '#f472b6', text: '#fff' } },
  { id: 'sakura', name: 'Sakura', category: 'pink', preview: { bg: '#fff1f2', card: '#fda4af', text: '#9f1239' } },
  { id: 'barbie', name: 'Barbie', category: 'pink', preview: { bg: '#ec4899', card: '#fbcfe8', text: '#500724' } },
  { id: 'creator', name: 'Creator', category: 'influencer', preview: { bg: '#18181b', card: '#27272a', text: '#fff' } },
  { id: 'glass', name: 'Glass', category: 'influencer', preview: { bg: '#667eea', card: 'rgba(255,255,255,0.3)', text: '#fff' } },
  { id: 'aurora', name: 'Aurora', category: 'influencer', preview: { bg: '#c084fc', card: '#67e8f9', text: '#fff' } },
  { id: 'editorial', name: 'Editorial', category: 'influencer', preview: { bg: '#fff', card: '#111', text: '#111' } },
  { id: 'y2k', name: 'Y2K', category: 'influencer', preview: { bg: '#f0abfc', card: '#22d3ee', text: '#831843' } },
  { id: 'sunset', name: 'Sunset', category: 'influencer', preview: { bg: '#fb923c', card: '#f472b6', text: '#fff' } }
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
    title: src.title || 'Créateur de contenu',
    bio: src.bio || 'Voici un aperçu de votre carte NFC.',
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
