class StandaloneActivationResult {
  const StandaloneActivationResult({
    required this.status,
    required this.correlationId,
    required this.watchId,
    required this.deviceId,
    required this.pairingStatus,
    required this.accessToken,
    required this.deviceSecret,
    this.refreshToken,
    this.expiresAt,
    this.ownerId,
    this.ownerType,
  });

  final String status;
  final String correlationId;
  final String watchId;
  final String deviceId;
  final String pairingStatus;
  final String accessToken;
  final String deviceSecret;
  final String? refreshToken;
  final String? expiresAt;
  final String? ownerId;
  final String? ownerType;

  static const schemaVersion = 'watch-activation-v1';

  factory StandaloneActivationResult.fromJson(Map<String, dynamic> json) {
    final status = _requireNonEmpty(json['status'], 'status');
    if (status != 'activated') {
      throw FormatException('Unexpected activation status: $status');
    }

    final watch = json['watch'];
    if (watch is! Map) {
      throw const FormatException('Missing watch object in activation response');
    }
    final watchMap = Map<String, dynamic>.from(watch);
    final watchId = _requireNonEmpty(watchMap['id'], 'watch.id');
    final deviceId = _requireNonEmpty(watchMap['deviceId'], 'watch.deviceId');
    final pairingStatus =
        _requireNonEmpty(watchMap['pairingStatus'], 'watch.pairingStatus');

    final auth = json['authentication'];
    if (auth is! Map) {
      throw const FormatException(
        'Missing authentication object in activation response',
      );
    }
    final authMap = Map<String, dynamic>.from(auth);
    final accessToken =
        _requireNonEmpty(authMap['accessToken'], 'authentication.accessToken');

    final deviceSecret = _requireNonEmpty(json['deviceSecret'], 'deviceSecret');

    String? ownerId;
    String? ownerType;
    final owner = json['owner'];
    if (owner is Map) {
      final ownerMap = Map<String, dynamic>.from(owner);
      ownerId = ownerMap['id']?.toString();
      ownerType = ownerMap['type']?.toString();
      if (ownerId == null || ownerId.isEmpty) {
        throw const FormatException('owner.id is required when owner is present');
      }
    }

    return StandaloneActivationResult(
      status: status,
      correlationId: json['correlationId']?.toString() ?? '',
      watchId: watchId,
      deviceId: deviceId,
      pairingStatus: pairingStatus,
      accessToken: accessToken,
      deviceSecret: deviceSecret,
      refreshToken: authMap['refreshToken']?.toString(),
      expiresAt: authMap['expiresAt']?.toString(),
      ownerId: ownerId,
      ownerType: ownerType,
    );
  }

  static String _requireNonEmpty(Object? value, String field) {
    final text = value?.toString().trim() ?? '';
    if (text.isEmpty) {
      throw FormatException('Required field missing or empty: $field');
    }
    return text;
  }
}
