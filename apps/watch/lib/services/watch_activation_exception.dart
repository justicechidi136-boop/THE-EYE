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
        userMessage: 'Invalid or expired activation code.',
        cause: cause,
        httpStatus: cause is WatchActivationException ? cause.httpStatus : null,
      );

  static WatchActivationException network([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-002',
        userMessage: 'The watch could not connect to THE EYE server.',
        cause: cause,
      );

  static WatchActivationException setupIncomplete([Object? cause]) =>
      WatchActivationException(
        code: 'WATCH-ACTIVATION-003',
        userMessage: 'The watch was activated, but setup could not be completed.',
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
    if (status >= 500) {
      return network(message);
    }
    return WatchActivationException(
      code: 'WATCH-ACTIVATION-002',
      userMessage: message ?? 'Activation request failed.',
      httpStatus: status,
    );
  }
}
