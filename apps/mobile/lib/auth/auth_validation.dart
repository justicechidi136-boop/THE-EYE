abstract final class AuthValidationRules {
  static const passwordMinLength = 8;
  static const otpLength = 6;
  static const resetTokenMinLength = 10;
  static const resendCooldownSeconds = 60;
  static const otpPattern = r"^\d{6}$";
}

enum LoginIdentifierKind { email, phone }

class LoginIdentifier {
  const LoginIdentifier({required this.kind, this.email, this.phone});

  final LoginIdentifierKind kind;
  final String? email;
  final String? phone;
}

class AuthFieldErrors {
  const AuthFieldErrors(this.values);

  final Map<String, String> values;

  String? operator [](String key) => values[key];
  bool get isEmpty => values.isEmpty;
}

String normalizePhoneNumber(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return "";

  var cleaned = trimmed.replaceAll(RegExp(r"[^\d+]"), "");
  if (cleaned.startsWith("00")) cleaned = "+${cleaned.substring(2)}";

  if (cleaned.startsWith("+")) {
    return "+${cleaned.substring(1).replaceAll(RegExp(r"\D"), "")}";
  }

  final digits = cleaned.replaceAll(RegExp(r"\D"), "");
  if (digits.startsWith("234") && digits.length == 13) return "+$digits";
  if (digits.startsWith("0") && digits.length == 11)
    return "+234${digits.substring(1)}";
  if (digits.length >= 10 && digits.length <= 15) return "+$digits";
  return "";
}

bool isValidEmail(String value) {
  final trimmed = value.trim();
  return RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").hasMatch(trimmed);
}

bool isValidPhoneNumber(String value) {
  final normalized = normalizePhoneNumber(value);
  return RegExp(r"^\+[1-9]\d{7,14}$").hasMatch(normalized);
}

LoginIdentifier parseLoginIdentifier(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) {
    return const LoginIdentifier(kind: LoginIdentifierKind.email);
  }
  if (trimmed.contains("@")) {
    return LoginIdentifier(
        kind: LoginIdentifierKind.email, email: trimmed.toLowerCase());
  }
  final phone = normalizePhoneNumber(trimmed);
  return LoginIdentifier(kind: LoginIdentifierKind.phone, phone: phone);
}

AuthFieldErrors validateLoginForm(
    {required String identifier, required String password}) {
  final errors = <String, String>{};
  final parsed = parseLoginIdentifier(identifier);

  if (parsed.kind == LoginIdentifierKind.email) {
    if (identifier.trim().isEmpty) {
      errors["identifier"] = "Enter your email or phone number.";
    } else if (!isValidEmail(identifier.trim())) {
      errors["identifier"] = "Enter a valid email address.";
    }
  } else {
    if (!isValidPhoneNumber(identifier)) {
      errors["identifier"] = "Enter a valid phone number.";
    }
  }

  final passwordError = validatePassword(password);
  if (passwordError != null) errors["password"] = passwordError;

  return AuthFieldErrors(errors);
}

String? validatePassword(String password) {
  if (password.isEmpty) return "Enter your password.";
  if (password.length < AuthValidationRules.passwordMinLength) {
    return "Password must be at least ${AuthValidationRules.passwordMinLength} characters.";
  }
  return null;
}

String? validateOtpCode(String code) {
  final trimmed = code.trim();
  if (trimmed.isEmpty) return "Enter the verification code.";
  if (!RegExp(AuthValidationRules.otpPattern).hasMatch(trimmed)) {
    return "Enter the 6-digit code sent to your phone.";
  }
  return null;
}

String? validateResetToken(String token) {
  final trimmed = token.trim();
  if (trimmed.isEmpty) return "Enter the reset token.";
  if (trimmed.length < AuthValidationRules.resetTokenMinLength) {
    return "Enter the full token from your email.";
  }
  return null;
}

String sanitizeOtpInput(String raw) {
  final digits = raw.replaceAll(RegExp(r"\D"), "");
  if (digits.length <= AuthValidationRules.otpLength) return digits;
  return digits.substring(0, AuthValidationRules.otpLength);
}
