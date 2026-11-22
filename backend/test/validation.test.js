const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, validateRegistration } = require('../src/utils/validation');

test('normalizeEmail trims and lowercases email addresses', () => {
  assert.equal(normalizeEmail('  Lam@Example.COM '), 'lam@example.com');
});

test('validateRegistration rejects malformed email and weak password', () => {
  assert.match(validateRegistration({ email: 'invalid', password: '12345678', displayName: 'Lâm' }).error, /Email/);
  assert.match(validateRegistration({ email: 'lam@example.com', password: '123', displayName: 'Lâm' }).error, /Mật khẩu/);
});

test('validateRegistration returns normalized fields for valid input', () => {
  assert.deepEqual(
    validateRegistration({ email: ' LAM@EXAMPLE.COM ', password: 'mat-khau-an-toan', displayName: '  Lâm  ' }),
    { normalizedEmail: 'lam@example.com', normalizedName: 'Lâm' }
  );
});
