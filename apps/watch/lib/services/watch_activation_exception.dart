import 'package:http/http.dart' as http;

/// User-visible activation error codes — no secrets or internal URLs.
class WatchActivationException implements Exception {
  WatchActivationException({
    required this.code,
    required this.userMessage,
    this.cause,
    this.httpStatus,
    this.recoverable = true,
  });

  final String code;
  final String userMessage;
  final Object? cause;
  final int? httpStatus;
  final bool recoverable;

  @override
  String toString() => '$code: $userMessage';

  static WatchActivationException invalidCode([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-001',
        userMessage: cause is String && cause.trim().isNotEmpty
            ? cause.trim()
            : 'Invalid or expired activation code.',
        cause: cause,
        httpStatus: cause is WatchActivationException ? cause.httpStatus : null,
      );

  static WatchActivationException network([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage: 'The watch could not connect to THE EYE server.',
        cause: cause,
      );

  static WatchActivationException networkTimeout([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage:
            'Connection to THE EYE timed out. Check Wi‑Fi or LTE, then try again.',
        cause: cause,
      );

  static WatchActivationException networkClient(http.ClientException error) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage:
            'Network error while contacting THE EYE (${error.message}). Check Wi‑Fi or LTE.',
        cause: error,
      );

  static WatchActivationException networkUnexpected(Object error) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage:
            'Unexpected network error while activating. Check Wi‑Fi or LTE, then try again.',
        cause: error,
      );

  static WatchActivationException offline() => WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage:
            'No internet on the watch. Connect Wi‑Fi or LTE, then try again.',
      );

  static WatchActivationException devApiMisconfigured(String host) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage:
            'This watch build targets $host, which is not reachable from a physical device. Reinstall the staging watch app.',
      );

  static WatchActivationException serverUnreachable(
    String host, [
    Object? cause,
  ]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage:
            'Could not reach THE EYE server at $host. Check Wi‑Fi or LTE on the watch.',
        cause: cause,
      );

  static WatchActivationException serverSetup([Object? cause, int? httpStatus]) {
    final detail = cause?.toString().trim() ?? '';
    return WatchActivationException(
      code: 'WATCH-ACTIVATION-007',
      userMessage: detail.isNotEmpty
          ? detail
          : 'THE EYE server is not ready for standalone watch activation. Ask an admin to apply the watch ownership database migration on staging.',
      cause: cause,
      httpStatus: httpStatus,
    );
  }

  static WatchActivationException setupIncomplete([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-003',
        userMessage:
            'The watch was activated, but setup could not be completed.',
        cause: cause,
      );

  static WatchActivationException responseParse([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-004',
        userMessage: 'The activation response could not be processed.',
        cause: cause,
      );

  static WatchActivationException secureStorage([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-005',
        userMessage: 'Secure sign-in setup failed.',
        cause: cause,
      );

  static WatchActivationException navigation([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-006',
        userMessage: 'The authenticated watch screen failed to open.',
        cause: cause,
      );

  static WatchActivationException validation(String message) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-001',
        userMessage: message,
      );

  static WatchActivationException fromHttpStatus(int status, String? message) {
    if (status == 400 || status == 401 || status == 404) {
      return invalidCode(message);
    }
    if (status == 409) {
      return WatchActivationException(
        code: 'WATCH-ACTIVATION-001',
        userMessage:
            'This activation code was already used. If setup failed, contact your administrator for a new code.',
        httpStatus: status,
      );
    }
    if (status == 429) {
      return WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage:
            'Too many activation attempts. Wait one minute, then try again.',
        httpStatus: status,
      );
    }
    if (status == 503 || status >= 500) {
      return serverSetup(message, status);
    }
    return WatchActivationException(
      code: 'WATCH-ACTIVATION-002',
      userMessage: message ?? 'Activation request failed.',
      httpStatus: status,
    );
  }
}
