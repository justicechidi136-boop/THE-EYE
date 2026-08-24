import "package:flutter_secure_storage/flutter_secure_storage.dart";

class BiometricPreference {
  const BiometricPreference({required this.enabled, this.accountId});

  const BiometricPreference.disabled()
      : enabled = false,
        accountId = null;

  final bool enabled;
  final String? accountId;

  bool get hasAccountBinding =>
      enabled && accountId != null && accountId!.trim().isNotEmpty;
}

abstract class BiometricPreferenceStore {
  Future<BiometricPreference> load();
  Future<void> enableForAccount(String accountId);
  Future<void> clear();
}

class SecureBiometricPreferenceStore implements BiometricPreferenceStore {
  SecureBiometricPreferenceStore([FlutterSecureStorage? secureStorage])
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const enabledKey = "the_eye_biometric_unlock_enabled";
  static const accountIdKey = "the_eye_biometric_unlock_account_id";

  final FlutterSecureStorage _secureStorage;

  @override
  Future<BiometricPreference> load() async {
    final enabled = await _secureStorage.read(key: enabledKey) == "true";
    final accountId = await _secureStorage.read(key: accountIdKey);
    if (!enabled || accountId == null || accountId.trim().isEmpty) {
      return const BiometricPreference.disabled();
    }
    return BiometricPreference(enabled: true, accountId: accountId);
  }

  @override
  Future<void> enableForAccount(String accountId) async {
    final normalized = accountId.trim();
    if (normalized.isEmpty) {
      throw ArgumentError.value(accountId, "accountId", "Must not be empty");
    }
    await _secureStorage.write(key: accountIdKey, value: normalized);
    await _secureStorage.write(key: enabledKey, value: "true");
  }

  @override
  Future<void> clear() async {
    await _secureStorage.delete(key: enabledKey);
    await _secureStorage.delete(key: accountIdKey);
  }
}

class InMemoryBiometricPreferenceStore implements BiometricPreferenceStore {
  BiometricPreference preference = const BiometricPreference.disabled();

  @override
  Future<BiometricPreference> load() async => preference;

  @override
  Future<void> enableForAccount(String accountId) async {
    final normalized = accountId.trim();
    if (normalized.isEmpty) {
      throw ArgumentError.value(accountId, "accountId", "Must not be empty");
    }
    preference = BiometricPreference(enabled: true, accountId: normalized);
  }

  @override
  Future<void> clear() async {
    preference = const BiometricPreference.disabled();
  }
}
