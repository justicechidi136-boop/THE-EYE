export const AUTH_VALIDATION_RULES = {
  passwordMinLength: 8,
  otpLength: 6,
  resetTokenMinLength: 10,
  resendCooldownSeconds: 60,
} as const;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OTP_PATTERN = /^\d{6}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function validateLoginEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address.";
  if (!isValidEmail(trimmed)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Enter your password.";
  if (password.length < AUTH_VALIDATION_RULES.passwordMinLength) {
    return `Password must be at least ${AUTH_VALIDATION_RULES.passwordMinLength} characters.`;
  }
  return null;
}

export function validateOtpCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Enter the verification code.";
  if (!OTP_PATTERN.test(trimmed)) return "Enter the 6-digit code sent to your phone.";
  return null;
}

export function validateResetToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return "Enter the reset token.";
  if (trimmed.length < AUTH_VALIDATION_RULES.resetTokenMinLength) {
    return "Enter the full token from your email.";
  }
  return null;
}

export function sanitizeOtpInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(0, AUTH_VALIDATION_RULES.otpLength);
}

export function validateLoginForm(email: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const emailError = validateLoginEmail(email);
  const passwordError = validatePassword(password);
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  return errors;
}
