import '../config/field_device_mode.dart';

enum ApprovedAppCategory {
  operations,
  navigation,
  communication,
  deviceTools,
}

enum ApprovedAppFallback {
  hide,
  showUnavailable,
}

class ApprovedApp {
  const ApprovedApp({
    required this.packageName,
    required this.displayName,
    required this.category,
    required this.iconName,
    required this.allowedRoles,
    required this.allowedDeviceModes,
    this.enabled = true,
    this.fallback = ApprovedAppFallback.showUnavailable,
    this.alternatePackages = const [],
  });

  final String packageName;
  final String displayName;
  final ApprovedAppCategory category;
  final String iconName;
  final Set<String> allowedRoles;
  final Set<FieldDeviceMode> allowedDeviceModes;
  final bool enabled;
  final ApprovedAppFallback fallback;
  final List<String> alternatePackages;

  Iterable<String> get candidatePackages sync* {
    yield packageName;
    yield* alternatePackages;
  }

  bool allowsRole(String? role) {
    if (allowedRoles.contains('*')) return true;
    if (role == null || role.isEmpty) return allowedRoles.contains('officer');
    return allowedRoles.contains(role.toLowerCase());
  }

  bool allowsMode(FieldDeviceMode mode) => allowedDeviceModes.contains(mode);
}
