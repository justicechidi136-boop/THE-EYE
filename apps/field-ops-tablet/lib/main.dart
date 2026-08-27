import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:the_eye_flutter_l10n/the_eye_locales.dart';
import 'package:url_launcher/url_launcher.dart';

import 'l10n/generated/field_localizations.dart';
import 'screens/approval_pending_screen.dart';
import 'screens/assignments/assignments_screen.dart';
import 'screens/assignments/incident_workspace_screen.dart';
import 'screens/bolo/bolo_screen.dart';
import 'screens/broadcasts/broadcasts_screen.dart';
import 'screens/checkpoint/checkpoint_mode_screen.dart';
import 'screens/comms/comms_screen.dart';
import 'screens/device_registration_screen.dart';
import 'screens/device_status_screen.dart';
import 'screens/drone/drone_monitor_screen.dart';
import 'screens/launcher/device_lock_screen.dart';
import 'screens/launcher/launcher_shell_gate.dart';
import 'screens/language_region_screen.dart';
import 'screens/locked_screen.dart';
import 'screens/login_screen.dart';
import 'screens/pair_device_screen.dart';
import 'screens/patrol/patrol_mode_screen.dart';
import 'screens/routes.dart';
import 'screens/splash_screen.dart';
import 'screens/unauthorized_screen.dart';
import 'services/field_app_services.dart';
import 'theme/field_theme.dart';
import 'danger_alerts/field_danger_alert.dart';
import 'danger_alerts/field_danger_alert_dialog.dart';

void main() {
  // Bindings and runApp must share the same zone — otherwise async startup
  // (registration status, secure storage) can stall or mis-handle errors.
  runZonedGuarded(
    () {
      WidgetsFlutterBinding.ensureInitialized();
      FlutterError.onError = (details) {
        FlutterError.presentError(details);
        debugPrint(
          '[THE_EYE_FIELD_OPS] FlutterError: ${details.exceptionAsString()}',
        );
      };
      PlatformDispatcher.instance.onError = (error, stack) {
        debugPrint('[THE_EYE_FIELD_OPS] Uncaught: $error\n$stack');
        return true;
      };
      runApp(const TheEyeFieldOpsApp());
    },
    (error, stack) {
      debugPrint('[THE_EYE_FIELD_OPS] Zone error: $error\n$stack');
    },
  );
}

class TheEyeFieldOpsApp extends StatefulWidget {
  const TheEyeFieldOpsApp({super.key});

  @override
  State<TheEyeFieldOpsApp> createState() => _TheEyeFieldOpsAppState();
}

class _TheEyeFieldOpsAppState extends State<TheEyeFieldOpsApp> {
  final FieldAppServices _services = FieldAppServices();
  final GlobalKey<NavigatorState> _navKey = GlobalKey<NavigatorState>();
  StreamSubscription<FieldDangerAlert>? _dangerSubscription;
  bool _dangerVisible = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    unawaited(
      _services.accountLocale.hydrate(
        deviceLocales: PlatformDispatcher.instance.locales,
      ),
    );
    _dangerSubscription = _services.dangerAlerts.alerts.listen((alert) {
      unawaited(_showDangerAlert(alert));
    });
  }

  Future<void> _showDangerAlert(FieldDangerAlert alert) async {
    if (_dangerVisible) return;
    final context = _navKey.currentContext;
    if (context == null) return;
    _dangerVisible = true;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder:
          (dialogContext) => FieldDangerAlertDialog(
            alert: alert,
            elapsedLabel: _elapsed(alert.issuedAt),
            onOpenMap:
                () => launchUrl(
                  Uri.parse('geo:0,0?q=${Uri.encodeComponent(alert.area)}'),
                  mode: LaunchMode.externalApplication,
                ),
            onAcknowledge: () async {
              await _services.dangerAlerts.acknowledge(alert);
              if (dialogContext.mounted) Navigator.pop(dialogContext);
            },
          ),
    );
    _dangerVisible = false;
  }

  String _elapsed(DateTime issuedAt) {
    final seconds = DateTime.now()
        .difference(issuedAt)
        .inSeconds
        .clamp(0, 3600);
    if (seconds < 60) return '$seconds seconds';
    return '${seconds ~/ 60} minutes';
  }

  @override
  void dispose() {
    _dangerSubscription?.cancel();
    _services.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _services.accountLocale.controller,
      builder:
          (context, _) => MaterialApp(
            title: 'THE EYE Field Ops',
            debugShowCheckedModeBanner: false,
            theme: buildFieldTheme(),
            locale: _services.accountLocale.locale,
            supportedLocales: TheEyeLocaleCatalog.supportedLocales,
            localizationsDelegates: const [
              FieldLocalizations.delegate,
              ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
            ],
            navigatorKey: _navKey,
            initialRoute: FieldRoutes.splash,
            onGenerateRoute: (settings) {
              switch (settings.name) {
                case FieldRoutes.splash:
                  return _page(SplashScreen(services: _services), settings);
                case FieldRoutes.login:
                  return _page(LoginScreen(services: _services), settings);
                case FieldRoutes.deviceRegistration:
                  return _page(
                    DeviceRegistrationScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.pairDevice:
                  return _page(PairDeviceScreen(services: _services), settings);
                case FieldRoutes.approvalPending:
                  return _page(
                    ApprovalPendingScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.locked:
                  return _page(LockedScreen(services: _services), settings);
                case FieldRoutes.home:
                  return _page(
                    LauncherShellGate(services: _services),
                    settings,
                  );
                case FieldRoutes.launcherHome:
                  return _page(
                    LauncherShellGate(services: _services),
                    settings,
                  );
                case FieldRoutes.deviceLock:
                  final args = settings.arguments;
                  final map =
                      args is Map
                          ? Map<String, dynamic>.from(args)
                          : const <String, dynamic>{};
                  return _page(
                    DeviceLockScreen(
                      reason: map['reason']?.toString() ?? 'Device locked',
                      deviceReference:
                          map['deviceReference']?.toString() ?? 'unknown',
                      policy: null,
                    ),
                    settings,
                  );
                case FieldRoutes.deviceStatus:
                  return _page(
                    DeviceStatusScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.languageRegion:
                  return _page(
                    LanguageRegionScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.unauthorized:
                  return _page(
                    UnauthorizedScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.patrol:
                  return _page(PatrolModeScreen(services: _services), settings);
                case FieldRoutes.checkpoint:
                  return _page(
                    CheckpointModeScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.assignments:
                  return _page(
                    AssignmentsScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.incidentWorkspace:
                  final args = settings.arguments;
                  final assignmentId =
                      args is Map
                          ? args['assignmentId']?.toString() ?? ''
                          : args?.toString() ?? '';
                  return _page(
                    IncidentWorkspaceScreen(
                      services: _services,
                      assignmentId: assignmentId,
                    ),
                    settings,
                  );
                case FieldRoutes.bolo:
                  return _page(BoloScreen(services: _services), settings);
                case FieldRoutes.broadcasts:
                  return _page(BroadcastsScreen(services: _services), settings);
                case FieldRoutes.drone:
                  return _page(
                    DroneMonitorScreen(services: _services),
                    settings,
                  );
                case FieldRoutes.comms:
                  return _page(CommsScreen(services: _services), settings);
                default:
                  return _page(SplashScreen(services: _services), settings);
              }
            },
          ),
    );
  }

  PageRouteBuilder<void> _page(Widget child, RouteSettings settings) {
    return PageRouteBuilder<void>(
      settings: settings,
      pageBuilder: (context, animation, secondaryAnimation) => child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(
          opacity: CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          ),
          child: child,
        );
      },
    );
  }
}
