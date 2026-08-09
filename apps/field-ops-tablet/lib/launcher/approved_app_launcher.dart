import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';
import '../config/field_device_mode.dart';
import 'approved_app.dart';
import 'approved_app_registry.dart';
import 'field_launcher_platform.dart';
import 'launcher_policy.dart';

class ApprovedAppLaunchResult {
  const ApprovedAppLaunchResult({
    required this.ok,
    required this.message,
    this.packageName,
  });

  final bool ok;
  final String message;
  final String? packageName;
}

/// Launches only allowlisted packages after install + policy checks.
class ApprovedAppLauncher {
  ApprovedAppLauncher({
    required this.platform,
    required this.api,
  });

  final FieldLauncherPlatform platform;
  final FieldApiClient api;

  List<ApprovedApp> visibleApps(LauncherPolicy policy) {
    return ApprovedAppRegistry.resolve(
      mode: policy.deviceMode,
      role: policy.role,
      policyPackageNames: policy.approvedApps,
      browserAllowed: policy.browserAllowed,
      settingsAllowed: policy.settingsAllowed,
    );
  }

  Future<ApprovedAppLaunchResult> launch(
    ApprovedApp app, {
    required LauncherPolicy policy,
  }) async {
    if (!app.enabled) {
      return const ApprovedAppLaunchResult(
        ok: false,
        message: 'This application is disabled by agency policy.',
      );
    }
    if (!app.allowsMode(policy.deviceMode) &&
        !FieldDeviceModeConfig.isLauncherShell(policy.deviceMode)) {
      return const ApprovedAppLaunchResult(
        ok: false,
        message: 'This application is not available in the current device mode.',
      );
    }
    if (!app.allowsRole(policy.role)) {
      return const ApprovedAppLaunchResult(
        ok: false,
        message: 'Your role is not permitted to open this application.',
      );
    }

    String? installedPackage;
    for (final candidate in app.candidatePackages) {
      if (await platform.isPackageInstalled(candidate)) {
        installedPackage = candidate;
        break;
      }
    }

    if (installedPackage == null) {
      await _audit(
        action: 'field.launcher.app_unavailable',
        packageName: app.packageName,
        ok: false,
      );
      if (app.fallback == ApprovedAppFallback.hide) {
        return const ApprovedAppLaunchResult(
          ok: false,
          message: 'Application is not available on this device.',
        );
      }
      return ApprovedAppLaunchResult(
        ok: false,
        message: '${app.displayName} is not installed on this tablet.',
        packageName: app.packageName,
      );
    }

    final launched = await platform.launchApprovedPackage(installedPackage);
    await _audit(
      action: launched
          ? 'field.launcher.app_launched'
          : 'field.launcher.app_launch_failed',
      packageName: installedPackage,
      ok: launched,
    );
    if (!launched) {
      return ApprovedAppLaunchResult(
        ok: false,
        message: 'Unable to open ${app.displayName}.',
        packageName: installedPackage,
      );
    }
    return ApprovedAppLaunchResult(
      ok: true,
      message: 'Opened ${app.displayName}.',
      packageName: installedPackage,
    );
  }

  Future<ApprovedAppLaunchResult> launchPackageName(
    String packageName, {
    required LauncherPolicy policy,
  }) async {
    final apps = visibleApps(policy);
    final match = apps.cast<ApprovedApp?>().firstWhere(
          (a) =>
              a!.candidatePackages.any(
                (p) => p.toLowerCase() == packageName.toLowerCase(),
              ),
          orElse: () => null,
        );
    if (match == null) {
      await _audit(
        action: 'field.launcher.app_blocked',
        packageName: packageName,
        ok: false,
      );
      return const ApprovedAppLaunchResult(
        ok: false,
        message: 'That application is not approved for field use.',
      );
    }
    return launch(match, policy: policy);
  }

  Future<void> _audit({
    required String action,
    required String packageName,
    required bool ok,
  }) async {
    try {
      await api.post(
        FieldApiPaths.deviceLauncherAudit,
        body: {
          'action': action,
          'packageName': packageName,
          'ok': ok,
          'clientAt': DateTime.now().toUtc().toIso8601String(),
        },
      );
    } catch (_) {
      // Audit is best-effort; never block operational launch UX.
    }
  }
}
