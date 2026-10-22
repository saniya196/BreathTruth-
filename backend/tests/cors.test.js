const test = require('node:test');
const assert = require('node:assert/strict');
const { createAllowedOrigins, isAllowedOrigin } = require('../utils/cors');

const allowedOrigins = createAllowedOrigins('');

test('allows production and required local origins', () => {
  for (const origin of [
    'https://breath-truth-frontend.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ]) {
    assert.equal(isAllowedOrigin(origin, allowedOrigins), true);
  }
});

test('preserves explicitly configured CLIENT_URL origins', () => {
  const origins = createAllowedOrigins('https://portal.example, https://admin.example/');
  assert.equal(isAllowedOrigin('https://portal.example', origins), true);
  assert.equal(isAllowedOrigin('https://admin.example', origins), true);
});

test('rejects configured origins containing a path', () => {
  const origins = createAllowedOrigins('https://portal.example/app');
  assert.equal(isAllowedOrigin('https://portal.example', origins), false);
  assert.equal(isAllowedOrigin('https://portal.example/app', origins), false);
});

test('rejects unapproved and malicious lookalike origins', () => {
  for (const origin of [
    'https://evil.example',
    'https://random-preview.vercel.app',
    'http://localhost:5173',
    'https://breath-truth-frontend.vercel.app.evil.example',
    'not-a-url',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com?query=1',
    'https://example.com#fragment'
  ]) {
    assert.equal(isAllowedOrigin(origin, allowedOrigins), false);
  }
});

test('allows requests without an Origin header', () => {
  assert.equal(isAllowedOrigin(undefined, allowedOrigins), true);
});
