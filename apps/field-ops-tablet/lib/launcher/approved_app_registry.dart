import '../config/field_device_mode.dart';
import 'approved_app.dart';

/// Agency allowlist of secondary applications. Never exposes arbitrary
/// installed packages to field users.
abstract final class ApprovedAppRegistry {
  static const _allRoles = {'*'};
  static const _fieldRoles = {
    'officer',
    'patrol',
    'checkpoint',
    'drone',
    'supervisor',
    'commander',
  };

  static const List<ApprovedApp> defaults = [
    ApprovedApp(
      packageName: 'com.google.android.apps.maps',
      displayName: 'Google Maps',
      category: ApprovedAppCategory.navigation,
      iconName: 'map',
      allowedRoles: _allRoles,
      allowedDeviceModes: {
        FieldDeviceMode.standard,
        FieldDeviceMode.launcher,
        FieldDeviceMode.managedKiosk,
      },
    ),
    ApprovedApp(
      packageName: 'com.android.camera2',
      displayName: 'Camera',
      category: ApprovedAppCategory.operations,
      iconName: 'camera',
      allowedRoles: _fieldRoles,
      allowedDeviceModes: {
        FieldDeviceMode.standard,
        FieldDeviceMode.launcher,
        FieldDeviceMode.managedKiosk,
      },
      alternatePackages: ['com.android.camera'],
    ),
    ApprovedApp(
      packageName: 'com.google.android.dialer',
      displayName: 'Phone',
      category: ApprovedAppCategory.communication,
      iconName: 'phone',
      allowedRoles: _allRoles,
      allowedDeviceModes: {
        FieldDeviceMode.standard,
        FieldDeviceMode.launcher,
        FieldDeviceMode.managedKiosk,
      },
      alternatePackages: ['com.android.dialer'],
    ),
    ApprovedApp(
      packageName: 'com.android.chrome',
      displayName: 'Approved Browser',
      category: ApprovedAppCategory.communication,
      iconName: 'language',
      allowedRoles: {'supervisor', 'commander', 'officer'},
      allowedDeviceModes: {
        FieldDeviceMode.launcher,
        FieldDeviceMode.managedKiosk,
      },
    ),
    ApprovedApp(
      packageName: 'com.google.android.apps.messaging',
      displayName: 'Messaging',
      category: ApprovedAppCategory.communication,
      iconName: 'sms',
      allowedRoles: {'supervisor', 'commander'},
      allowedDeviceModes: {
        FieldDeviceMode.launcher,
        FieldDeviceMode.managedKiosk,
      },
    ),
    ApprovedApp(
      packageName: 'com.android.settings',
      displayName: 'Restricted Settings',
      category: ApprovedAppCategory.deviceTools,
      iconName: 'settings',
      allowedRoles: {'supervisor', 'commander'},
      allowedDeviceModes: {
        FieldDeviceMode.launcher,
      },
      fallback: ApprovedAppFallback.hide,
    ),
  ];

  /// Merge server policy package names onto the default registry.
  static List<ApprovedApp> resolve({
    required FieldDeviceMode mode,
    required String? role,
    List<String>? policyPackageNames,
    bool browserAllowed = true,
    bool settingsAllowed = false,
  }) {
    final policy = policyPackageNames
        ?.map((e) => e.trim().toLowerCase())
        .where((e) => e.isNotEmpty)
        .toSet();

    return defaults.where((app) {
      if (!app.enabled) return false;
      if (!app.allowsMode(mode)) return false;
      if (!app.allowsRole(role)) return false;
      if (app.packageName == 'com.android.chrome' && !browserAllowed) {
        return false;
      }
      if (app.packageName == 'com.android.settings' && !settingsAllowed) {
        return false;
      }
      if (policy != null && policy.isNotEmpty) {
        final match = app.candidatePackages
            .any((p) => policy.contains(p.toLowerCase()));
        if (!match) return false;
      }
      return true;
    }).toList(growable: false);
  }

  static List<ApprovedApp> byCategory(
    List<ApprovedApp> apps,
    ApprovedAppCategory category,
  ) {
    return apps.where((a) => a.category == category).toList(growable: false);
  }
}
