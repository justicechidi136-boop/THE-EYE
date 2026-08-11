/// Internal evidence pipeline error codes (not shown to users).
abstract final class EvidenceErrorCodes {
  /// Source file path missing and no in-memory bytes available.
  static const sourceUnavailable = "EVIDENCE-001";

  /// Could not copy or write evidence to local storage.
  static const persistFailed = "EVIDENCE-002";
}
