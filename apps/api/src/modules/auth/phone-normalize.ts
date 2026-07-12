export function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\D/g, "")}`;
  }

  const onlyDigits = digits.replace(/\D/g, "");
  if (onlyDigits.startsWith("234") && onlyDigits.length === 13) {
    return `+${onlyDigits}`;
  }
  if (onlyDigits.startsWith("0") && onlyDigits.length === 11) {
    return `+234${onlyDigits.slice(1)}`;
  }
  if (onlyDigits.length >= 10 && onlyDigits.length <= 15) {
    return `+${onlyDigits}`;
  }

  return "";
}

export function isValidPhoneNumber(raw: string): boolean {
  const normalized = normalizePhoneNumber(raw);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}
