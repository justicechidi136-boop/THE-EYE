import "package:local_auth/local_auth.dart";

enum BiometricKind { fingerprint, face, biometric }

class BiometricCapability {
  const BiometricCapability({
    required this.available,
    required this.enrolled,
    required this.kind,
  });

  const BiometricCapability.unavailable()
      : available = false,
        enrolled = false,
        kind = BiometricKind.biometric;

  final bool available;
  final bool enrolled;
  final BiometricKind kind;

  bool get canAuthenticate => available && enrolled;

  String get name => switch (kind) {
        BiometricKind.fingerprint => "Fingerprint",
        BiometricKind.face => "Face ID",
        BiometricKind.biometric => "Biometric",
      };
}

enum BiometricAuthenticationStatus {
  success,
  failed,
  cancelled,
  lockedOut,
  notEnrolled,
  unavailable,
  error,
}

class BiometricUnlockResult {
  const BiometricUnlockResult({
    required this.status,
    this.profileComplete = true,
  });

  final BiometricAuthenticationStatus status;
  final bool profileComplete;

  bool get isSuccess => status == BiometricAuthenticationStatus.success;
}

abstract class DeviceBiometricGateway {
  Future<bool> supportsBiometrics();
  Future<List<BiometricType>> enrolledBiometrics();
  Future<bool> authenticate({required String reason});
}

class LocalAuthDeviceBiometricGateway implements DeviceBiometricGateway {
  LocalAuthDeviceBiometricGateway([LocalAuthentication? authentication])
      : _authentication = authentication ?? LocalAuthentication();

  final LocalAuthentication _authentication;

  @override
  Future<bool> supportsBiometrics() => _authentication.canCheckBiometrics;

  @override
  Future<List<BiometricType>> enrolledBiometrics() =>
      _authentication.getAvailableBiometrics();

  @override
  Future<bool> authenticate({required String reason}) =>
      _authentication.authenticate(
        localizedReason: reason,
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
}

class BiometricAuthService {
  BiometricAuthService({DeviceBiometricGateway? gateway})
      : _gateway = gateway ?? LocalAuthDeviceBiometricGateway();

  final DeviceBiometricGateway _gateway;

  Future<BiometricCapability> capability() async {
    try {
      final supported = await _gateway.supportsBiometrics();
      if (!supported) return const BiometricCapability.unavailable();
      final enrolled = await _gateway.enrolledBiometrics();
      return BiometricCapability(
        available: true,
        enrolled: enrolled.isNotEmpty,
        kind: _kindFor(enrolled),
      );
    } catch (_) {
      return const BiometricCapability.unavailable();
    }
  }

  Future<BiometricAuthenticationStatus> authenticate({
    String reason = "Unlock THE EYE",
  }) async {
    final current = await capability();
    if (!current.available) {
      return BiometricAuthenticationStatus.unavailable;
    }
    if (!current.enrolled) {
      return BiometricAuthenticationStatus.notEnrolled;
    }
    try {
      final authenticated = await _gateway.authenticate(reason: reason);
      return authenticated
          ? BiometricAuthenticationStatus.success
          : BiometricAuthenticationStatus.failed;
    } on LocalAuthException catch (error) {
      return _statusForCode(error.code.name);
    } catch (_) {
      return BiometricAuthenticationStatus.error;
    }
  }

  static BiometricKind _kindFor(List<BiometricType> biometrics) {
    if (biometrics.contains(BiometricType.face)) return BiometricKind.face;
    if (biometrics.contains(BiometricType.fingerprint)) {
      return BiometricKind.fingerprint;
    }
    return BiometricKind.biometric;
  }

  static BiometricAuthenticationStatus _statusForCode(String code) {
    return switch (code) {
      "userCanceled" ||
      "systemCanceled" =>
        BiometricAuthenticationStatus.cancelled,
      "temporaryLockout" ||
      "biometricLockout" =>
        BiometricAuthenticationStatus.lockedOut,
      "noBiometricsEnrolled" ||
      "noCredentialsSet" =>
        BiometricAuthenticationStatus.notEnrolled,
      "noBiometricHardware" ||
      "biometricHardwareTemporarilyUnavailable" =>
        BiometricAuthenticationStatus.unavailable,
      "userRequestedFallback" => BiometricAuthenticationStatus.cancelled,
      _ => BiometricAuthenticationStatus.error,
    };
  }
}
