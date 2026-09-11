const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function clip(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function sanitizeThemeColor(value) {
  const v = clip(value, 7);
  return HEX_COLOR.test(v) ? v : '#42a5f5';
}

function sanitizeHttpsUrl(value, max = 500) {
  const v = clip(value, max);
  if (!v) return '';
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:') return '';
    return url.href.slice(0, max);
  } catch {
    return '';
  }
}

function sanitizeHandle(value, max = 255) {
  const v = clip(value, max);
  if (!v) return '';
  if (/^(javascript|data|vbscript):/i.test(v)) return '';
  if (/^https:\/\//i.test(v)) return sanitizeHttpsUrl(v, max);
  if (/^https?:/i.test(v) || /^\/\//.test(v)) return '';
  return v;
}

const PHONE_ALLOWED = /[^0-9+ .()-]/g;

function sanitizePhone(value) {
  const v = clip(value, 30).replace(PHONE_ALLOWED, '');
  return v;
}

function sanitizeCardInput(body) {
  const src = body || {};
  return {
    name: clip(src.name, 255),
    title: clip(src.title, 255),
    bio: clip(src.bio, 2000),
    photo_url: sanitizeHttpsUrl(src.photo_url, 500),
    theme_color: sanitizeThemeColor(src.theme_color),
    template: src.template,
    physical_style: src.physical_style,
    snapchat: sanitizeHandle(src.snapchat),
    tiktok: sanitizeHandle(src.tiktok),
    whatsapp: sanitizeHandle(src.whatsapp),
    linkedin: sanitizeHandle(src.linkedin),
    instagram: sanitizeHandle(src.instagram),
    facebook: sanitizeHandle(src.facebook),
    is_active: src.is_active
  };
}

function httpsHref(value, prefix, transform) {
  const v = clip(value, 500);
  if (!v) return '';
  if (/^https:\/\//i.test(v)) return sanitizeHttpsUrl(v) || '#';
  const handle = transform ? transform(v) : v;
  return prefix + encodeURIComponent(handle);
}

module.exports = {
  sanitizeThemeColor,
  sanitizeHttpsUrl,
  sanitizeHandle,
  sanitizePhone,
  sanitizeCardInput,
  httpsHref
};
