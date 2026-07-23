import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../config/watch_app_info.dart';
import '../config/watch_flavor.dart';
import '../storage/secure_credential_store.dart';

enum VersionUpdateStatus {
  supported,
  updateRecommended,
  updateRequired,
  apiIncompatible,
}

class VersionCompatibilityPolicy {
  const VersionCompatibilityPolicy({
    required this.environment,
    required this.targetType,
    required this.currentVersion,
    required this.minimumSupportedVersion,
    required this.recommendedVersion,
    required this.updateStatus,
    this.downloadUrl,
    this.fileHash,
    this.signature,
    this.versionCodeMinimum,
  });

  final String environment;
  final String targetType;
  final String currentVersion;
  final String minimumSupportedVersion;
  final String recommendedVersion;
  final VersionUpdateStatus updateStatus;
  final String? downloadUrl;
  final String? fileHash;
  final String? signature;
  final int? versionCodeMinimum;

  bool get blocksNonEmergency =>
      updateStatus == VersionUpdateStatus.updateRequired ||
      updateStatus == VersionUpdateStatus.apiIncompatible;

  factory VersionCompatibilityPolicy.fromApi(Map<String, dynamic> json) {
    final statusRaw = json['updateStatus'] as String? ?? 'Supported';
    return VersionCompatibilityPolicy(
      environment: json['environment'] as String? ?? WatchFlavor.envName,
      targetType: json['targetType'] as String? ?? 'watch',
      currentVersion:
          json['currentVersion'] as String? ?? WatchAppInfo.firmwareVersion,
      minimumSupportedVersion:
          json['minimumSupportedVersion'] as String? ?? '0.0.0',
      recommendedVersion:
          json['recommendedVersion'] as String? ?? WatchAppInfo.firmwareVersion,
      updateStatus: _parseStatus(statusRaw),
      downloadUrl: json['downloadUrl'] as String?,
      fileHash: json['fileHash'] as String?,
      signature: json['signature'] as String?,
      versionCodeMinimum: (json['versionCodeMinimum'] as num?)?.toInt(),
    );
  }

  static VersionUpdateStatus _parseStatus(String raw) {
    switch (raw) {
      case 'UpdateRecommended':
        return VersionUpdateStatus.updateRecommended;
      case 'UpdateRequired':
        return VersionUpdateStatus.updateRequired;
      case 'ApiIncompatible':
        return VersionUpdateStatus.apiIncompatible;
      default:
        return VersionUpdateStatus.supported;
    }
  }

  Map<String, dynamic> toCacheJson() => {
        'environment': environment,
        'targetType': targetType,
        'currentVersion': currentVersion,
        'minimumSupportedVersion': minimumSupportedVersion,
        'recommendedVersion': recommendedVersion,
        'updateStatus': updateStatus.name,
        'downloadUrl': downloadUrl,
        'fileHash': fileHash,
        'signature': signature,
        'versionCodeMinimum': versionCodeMinimum,
        'cachedAt': DateTime.now().toUtc().toIso8601String(),
      };
}

class VersionCompatibilityService {
  VersionCompatibilityService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
  })  : _api = api,
        _credentials = credentials,
        _preferences = preferences;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final PreferencesStore _preferences;

  static const _schemaVersion = 1;

  VersionCompatibilityPolicy? _lastKnown;

  VersionCompatibilityPolicy? get lastKnown => _lastKnown;

  Future<VersionCompatibilityPolicy> evaluate({bool allowCached = true}) async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) {
      return _fallbackPolicy(allowCached: allowCached);
    }
    try {
      final response = await _api.post(
        WatchApiPaths.versionPolicy(deviceId),
        body: {
          'deviceSecret': deviceSecret,
          'currentVersion': WatchAppInfo.firmwareVersion,
          'versionCode': int.tryParse(WatchAppInfo.buildNumber) ?? 1,
          'targetType': 'watch',
          'environment': WatchFlavor.envName,
        },
      );
      final data = response['data'] as Map<String, dynamic>? ?? response;
      final policy = VersionCompatibilityPolicy.fromApi(data);
      _lastKnown = policy;
      await _preferences.saveVersionPolicyCache(policy.toCacheJson());
      return policy;
    } catch (_) {
      return _fallbackPolicy(allowCached: allowCached);
    }
  }

  Future<VersionCompatibilityPolicy> _fallbackPolicy({
    required bool allowCached,
  }) async {
    if (allowCached) {
      final cached = await _preferences.readVersionPolicyCache();
      if (cached != null) {
        _lastKnown = VersionCompatibilityPolicy.fromApi(cached);
        return _lastKnown!;
      }
    }
    _lastKnown = VersionCompatibilityPolicy(
      environment: WatchFlavor.envName,
      targetType: 'watch',
      currentVersion: WatchAppInfo.firmwareVersion,
      minimumSupportedVersion: '0.0.0',
      recommendedVersion: WatchAppInfo.firmwareVersion,
      updateStatus: VersionUpdateStatus.supported,
    );
    return _lastKnown!;
  }

  static int compareSemver(String a, String b) {
    final pa = a.split('+').first.split('.').map(int.parse).toList();
    final pb = b.split('+').first.split('.').map(int.parse).toList();
    while (pa.length < 3) pa.add(0);
    while (pb.length < 3) pb.add(0);
    for (var i = 0; i < 3; i++) {
      if (pa[i] != pb[i]) return pa[i].compareTo(pb[i]);
    }
    return 0;
  }
}
