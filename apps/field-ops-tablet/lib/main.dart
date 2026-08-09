import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/approval_pending_screen.dart';
import 'screens/assignments/assignments_screen.dart';
import 'screens/assignments/incident_workspace_screen.dart';
import 'screens/bolo/bolo_screen.dart';
import 'screens/checkpoint/checkpoint_mode_screen.dart';
import 'screens/comms/comms_screen.dart';
import 'screens/device_registration_screen.dart';
import 'screens/device_status_screen.dart';
import 'screens/drone/drone_monitor_screen.dart';
import 'screens/home_screen.dart';
import 'screens/launcher/device_lock_screen.dart';
import 'screens/launcher/launcher_shell_gate.dart';
import 'screens/locked_screen.dart';
import 'screens/login_screen.dart';
import 'screens/patrol/patrol_mode_screen.dart';
import 'screens/routes.dart';
import 'screens/splash_screen.dart';
import 'screens/unauthorized_screen.dart';
import 'services/field_app_services.dart';
import 'theme/field_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('[THE_EYE_FIELD_OPS] FlutterError: ${details.exceptionAsString()}');
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('[THE_EYE_FIELD_OPS] Uncaught: $error\n$stack');
    return true;
  };
  runZonedGuarded(
    () => runApp(const TheEyeFieldOpsApp()),
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

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }

  @override
  void dispose() {
    _services.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'THE EYE Field Ops',
      debugShowCheckedModeBanner: false,
      theme: buildFieldTheme(),
      navigatorKey: _navKey,
      initialRoute: FieldRoutes.splash,
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case FieldRoutes.splash:
            return _page(SplashScreen(services: _services), settings);
          case FieldRoutes.login:
            return _page(LoginScreen(services: _services), settings);
          case FieldRoutes.deviceRegistration:
            return _page(DeviceRegistrationScreen(services: _services), settings);
          case FieldRoutes.approvalPending:
            return _page(ApprovalPendingScreen(services: _services), settings);
          case FieldRoutes.locked:
            return _page(LockedScreen(services: _services), settings);
          case FieldRoutes.home:
            return _page(LauncherShellGate(services: _services), settings);
          case FieldRoutes.launcherHome:
            return _page(LauncherShellGate(services: _services), settings);
          case FieldRoutes.deviceLock:
            final args = settings.arguments;
            final map = args is Map ? Map<String, dynamic>.from(args) : const {};
            return _page(
              DeviceLockScreen(
                reason: map['reason']?.toString() ?? 'Device locked',
                deviceReference: map['deviceReference']?.toString() ?? 'unknown',
                policy: null,
              ),
              settings,
            );
          case FieldRoutes.deviceStatus:
            return _page(DeviceStatusScreen(services: _services), settings);
          case FieldRoutes.unauthorized:
            return _page(
              UnauthorizedScreen(services: _services),
              settings,
            );
          case FieldRoutes.patrol:
            return _page(PatrolModeScreen(services: _services), settings);
          case FieldRoutes.checkpoint:
            return _page(CheckpointModeScreen(services: _services), settings);
          case FieldRoutes.assignments:
            return _page(AssignmentsScreen(services: _services), settings);
          case FieldRoutes.incidentWorkspace:
            final args = settings.arguments;
            final assignmentId = args is Map
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
          case FieldRoutes.drone:
            return _page(DroneMonitorScreen(services: _services), settings);
          case FieldRoutes.comms:
            return _page(CommsScreen(services: _services), settings);
          default:
            return _page(SplashScreen(services: _services), settings);
        }
      },
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
