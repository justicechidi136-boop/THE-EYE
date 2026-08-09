import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';
import '../config/field_device_mode.dart';
import '../security/secure_session_store.dart';
import 'field_launcher_platform.dart';
import 'launcher_policy.dart';

class LauncherPolicyService {
  LauncherPolicyService({
    required this.api,
    required this.session,
    FieldLauncherPlatform? platform,
  }) : platform = platform ?? FieldLauncherPlatform();

  final FieldApiClient api;
  final SecureSessionStore session;
  final FieldLauncherPlatform platform;

  static const _cacheKey = 'field.launcher_policy_cache';

  LauncherPolicy? _memory;

  LauncherPolicy? get current => _memory;

  Future<LauncherPolicy> bootstrap() async {
    final buildMode = await platform.getBuildDeviceMode();
    final cached = LauncherPolicy.tryDecodeCache(
      await session.readRaw(_cacheKey),
    );
    try {
      final remote = await fetchRemote();
      await _applyNative(remote);
      return remote;
    } on FieldApiException {
      final fallback = cached ??
          LauncherPolicy.defaults(mode: buildMode, role: 'officer');
      _memory = fallback;
      await _applyNative(fallback);
      return fallback;
    } catch (_) {
      final fallback = cached ??
          LauncherPolicy.defaults(mode: buildMode, role: 'officer');
      _memory = fallback;
      await _applyNative(fallback);
      return fallback;
    }
  }

  Future<LauncherPolicy> fetchRemote() async {
    final map = await api.get(FieldApiPaths.devicePolicyMe);
    map['fetchedAt'] = DateTime.now().toUtc().toIso8601String();
    final policy = LauncherPolicy.fromJson(map);
    _memory = policy;
    await session.writeRaw(_cacheKey, policy.encodeCache());
    await _applyNative(policy);
    return policy;
  }

  Future<void> _applyNative(LauncherPolicy policy) async {
    final enableHome = policy.launcherEnabled ||
        FieldDeviceModeConfig.isLauncherShell(policy.deviceMode);
    await platform.setHomeAliasEnabled(enableHome);
    if (policy.kioskEnabled &&
        policy.deviceMode == FieldDeviceMode.managedKiosk) {
      final packages = [
        ...policy.approvedApps,
      ];
      await platform.setLockTaskPackages(packages);
      final caps = await platform.getCapabilities();
      if (caps.isDeviceOwner) {
        await platform.startLockTask();
      }
    }
  }

  Future<void> clearCache() async {
    _memory = null;
    await session.writeRaw(_cacheKey, '');
  }
}
