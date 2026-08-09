/// Deployment mode for Field Operations tablets.
///
/// Controlled by `--dart-define=FIELD_DEVICE_MODE=` and/or Android BuildConfig.
/// Never applied to the citizen mobile app.
enum FieldDeviceMode {
  /// Normal Android application (STANDARD_APP).
  standard,

  /// Eligible to be selected as Android HOME (FIELD_LAUNCHER).
  launcher,

  /// Dedicated-device mode with Lock Task when Device Owner (MANAGED_KIOSK).
  managedKiosk,
}

abstract final class FieldDeviceModeConfig {
  static const _fromDefine = String.fromEnvironment(
    'FIELD_DEVICE_MODE',
    defaultValue: '',
  );

  /// Parse a raw mode string from dart-define, BuildConfig, or API policy.
  static FieldDeviceMode parse(String? raw) {
    switch ((raw ?? '').trim().toLowerCase()) {
      case 'launcher':
      case 'field_launcher':
        return FieldDeviceMode.launcher;
      case 'managed_kiosk':
      case 'kiosk':
      case 'managed':
        return FieldDeviceMode.managedKiosk;
      case 'standard':
      case 'standard_app':
      case '':
      default:
        return FieldDeviceMode.standard;
    }
  }

  /// Compile-time default from dart-define (may be refined by native/API).
  static FieldDeviceMode get compileTimeMode => parse(_fromDefine);

  static String apiValue(FieldDeviceMode mode) {
    switch (mode) {
      case FieldDeviceMode.standard:
        return 'standard';
      case FieldDeviceMode.launcher:
        return 'launcher';
      case FieldDeviceMode.managedKiosk:
        return 'managed_kiosk';
    }
  }

  static bool isLauncherShell(FieldDeviceMode mode) =>
      mode == FieldDeviceMode.launcher || mode == FieldDeviceMode.managedKiosk;
}
