import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:the_eye_flutter_l10n/the_eye_locales.dart';

import 'alerts/danger_alert_models.dart';
import 'l10n/generated/watch_localizations.dart';
import 'models/alert.dart';
import 'models/emergency_mode.dart';
import 'screens/active_emergency_screen.dart';
import 'screens/alert_history_screen.dart';
import 'screens/app_drawer_screen.dart';
import 'screens/connection_status_screen.dart';
import 'screens/default_home_onboarding_screen.dart';
import 'screens/device_status_screen.dart';
import 'screens/emergency_type_screen.dart';
import 'screens/home_screen.dart';
import 'screens/danger_alert_screen.dart';
import 'screens/incoming_alert_screen.dart';
import 'screens/location_settings_screen.dart';
import 'screens/location_onboarding_screen.dart';
import 'screens/notification_summary_screen.dart';
import 'screens/pairing_screen.dart';
import 'screens/report_flow_screens.dart';
import 'screens/resolution_screens.dart';
import 'screens/routes.dart';
import 'screens/settings_screen.dart';
import 'screens/settings_sub_screens.dart';
import 'screens/sos_confirm_screen.dart';
import 'screens/tracking_screen.dart';
import 'services/launcher_service.dart';
import 'services/watch_app_services.dart';
import 'startup/watch_boot_screen.dart';
import 'theme/eye_colors.dart';
import 'theme/eye_theme.dart';
import 'widgets/watch_ui.dart';

void main() {
  runZonedGuarded(
    () {
      WidgetsFlutterBinding.ensureInitialized();
      FlutterError.onError = (details) {
        FlutterError.presentError(details);
        debugPrint(
          '[THE_EYE_WATCH] FlutterError: ${details.exceptionAsString()}',
        );
      };
      PlatformDispatcher.instance.onError = (error, stack) {
        debugPrint('[THE_EYE_WATCH] Uncaught: $error\n$stack');
        return true;
      };
      runApp(const TheEyeWatchApp());
    },
    (error, stack) {
      debugPrint('[THE_EYE_WATCH] Zone error: $error\n$stack');
    },
  );
}

class TheEyeWatchApp extends StatefulWidget {
  const TheEyeWatchApp({super.key});

  @override
  State<TheEyeWatchApp> createState() => _TheEyeWatchAppState();
}

class _TheEyeWatchAppState extends State<TheEyeWatchApp>
    with WidgetsBindingObserver {
  final WatchAppServices _services = WatchAppServices();
  final LauncherService _launcher = LauncherService();
  final GlobalKey<NavigatorState> _navKey = GlobalKey<NavigatorState>();
  final TheEyeLocaleController _localeController = TheEyeLocaleController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _services.push.onActiveEmergencyRefresh =
        ({required String? incidentId, required String category}) async {
      final nav = _navKey.currentState;
      if (nav == null) return;
      final currentRoute = ModalRoute.of(nav.context)?.settings.name;
      await _services.sos.syncEmergencyTracking();
      if (currentRoute == WatchRoutes.activeEmergency) return;
      nav.pushNamed(
        WatchRoutes.activeEmergency,
        arguments: incidentId,
      );
    };
    _services.push.onDangerAlert = (payload) async {
      final nav = _navKey.currentState;
      if (nav == null) return;
      nav.pushNamed(
        WatchRoutes.dangerAlert,
        arguments: payload,
      );
    };
    _services.dangerAlerts.onNavigate = (payload) async {
      final nav = _navKey.currentState;
      if (nav == null) return;
      if (ModalRoute.of(nav.context)?.settings.name ==
          WatchRoutes.dangerAlert) {
        return;
      }
      nav.pushNamed(
        WatchRoutes.dangerAlert,
        arguments: payload,
      );
    };
    _services.accountLanguage.locale.addListener(_syncLocaleFromService);
    unawaited(_hydrateLocale());
  }

  Future<void> _hydrateLocale() async {
    await _services.accountLanguage.hydrate(
      deviceLocales: PlatformDispatcher.instance.locales,
    );
    _localeController.setLocale(_services.accountLanguage.locale.value);
  }

  void _syncLocaleFromService() {
    _localeController.setLocale(_services.accountLanguage.locale.value);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_services.onAppResumed());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _services.accountLanguage.locale.removeListener(_syncLocaleFromService);
    _localeController.dispose();
    _services.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _localeController,
      builder: (context, _) => MaterialApp(
        title: 'THE EYE Watch',
        debugShowCheckedModeBanner: false,
        theme: buildEyeWatchTheme(),
        locale: _localeController.locale,
        supportedLocales: TheEyeLocaleCatalog.supportedLocales,
        localizationsDelegates: const [
          WatchLocalizations.delegate,
          ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
        ],
        navigatorKey: _navKey,
        initialRoute: WatchRoutes.splash,
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case WatchRoutes.splash:
              return _darkPage(
                WatchBootScreen(
                  services: _services,
                  launcher: _launcher,
                ),
                settings,
              );
            case WatchRoutes.defaultHomeOnboarding:
              return _darkPage(
                DefaultHomeOnboardingScreen(
                  launcher: _launcher,
                  onDismiss: () => _services.preferences
                      .setLauncherOnboardingDismissed(true),
                  onComplete: () {
                    _navKey.currentState?.pushReplacementNamed(
                      WatchRoutes.splash,
                    );
                  },
                ),
                settings,
              );
            case WatchRoutes.appDrawer:
              return _darkPage(AppDrawerScreen(launcher: _launcher), settings);
            case WatchRoutes.home:
              return _darkPage(
                HomeScreen(services: _services, launcher: _launcher),
                settings,
              );
            case WatchRoutes.locationOnboarding:
              return _darkPage(
                LocationOnboardingScreen(services: _services),
                settings,
              );
            case WatchRoutes.sosConfirm:
              final mode = settings.arguments is WatchEmergencyMode
                  ? settings.arguments! as WatchEmergencyMode
                  : WatchEmergencyMode.normalSos;
              return _darkPage(
                SosConfirmScreen(services: _services, mode: mode),
                settings,
              );
            case WatchRoutes.emergencyType:
              return _darkPage(
                EmergencyTypeScreen(services: _services),
                settings,
              );
            case WatchRoutes.activeEmergency:
              final incidentId = settings.arguments is String
                  ? settings.arguments! as String
                  : null;
              return _darkPage(
                ActiveEmergencyScreen(
                  services: _services,
                  incidentId: incidentId,
                ),
                settings,
              );
            case WatchRoutes.tracking:
              return _darkPage(TrackingScreen(services: _services), settings);
            case WatchRoutes.incomingAlert:
              final alert = settings.arguments;
              if (alert is WatchAlert) {
                return _darkPage(
                  IncomingAlertScreen(
                    services: _services,
                    title: alert.title,
                    body: alert.body,
                    alertId: alert.id,
                  ),
                  settings,
                );
              }
              return _darkPage(
                IncomingAlertScreen(services: _services),
                settings,
              );
            case WatchRoutes.dangerAlert:
              final payload = settings.arguments;
              if (payload is DangerAlertPayload) {
                return _darkPage(
                  DangerAlertScreen(
                    services: _services,
                    payload: payload,
                  ),
                  settings,
                );
              }
              return _darkPage(
                  HomeScreen(services: _services, launcher: _launcher),
                  settings);
            case WatchRoutes.alertHistory:
              return _darkPage(
                AlertHistoryScreen(services: _services),
                settings,
              );
            case WatchRoutes.alertSummary:
              return _darkPage(
                NotificationSummaryScreen(
                  alertCount: (settings.arguments as int?) ?? 0,
                ),
                settings,
              );
            case WatchRoutes.pairing:
              return _darkPage(PairingScreen(services: _services), settings);
            case WatchRoutes.connectionStatus:
              return _darkPage(
                ConnectionStatusScreen(services: _services),
                settings,
              );
            case WatchRoutes.deviceStatus:
              return _darkPage(
                DeviceStatusScreen(services: _services),
                settings,
              );
            case WatchRoutes.settings:
              return _darkPage(
                SettingsScreen(services: _services, launcher: _launcher),
                settings,
              );
            case WatchRoutes.settingsRadius:
              return _darkPage(const SettingsRadiusScreen(), settings);
            case WatchRoutes.settingsContacts:
              return _darkPage(const SettingsContactsScreen(), settings);
            case WatchRoutes.settingsLanguage:
              return _darkPage(
                SettingsLanguageScreen(services: _services),
                settings,
              );
            case WatchRoutes.settingsLocation:
              return _darkPage(
                LocationSettingsScreen(
                  services: _services,
                  launcher: _launcher,
                ),
                settings,
              );
            case WatchRoutes.reportCategory:
              return _darkPage(const ReportCategoryScreen(), settings);
            case WatchRoutes.reportDescribe:
              return _darkPage(
                ReportDescribeScreen(
                  category: settings.arguments as String? ?? 'Incident',
                ),
                settings,
              );
            case WatchRoutes.reportVoice:
              return _darkPage(const ReportVoiceScreen(), settings);
            case WatchRoutes.reportConfirm:
              return _darkPage(
                ReportConfirmScreen(
                  description: settings.arguments as String? ?? '',
                ),
                settings,
              );
            case WatchRoutes.stillActive:
              return _darkPage(const StillActiveScreen(), settings);
            case WatchRoutes.communityVote:
              return _darkPage(const CommunityVoteScreen(), settings);
            case WatchRoutes.incidentResolved:
              return _darkPage(const IncidentResolvedScreen(), settings);
            default:
              return _darkPage(
                WatchBootScreen(
                  services: _services,
                  launcher: _launcher,
                ),
                settings,
              );
          }
        },
      ),
    );
  }

  /// Opaque black fade routes — no white Android/Material flash between screens.
  PageRouteBuilder<void> _darkPage(Widget child, RouteSettings settings) {
    return PageRouteBuilder<void>(
      settings: settings,
      opaque: true,
      barrierColor: const Color(0xFF000000),
      transitionDuration: const Duration(milliseconds: 280),
      reverseTransitionDuration: const Duration(milliseconds: 220),
      pageBuilder: (context, animation, secondaryAnimation) => child,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return ColoredBox(
          color: const Color(0xFF000000),
          child: FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
            child: child,
          ),
        );
      },
    );
  }
}

/// Shown only when startup hard-fails before any route is available.
class WatchStartupError extends StatelessWidget {
  const WatchStartupError({super.key, required this.message});

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
