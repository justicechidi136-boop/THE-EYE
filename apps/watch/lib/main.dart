import 'package:flutter/material.dart';

import 'config/firebase_bootstrap.dart';
import 'models/alert.dart';
import 'screens/active_emergency_screen.dart';
import 'screens/alert_history_screen.dart';
import 'screens/connection_status_screen.dart';
import 'screens/device_status_screen.dart';
import 'screens/emergency_type_screen.dart';
import 'screens/home_screen.dart';
import 'screens/incoming_alert_screen.dart';
import 'screens/location_onboarding_screen.dart';
import 'screens/notification_summary_screen.dart';
import 'screens/pairing_screen.dart';
import 'screens/report_flow_screens.dart';
import 'screens/resolution_screens.dart';
import 'screens/routes.dart';
import 'screens/settings_screen.dart';
import 'screens/settings_sub_screens.dart';
import 'screens/sos_confirm_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/tracking_screen.dart';
import 'services/watch_app_services.dart';
import 'theme/eye_colors.dart';
import 'theme/eye_theme.dart';
import 'widgets/watch_ui.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const WatchBootstrapApp());
}

class WatchBootstrapApp extends StatefulWidget {
  const WatchBootstrapApp({super.key});

  @override
  State<WatchBootstrapApp> createState() => _WatchBootstrapAppState();
}

class _WatchBootstrapAppState extends State<WatchBootstrapApp> {
  late final Future<FirebaseBootstrapResult> _firebaseFuture =
      initializeWatchFirebase();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<FirebaseBootstrapResult>(
      future: _firebaseFuture,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const MaterialApp(
            debugShowCheckedModeBanner: false,
            home: _WatchStartupLoading(),
          );
        }

        final result = snapshot.data!;
        if (!result.initialized) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            home: _WatchStartupError(
              message: result.errorMessage ?? 'Startup failed',
            ),
          );
        }

        return const TheEyeWatchApp(firebaseReady: true);
      },
    );
  }
}

class _WatchStartupLoading extends StatelessWidget {
  const _WatchStartupLoading();

  @override
  Widget build(BuildContext context) {
    return const WatchScreenShell(
      showTopBar: false,
      child: Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            color: EyeColors.green,
            strokeWidth: 2,
          ),
        ),
      ),
    );
  }
}

class _WatchStartupError extends StatelessWidget {
  const _WatchStartupError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return WatchScreenShell(
      showTopBar: false,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const WatchLogomark(size: 56),
            const SizedBox(height: 12),
            const Text(
              'Startup error',
              style: TextStyle(
                color: EyeColors.danger,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: EyeColors.muted, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }
}

class TheEyeWatchApp extends StatefulWidget {
  const TheEyeWatchApp({super.key, this.firebaseReady = false});

  final bool firebaseReady;

  @override
  State<TheEyeWatchApp> createState() => _TheEyeWatchAppState();
}

class _TheEyeWatchAppState extends State<TheEyeWatchApp> {
  final WatchAppServices _services = WatchAppServices();

  @override
  void dispose() {
    _services.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'THE EYE Watch',
      debugShowCheckedModeBanner: false,
      theme: buildEyeWatchTheme(),
      initialRoute: WatchRoutes.splash,
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case WatchRoutes.splash:
            return _page(
              SplashScreen(
                services: _services,
                firebaseReady: widget.firebaseReady,
              ),
              settings,
            );
          case WatchRoutes.home:
            return _page(HomeScreen(services: _services), settings);
          case WatchRoutes.locationOnboarding:
            return _page(LocationOnboardingScreen(services: _services), settings);
          case WatchRoutes.sosConfirm:
            return _page(SosConfirmScreen(services: _services), settings);
          case WatchRoutes.emergencyType:
            return _page(EmergencyTypeScreen(services: _services), settings);
          case WatchRoutes.activeEmergency:
            return _page(ActiveEmergencyScreen(services: _services), settings);
          case WatchRoutes.tracking:
            return _page(TrackingScreen(services: _services), settings);
          case WatchRoutes.incomingAlert:
            final alert = settings.arguments;
            if (alert is WatchAlert) {
              return _page(
                IncomingAlertScreen(
                  services: _services,
                  title: alert.title,
                  body: alert.body,
                  alertId: alert.id,
                ),
                settings,
              );
            }
            return _page(IncomingAlertScreen(services: _services), settings);
          case WatchRoutes.alertHistory:
            return _page(AlertHistoryScreen(services: _services), settings);
          case WatchRoutes.alertSummary:
            return _page(
              NotificationSummaryScreen(
                alertCount: (settings.arguments as int?) ?? 0,
              ),
              settings,
            );
          case WatchRoutes.pairing:
            return _page(PairingScreen(services: _services), settings);
          case WatchRoutes.connectionStatus:
            return _page(ConnectionStatusScreen(services: _services), settings);
          case WatchRoutes.deviceStatus:
            return _page(DeviceStatusScreen(services: _services), settings);
          case WatchRoutes.settings:
            return _page(SettingsScreen(services: _services), settings);
          case WatchRoutes.settingsRadius:
            return _page(const SettingsRadiusScreen(), settings);
          case WatchRoutes.settingsContacts:
            return _page(const SettingsContactsScreen(), settings);
          case WatchRoutes.reportCategory:
            return _page(const ReportCategoryScreen(), settings);
          case WatchRoutes.reportDescribe:
            return _page(
              ReportDescribeScreen(
                category: settings.arguments as String? ?? 'Incident',
              ),
              settings,
            );
          case WatchRoutes.reportVoice:
            return _page(const ReportVoiceScreen(), settings);
          case WatchRoutes.reportConfirm:
            return _page(
              ReportConfirmScreen(
                description: settings.arguments as String? ?? '',
              ),
              settings,
            );
          case WatchRoutes.stillActive:
            return _page(const StillActiveScreen(), settings);
          case WatchRoutes.communityVote:
            return _page(const CommunityVoteScreen(), settings);
          case WatchRoutes.incidentResolved:
            return _page(const IncidentResolvedScreen(), settings);
          default:
            return _page(
              SplashScreen(
                services: _services,
                firebaseReady: widget.firebaseReady,
              ),
              settings,
            );
        }
      },
    );
  }

  MaterialPageRoute<void> _page(Widget child, RouteSettings settings) {
    return MaterialPageRoute<void>(settings: settings, builder: (_) => child);
  }
}
