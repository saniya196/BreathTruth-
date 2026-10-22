const DEFAULT_ALLOWED_ORIGINS = [
  'https://breath-truth-frontend.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const normalizeOrigin = (origin) => {
  const value = String(origin || '').trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || (url.pathname !== '' && url.pathname !== '/')
      || url.search
      || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

function createAllowedOrigins(clientUrl = '') {
  return [...new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...String(clientUrl || '').split(',').map(normalizeOrigin).filter(Boolean)
  ])];
}

function isAllowedOrigin(origin, allowedOrigins = DEFAULT_ALLOWED_ORIGINS) {
  if (origin == null || String(origin).trim() === '') return true;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowedOrigins.includes(normalized);
}

module.exports = { DEFAULT_ALLOWED_ORIGINS, createAllowedOrigins, isAllowedOrigin };
