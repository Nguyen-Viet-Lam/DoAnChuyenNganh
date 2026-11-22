const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateRegistration({ email, password, displayName }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(displayName || '').trim();

  if (!normalizedName || normalizedName.length > 80) {
    return { error: 'Tên hiển thị phải có từ 1 đến 80 ký tự' };
  }
  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
    return { error: 'Email không đúng định dạng' };
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return { error: 'Mật khẩu phải có từ 8 đến 128 ký tự' };
  }

  return { normalizedEmail, normalizedName };
}

module.exports = { normalizeEmail, validateRegistration };
