import "dart:async";
import "dart:io" show Directory, File, Platform;

import "package:firebase_core/firebase_core.dart";
import "package:firebase_messaging/firebase_messaging.dart";
import "package:flutter/foundation.dart" show kIsWeb;
import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:google_fonts/google_fonts.dart";
import "package:image_picker/image_picker.dart";
import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";
import "package:url_launcher/url_launcher.dart";

import "auth/auth_service.dart";
import "auth/auth_session_store.dart";
import "auth/auth_validation.dart";
import "auth/social_auth_service.dart";
import "contracts/report_type.dart";
import "contracts/the_eye_api_client.dart";
import "contracts/the_eye_api_paths.dart";
import "contracts/the_eye_enums.dart";
import "contracts/the_eye_payloads.dart";
import "evidence/evidence_attachment_picker.dart";
import "evidence/evidence_capture_service.dart";
import "evidence/evidence_upload_service.dart";
import "connectivity/connectivity_service.dart";
import "connectivity/connectivity_state.dart";
import "connectivity/network_interface_reader.dart";
import "connectivity/pending_retry_coordinator.dart";
import "incidents/compose_draft_store.dart";
import "incidents/incident_detail_screen.dart";
import "incidents/incident_draft.dart";
import "incidents/incident_draft_factory.dart";
import "incidents/incident_history_service.dart";
import "incidents/incident_location_tracker.dart";
import "incidents/incident_submission_result.dart";
import "incidents/incident_submission_service.dart";
import "incidents/pending_submission_store.dart";
import "live_video/live_video_api_models.dart";
import "live_video/live_video_connection_state.dart";
import "live_video/live_video_evidence_overlay.dart";
import "live_video/live_video_preview_pane.dart";
import "live_video/live_video_session_controller.dart";
import "brand.dart";
import "config/app_flavor.dart";
import "config/firebase_bootstrap.dart";
import "config/the_eye_api_config.dart";
import "design_system/eye_design_system.dart";
import "push/push_background_handler.dart";
import "push/push_deep_link_router.dart";
import "push/push_notification_service.dart";
import "notifications/notification_inbox_cache.dart";
import "notifications/notification_inbox_service.dart";
import "startup/startup_diagnostics.dart";
import "app/app_scope.dart";
import "app/session_accessor.dart";
import "profile/car_profile.dart";
import "profile/car_profile_store.dart";
import "profile/emergency_contacts_screen.dart";
import "profile/kyc_screen.dart";
import "profile/profile_edit_screen.dart";
import "profile/profile_screen.dart";

export "app/app_scope.dart" show AppScope;
import "theme/the_eye_theme.dart";
import "theme/theme_preferences.dart";
import "theme/theme_provider.dart";
import "widgets/section_card.dart";

final theEyeApiUrl = TheEyeApiConfig.resolveBaseUrl();
const theEyeAccessToken =
    String.fromEnvironment("THE_EYE_ACCESS_TOKEN", defaultValue: "");

final GlobalKey<NavigatorState> theEyeNavigatorKey =
    GlobalKey<NavigatorState>();

AppController appOf(BuildContext context) {
  final session = AppScope.of(context);
  assert(session is AppController, "AppController required in AppScope");
  return session as AppController;
}

Uri mapsUri(double latitude, double longitude) {
  return Uri.parse(
      "https://www.google.com/maps/search/?api=1&query=$latitude,$longitude");
}

Future<void> openMaps(double latitude, double longitude) async {
  final uri = mapsUri(latitude, longitude);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

enum LocationCaptureResult {
  granted,
  denied,
  deniedForever,
  serviceDisabled,
  timeout,
}

const kLocationCaptureTimeout = Duration(seconds: 20);
const kLocationPermissionTimeout = Duration(seconds: 15);
const kSosSubmissionTimeout = Duration(seconds: 45);
const kLiveVideoStartTimeout = Duration(seconds: 45);

class LocationCaptureOutcome {
  const LocationCaptureOutcome({this.position, required this.result});

  final Position? position;
  final LocationCaptureResult result;
}

Future<LocationCaptureOutcome> captureLocationOutcome({
  LocationAccuracy accuracy = LocationAccuracy.high,
  Duration timeout = kLocationCaptureTimeout,
}) async {
  final enabled = await Geolocator.isLocationServiceEnabled();
  if (!enabled) {
    return const LocationCaptureOutcome(
        result: LocationCaptureResult.serviceDisabled);
  }
  var permission = await Geolocator.checkPermission().timeout(
      kLocationPermissionTimeout,
      onTimeout: () => LocationPermission.denied);
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission().timeout(
        kLocationPermissionTimeout,
        onTimeout: () => LocationPermission.denied);
  }
  if (permission == LocationPermission.deniedForever) {
    return const LocationCaptureOutcome(
        result: LocationCaptureResult.deniedForever);
  }
  if (permission == LocationPermission.denied) {
    return const LocationCaptureOutcome(result: LocationCaptureResult.denied);
  }
  try {
    final position = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: accuracy,
        timeLimit: timeout,
      ),
    ).timeout(timeout);
    return LocationCaptureOutcome(
        position: position, result: LocationCaptureResult.granted);
  } on TimeoutException {
    return const LocationCaptureOutcome(result: LocationCaptureResult.timeout);
  } catch (_) {
    return const LocationCaptureOutcome(result: LocationCaptureResult.timeout);
  }
}

Future<void> openLocationSettings() => Geolocator.openLocationSettings();

Future<void> openAppSettings() => Geolocator.openAppSettings();

void showAppSnackBar(BuildContext context, String message,
    {bool isError = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: isError ? BrandColors.danger : BrandColors.green,
      behavior: SnackBarBehavior.floating,
      duration: Duration(seconds: isError ? 5 : 3),
    ),
  );
}

String locationFailureMessage(LocationCaptureResult result) {
  switch (result) {
    case LocationCaptureResult.serviceDisabled:
      return "Turn on location services so responders can find you.";
    case LocationCaptureResult.deniedForever:
      return "Location permission is blocked. Open settings to allow GPS for emergencies.";
    case LocationCaptureResult.denied:
      return "Location permission is required for emergency reporting.";
    case LocationCaptureResult.timeout:
      return "Could not get GPS in time. Move to an open area and try again.";
    case LocationCaptureResult.granted:
      return "";
  }
}

String formatEvidenceTimestamp(DateTime value) {
  final local = value.toLocal();
  final date =
      "${local.day.toString().padLeft(2, "0")}/${local.month.toString().padLeft(2, "0")}/${local.year}";
  final hour =
      local.hour > 12 ? local.hour - 12 : (local.hour == 0 ? 12 : local.hour);
  final minute = local.minute.toString().padLeft(2, "0");
  final suffix = local.hour >= 12 ? "PM" : "AM";
  return "$date $hour:$minute $suffix";
}

String maskPhoneForOtp(String phone) {
  final digits = phone.replaceAll(RegExp(r"\D"), "");
  if (digits.length <= 4) return phone;
  final prefix = digits.length > 6 ? digits.substring(0, 3) : "";
  final suffix = digits.substring(digits.length - 4);
  return prefix.isEmpty ? "***$suffix" : "$prefix***$suffix";
}

String formatResendCountdown(int seconds) {
  final minutes = (seconds ~/ 60).toString().padLeft(2, "0");
  final remainder = (seconds % 60).toString().padLeft(2, "0");
  return "$minutes:$remainder";
}

String formatNotificationAge(DateTime receivedAt) {
  final diff = DateTime.now().difference(receivedAt);
  if (diff.inMinutes < 1) return "Just now";
  if (diff.inHours < 1) {
    final minutes = diff.inMinutes;
    return "$minutes minute${minutes == 1 ? "" : "s"} ago";
  }
  if (diff.inDays < 1) {
    final hours = diff.inHours;
    return "$hours hour${hours == 1 ? "" : "s"} ago";
  }
  return formatEvidenceTimestamp(receivedAt);
}

Future<void> main() async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    StartupDiagnostics.install();
    ErrorWidget.builder = brandedStartupErrorBuilder;
    StartupDiagnostics.checkpoint("STARTUP 1: bindings ready");

    if (!kIsWeb && (Platform.isAndroid || Platform.isIOS)) {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      try {
        await initializeMobileFirebase();
        StartupDiagnostics.checkpoint(
          "STARTUP 2: Firebase initialized (${AppFlavorConfig.firebaseProjectId})",
        );
      } catch (error, stackTrace) {
        StartupDiagnostics.recordZoneError(error, stackTrace);
        if (AppFlavorConfig.isDevelopment) {
          StartupDiagnostics.checkpoint(
            "STARTUP 2: Firebase skipped for ${AppFlavorConfig.current.name} ($error)",
          );
        } else {
          rethrow;
        }
      }
    }

    assertMobileApiBaseUrlMatchesFlavor(
      AppFlavorConfig.current,
      theEyeApiUrl,
    );
    StartupDiagnostics.checkpoint(
      "STARTUP 3: API base URL ${AppFlavorConfig.current.name} -> $theEyeApiUrl",
    );

    runApp(const TheEyeBootstrap());
    StartupDiagnostics.checkpoint("STARTUP 4: runApp called");
  }, StartupDiagnostics.recordZoneError);
}

class TheEyeBootstrap extends StatefulWidget {
  const TheEyeBootstrap({super.key});

  @override
  State<TheEyeBootstrap> createState() => _TheEyeBootstrapState();
}

class _TheEyeBootstrapState extends State<TheEyeBootstrap> {
  TheEyeAppDependencies? _dependencies;
  Object? _startupError;
  int _bootGeneration = 0;
  ThemeProvider? _themeProvider;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      StartupDiagnostics.checkpoint("first frame rendered");
    });
    unawaited(_loadThemeAndBoot());
  }

  Future<void> _loadThemeAndBoot() async {
    final themeProvider = await ThemeProvider.load();
    if (!mounted) return;
    setState(() => _themeProvider = themeProvider);
    await _startBoot(themeProvider);
  }

  Future<void> _startBoot(ThemeProvider themeProvider) async {
    final generation = ++_bootGeneration;
    setState(() {
      _startupError = null;
      _dependencies = null;
    });

    try {
      final deps = await _loadCriticalDependencies(themeProvider);
      if (!mounted || generation != _bootGeneration) return;
      setState(() => _dependencies = deps);
      unawaited(_initializeDeferredServices(deps));
    } catch (error, stack) {
      StartupDiagnostics.recordZoneError(error, stack);
      if (!mounted || generation != _bootGeneration) return;
      setState(() => _startupError = error);
    }
  }

  static Future<TheEyeAppDependencies> _loadCriticalDependencies(
    ThemeProvider themeProvider,
  ) async {
    StartupDiagnostics.checkpoint("loading critical preferences");

    final pendingStore = await SharedPreferencesPendingSubmissionStore.create()
        .timeout(const Duration(seconds: 5));
    final authSessionStore = await SharedPreferencesAuthSessionStore.create()
        .timeout(const Duration(seconds: 5));
    final carProfileStore = await SharedPreferencesCarProfileStore.create()
        .timeout(const Duration(seconds: 5));

    final apiClient = TheEyeApiClient(baseUrl: theEyeApiUrl);
    final evidenceCaptureService = EvidenceCaptureService();
    final submissionService = IncidentSubmissionService(
      apiClient: apiClient,
      pendingStore: pendingStore,
      evidenceUploadService: EvidenceUploadService(apiClient: apiClient),
      evidenceCaptureService: evidenceCaptureService,
    );
    final connectivity = ConnectivityService(
      apiClient: apiClient,
      networkReader: ConnectivityPlusNetworkInterfaceReader(),
    );

    final controller = AppController(
      submissionService: submissionService,
      connectivity: connectivity,
      authService:
          AuthService(apiClient: apiClient, sessionStore: authSessionStore),
      socialAuthService: SocialAuthService(
        apiClient: apiClient,
        sessionStore: authSessionStore,
      ),
      authSessionStore: authSessionStore,
      themeProvider: themeProvider,
      carProfileStore: carProfileStore,
    );
    await controller.loadPersistedSession().timeout(const Duration(seconds: 5));

    final pushNotifications = PushNotificationService(
      apiClient: apiClient,
      accessTokenProvider: () => controller.accessToken,
    );
    controller.bindPushNotifications(pushNotifications);

    final retryCoordinator = PendingRetryCoordinator(
      connectivity: connectivity,
      submissionService: submissionService,
      accessTokenProvider: () => controller.accessToken,
    );
    retryCoordinator.onSyncComplete = controller.handleRetryResults;
    controller.attachRetryCoordinator(retryCoordinator);

    StartupDiagnostics.checkpoint("critical dependencies ready");
    return TheEyeAppDependencies(
      controller: controller,
      pushNotifications: pushNotifications,
      retryCoordinator: retryCoordinator,
      connectivity: connectivity,
    );
  }

  static Future<void> _initializeDeferredServices(
      TheEyeAppDependencies deps) async {
    StartupDiagnostics.checkpoint("STARTUP 06: deferred services starting");

    try {
      await deps.connectivity.initialize().timeout(const Duration(seconds: 8));
      StartupDiagnostics.checkpoint("STARTUP 07: connectivity ready");
    } catch (error) {
      StartupDiagnostics.checkpoint(
          "STARTUP 07: connectivity skipped ($error)");
    }

    try {
      await deps.pushNotifications
          .initialize()
          .timeout(const Duration(seconds: 15));
    } catch (error) {
      StartupDiagnostics.checkpoint("STARTUP 3: push service skipped ($error)");
    }

    deps.retryCoordinator.start();

    try {
      await deps.controller
          .refreshPendingDrafts()
          .timeout(const Duration(seconds: 5));
    } catch (error) {
      StartupDiagnostics.checkpoint(
          "STARTUP 09: pending draft refresh skipped ($error)");
    }

    StartupDiagnostics.checkpoint("STARTUP 09: deferred services finished");
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = _themeProvider;

    Widget buildStartupMaterialApp({
      required Widget home,
      required bool highContrast,
    }) {
      if (themeProvider == null) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          themeMode: ThemeMode.dark,
          darkTheme: buildDarkTheme(false),
          home: home,
        );
      }

      return AnimatedBuilder(
        animation: themeProvider,
        builder: (context, _) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: buildTheme(highContrast),
            darkTheme: buildDarkTheme(highContrast),
            themeMode: themeProvider.themeMode,
            home: home,
          );
        },
      );
    }

    if (_startupError != null) {
      return buildStartupMaterialApp(
        highContrast: false,
        home: StartupFailureScreen(
          error: _startupError,
          onRetry: () {
            if (_themeProvider != null) {
              unawaited(_startBoot(_themeProvider!));
            } else {
              unawaited(_loadThemeAndBoot());
            }
          },
        ),
      );
    }

    final deps = _dependencies;
    if (deps == null) {
      return buildStartupMaterialApp(
        highContrast: false,
        home: const StartupSplashScreen(),
      );
    }

    return TheEyeApp(
      controller: deps.controller,
      pushNotifications: deps.pushNotifications,
    );
  }
}

class TheEyeAppDependencies {
  const TheEyeAppDependencies({
    required this.controller,
    required this.pushNotifications,
    required this.retryCoordinator,
    required this.connectivity,
  });

  final AppController controller;
  final PushNotificationService pushNotifications;
  final PendingRetryCoordinator retryCoordinator;
  final ConnectivityService connectivity;
}

class StartupSplashScreen extends StatelessWidget {
  const StartupSplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                BrandAssets.officialIcon,
                height: 120,
                width: 120,
                fit: BoxFit.contain,
                semanticLabel: "The Eye",
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.visibility,
                  color: BrandColors.green,
                  size: 120,
                ),
              ),
              const SizedBox(height: 24),
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: BrandColors.green,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class StartupFailureScreen extends StatelessWidget {
  const StartupFailureScreen({required this.error, this.onRetry, super.key});

  final Object? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  color: BrandColors.danger, size: 48),
              const SizedBox(height: 16),
              Text(
                "THE EYE could not start",
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                "Restart the app. If this continues, reinstall the latest build.",
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: context.eyeMutedText,
                    ),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(
                  "$error",
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.eyeMutedText,
                      ),
                ),
              ],
              if (onRetry != null) ...[
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: onRetry,
                  child: const Text("Retry"),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class TheEyeApp extends StatefulWidget {
  const TheEyeApp(
      {required this.controller, required this.pushNotifications, super.key});

  final AppController controller;
  final PushNotificationService pushNotifications;

  @override
  State<TheEyeApp> createState() => _TheEyeAppState();
}

class _TheEyeAppState extends State<TheEyeApp> {
  AppController get controller => widget.controller;
  StreamSubscription<String>? _pushRouteSubscription;

  @override
  void initState() {
    super.initState();
    _pushRouteSubscription =
        widget.pushNotifications.routeStream.listen((route) {
      final navigator = theEyeNavigatorKey.currentState;
      if (navigator == null ||
          !PushDeepLinkRouter.allowedRoutes.contains(route)) return;
      navigator.pushNamedAndRemoveUntil(route,
          (existing) => existing.isFirst || existing.settings.name == "/home");
    });
  }

  @override
  void dispose() {
    _pushRouteSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      controller: controller,
      child: AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          return MaterialApp(
            navigatorKey: theEyeNavigatorKey,
            title: "THE EYE",
            debugShowCheckedModeBanner: false,
            initialRoute: "/",
            theme: buildTheme(controller.highContrastMode),
            darkTheme: buildDarkTheme(controller.highContrastMode),
            themeMode: controller.themeMode,
            builder: (context, child) {
              if (child == null) {
                return const StartupSplashScreen();
              }
              return child;
            },
            routes: {
              "/": (_) => const SplashScreen(),
              "/login": (_) => const LoginRegisterScreen(),
              "/register": (_) => const EmailRegistrationScreen(),
              "/otp-verification": (context) {
                final args = ModalRoute.of(context)?.settings.arguments
                    as OtpVerificationArgs?;
                return OtpVerificationScreen(args: args);
              },
              "/home": (_) => const HomeScreen(),
              "/report/emergency": (context) =>
                  _reportRoute(context, ReportType.emergency),
              "/live-video": (context) {
                final args = ModalRoute.of(context)?.settings.arguments;
                final autoStart =
                    args is LiveVideoRouteArgs && args.autoStartStream;
                return LiveEmergencyVideoScreen(autoStartStream: autoStart);
              },
              "/report/crime": (context) =>
                  _reportRoute(context, ReportType.crime),
              "/report/accident": (context) =>
                  _reportRoute(context, ReportType.accident),
              "/report/fire": (context) =>
                  _reportRoute(context, ReportType.fire),
              "/report/kidnapping": (context) =>
                  _reportRoute(context, ReportType.kidnapping),
              "/report/abuse": (context) =>
                  _reportRoute(context, ReportType.abuse),
              "/report/suspicious-activity": (context) =>
                  _reportRoute(context, ReportType.suspiciousActivity),
              "/missing-person": (_) => const MissingPersonBroadcastScreen(),
              "/stolen-vehicle": (_) => const StolenVehicleBroadcastScreen(),
              "/broadcasts": (_) => const BroadcastCenterScreen(),
              "/police-stations": (_) => const NearbyPoliceStationsScreen(),
              "/notifications": (_) => const NotificationsScreen(),
              "/tracking": (_) => const IncidentTrackingScreen(),
              "/incident-detail": (context) {
                final incidentId =
                    ModalRoute.of(context)?.settings.arguments as String? ?? "";
                final token = appOf(context).accessToken ?? "";
                return IncidentDetailScreen(
                  incidentId: incidentId,
                  accessToken: token,
                );
              },
              "/family": (_) => const FamilySafetyCircleScreen(),
              "/smartwatch": (_) => const SmartwatchDeviceScreen(),
              "/neighborhood-watch": (_) => const NeighborhoodWatchHomeScreen(),
              "/neighborhood-watch/communities": (_) =>
                  const MyCommunitiesScreen(),
              "/neighborhood-watch/join": (_) => const JoinCommunityScreen(),
              "/neighborhood-watch/feed": (_) => const CommunityFeedScreen(),
              "/neighborhood-watch/create": (_) =>
                  const CreateCommunityPostScreen(),
              "/neighborhood-watch/map": (_) => const CommunityMapScreen(),
              "/neighborhood-watch/chat": (_) => const CommunityChatScreen(),
              "/neighborhood-watch/volunteers": (_) => const VolunteersScreen(),
              "/neighborhood-watch/patrols": (_) => const PatrolsScreen(),
              "/neighborhood-watch/alerts": (_) =>
                  const CommunityAlertsScreen(),
              "/profile": (_) => const ProfileScreen(),
              "/profile/edit": (_) => const ProfileEditScreen(),
              "/profile/emergency-contacts": (_) =>
                  const EmergencyContactsScreen(),
              "/profile/kyc": (_) => const KycScreen(),
              "/settings": (_) => const SettingsScreen(),
              "/your-car": (_) => const YourCarScreen(),
              "/account-status": (context) {
                final args = ModalRoute.of(context)?.settings.arguments
                    as AccountStatusArgs?;
                return AccountStatusScreen(
                  title: args?.title ?? "Account unavailable",
                  message:
                      args?.message ?? "Your account cannot sign in right now.",
                );
              },
            },
          );
        },
      ),
    );
  }
}

String? _montserratFontFamily() => EyeTypography.fontFamily();

TextTheme _montserratTextTheme(TextTheme base) =>
    EyeTypography.montserratTextTheme(base);

ThemeData buildTheme(bool highContrast) {
  final baseTextTheme = ThemeData.light().textTheme;
  final textTheme = _montserratTextTheme(baseTextTheme);
  final scheme = highContrast
      ? ColorScheme.fromSeed(
              seedColor: Colors.black, brightness: Brightness.light)
          .copyWith(
          primary: Colors.black,
          onPrimary: Colors.white,
          secondary: BrandColors.orange,
          error: BrandColors.danger,
          surface: BrandColors.lightSurface,
          onSurface: BrandColors.lightText,
        )
      : ColorScheme.fromSeed(
          seedColor: BrandColors.green,
          brightness: Brightness.light,
          primary: BrandColors.green,
          secondary: BrandColors.orange,
          surface: BrandColors.lightSurface,
          onSurface: BrandColors.lightText,
        );

  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: BrandColors.lightBackground,
    fontFamily: _montserratFontFamily(),
    textTheme: textTheme,
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      filled: true,
      fillColor: BrandColors.lightSurface,
      errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BrandColors.danger, width: 2)),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    cardTheme: CardThemeData(
        color: BrandColors.lightSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: BrandColors.lightBorder))),
  );
}

ThemeData buildDarkTheme(bool highContrast) {
  final baseTextTheme = ThemeData.dark().textTheme;
  final textTheme = _montserratTextTheme(baseTextTheme);
  final scheme = ColorScheme.fromSeed(
    seedColor: BrandColors.green,
    brightness: Brightness.dark,
    primary: BrandColors.green,
    secondary: BrandColors.orange,
    surface: BrandColors.darkSurface,
    onSurface: BrandColors.darkText,
    error: BrandColors.danger,
  );

  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: BrandColors.darkBackground,
    fontFamily: _montserratFontFamily(),
    textTheme: textTheme,
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      filled: true,
      fillColor: BrandColors.darkSurfaceMuted,
      errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: BrandColors.danger, width: 2)),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    cardTheme: CardThemeData(
        color: BrandColors.darkSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: BrandColors.darkBorder))),
  );
}

class AppController extends SessionAccessor {
  AppController({
    required IncidentSubmissionService submissionService,
    required ConnectivityService connectivity,
    required AuthService authService,
    required SocialAuthService socialAuthService,
    required AuthSessionStore authSessionStore,
    required ThemeProvider themeProvider,
    required CarProfileStore carProfileStore,
  })  : _submissionService = submissionService,
        _connectivity = connectivity,
        _authService = authService,
        _socialAuthService = socialAuthService,
        _authSessionStore = authSessionStore,
        _themeProvider = themeProvider,
        _carProfileStore = carProfileStore {
    _connectivity.addListener(_onConnectivityChanged);
    _themeProvider.addListener(_onThemeChanged);
    unawaited(_loadCarProfile());
  }

  final IncidentSubmissionService _submissionService;
  final IncidentHistoryService _historyService = IncidentHistoryService();
  final NotificationInboxService _notificationInboxService =
      NotificationInboxService();
  final NotificationInboxCache _notificationInboxCache =
      NotificationInboxCache();
  final ComposeDraftStore _composeDraftStore = ComposeDraftStore();
  IncidentLocationTracker? _locationTracker;
  final ConnectivityService _connectivity;
  final AuthService _authService;
  final SocialAuthService _socialAuthService;
  final AuthSessionStore _authSessionStore;
  final ThemeProvider _themeProvider;
  final CarProfileStore _carProfileStore;
  PushNotificationService? _pushNotifications;
  AuthSession? _cachedSession;
  String? _sessionAccessToken;
  PendingRetryCoordinator? _retryCoordinator;
  Future<SessionRestoreResult>? _restoreInFlight;
  CitizenProfile? _cachedCitizenProfile;
  bool syncingPending = false;
  String? lastSubmissionMessage;
  final List<IncidentDraft> pendingDrafts = [];
  final List<IncidentDraft> composeDrafts = [];
  final List<IncidentTrackingItem> incidents = [];
  bool loadingIncidents = false;
  String? incidentLoadError;
  final List<InboxNotificationItem> notifications = [];
  bool loadingNotifications = false;
  String? notificationLoadError;
  String? notificationNextCursor;
  int notificationUnreadCount = 0;
  bool loadingMoreNotifications = false;

  ConnectivityService get connectivity => _connectivity;
  AuthService get authService => _authService;
  SocialAuthService get socialAuthService => _socialAuthService;
  ConnectivityState get connectivityState => _connectivity.state;
  bool get online => _connectivity.isOnline;
  bool get showConnectivityBanner => _connectivity.showConnectivityBanner;

  @override
  String? get accessToken {
    if (_sessionAccessToken != null && _sessionAccessToken!.isNotEmpty)
      return _sessionAccessToken;
    return theEyeAccessToken.isEmpty ? null : theEyeAccessToken;
  }

  String? get _notificationCacheScope {
    final token = accessToken;
    if (token == null || token.length < 8) return null;
    return token.substring(token.length - 16);
  }

  AuthSession? get session => _cachedSession;

  Future<void> loadPersistedSession() async {
    final session = await _authSessionStore.load();
    _cachedSession = session;
    _sessionAccessToken = session?.accessToken;
    notifyListeners();
    if (_sessionAccessToken != null && _sessionAccessToken!.isNotEmpty) {
      await persistBackgroundPushContext(
        accessToken: _sessionAccessToken!,
        apiBaseUrl: theEyeApiUrl,
      );
      await _pushNotifications?.syncTokenWithBackend();
      unawaited(loadNotificationsFromApi());
    }
  }

  Future<void> setSession(AuthSession session) async {
    await _authSessionStore.save(session);
    _cachedSession = session;
    _sessionAccessToken = session.accessToken;
    clearCitizenProfileCache();
    notifyListeners();
    await persistBackgroundPushContext(
      accessToken: session.accessToken,
      apiBaseUrl: theEyeApiUrl,
    );
    await _pushNotifications?.syncTokenWithBackend();
    unawaited(loadIncidentsFromApi());
    unawaited(loadNotificationsFromApi());
  }

  Future<void> loadNotificationsFromApi({bool refresh = false}) async {
    if (!isAuthenticated || accessToken == null) {
      notifications.clear();
      notificationLoadError = null;
      notificationNextCursor = null;
      notificationUnreadCount = 0;
      notifyListeners();
      return;
    }
    if (refresh) {
      notificationNextCursor = null;
    }
    loadingNotifications = true;
    notificationLoadError = null;
    notifyListeners();
    try {
      final page = await _notificationInboxService.list(
        accessToken: accessToken!,
        cursor: refresh ? null : notificationNextCursor,
      );
      if (refresh || notificationNextCursor == null) {
        notifications
          ..clear()
          ..addAll(page.items);
      } else {
        final existingIds = notifications.map((item) => item.id).toSet();
        notifications.addAll(
          page.items.where((item) => !existingIds.contains(item.id)),
        );
      }
      notificationNextCursor = page.nextCursor;
      notificationUnreadCount = page.unreadCount;
      final cacheScope = _notificationCacheScope;
      if (cacheScope != null) {
        await _notificationInboxCache.save(cacheScope, notifications);
      }
    } on IncidentApiException catch (error) {
      notificationLoadError = error.userMessage;
      final cacheScope = _notificationCacheScope;
      if (cacheScope != null && notifications.isEmpty) {
        notifications
          ..clear()
          ..addAll(await _notificationInboxCache.load(cacheScope));
      }
    } catch (_) {
      notificationLoadError = "Unable to load notifications.";
    } finally {
      loadingNotifications = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreNotifications() async {
    if (!isAuthenticated ||
        accessToken == null ||
        notificationNextCursor == null ||
        loadingMoreNotifications) {
      return;
    }
    loadingMoreNotifications = true;
    notifyListeners();
    try {
      final page = await _notificationInboxService.list(
        accessToken: accessToken!,
        cursor: notificationNextCursor,
      );
      final existingIds = notifications.map((item) => item.id).toSet();
      notifications.addAll(
        page.items.where((item) => !existingIds.contains(item.id)),
      );
      notificationNextCursor = page.nextCursor;
      notificationUnreadCount = page.unreadCount;
    } on IncidentApiException catch (error) {
      notificationLoadError = error.userMessage;
    } finally {
      loadingMoreNotifications = false;
      notifyListeners();
    }
  }

  Future<void> markNotificationRead(String notificationId) async {
    if (!isAuthenticated || accessToken == null) return;
    try {
      await _notificationInboxService.markRead(
        accessToken: accessToken!,
        notificationId: notificationId,
      );
      final index =
          notifications.indexWhere((item) => item.id == notificationId);
      if (index >= 0) {
        notifications[index] =
            notifications[index].copyWith(read: true, deliveryStatus: "Read");
        notificationUnreadCount =
            notifications.where((item) => !item.read).length;
      }
      notifyListeners();
    } on IncidentApiException catch (error) {
      notificationLoadError = error.userMessage;
      notifyListeners();
    }
  }

  Future<void> markAllNotificationsRead() async {
    if (!isAuthenticated || accessToken == null) return;
    try {
      await _notificationInboxService.markAllRead(accessToken: accessToken!);
      for (var index = 0; index < notifications.length; index++) {
        notifications[index] =
            notifications[index].copyWith(read: true, deliveryStatus: "Read");
      }
      notificationUnreadCount = 0;
      notifyListeners();
    } on IncidentApiException catch (error) {
      notificationLoadError = error.userMessage;
      notifyListeners();
    }
  }

  Future<void> upsertNotificationFromPush({
    String? notificationId,
    String? title,
    String? body,
    String? type,
    String? priority,
  }) async {
    if (!isAuthenticated || accessToken == null) return;
    if (notificationId != null && notificationId.isNotEmpty) {
      final existingIndex =
          notifications.indexWhere((item) => item.id == notificationId);
      if (existingIndex >= 0) return;
      try {
        final item = await _notificationInboxService.getById(
          accessToken: accessToken!,
          notificationId: notificationId,
        );
        notifications.insert(0, item);
        if (!item.read) notificationUnreadCount += 1;
        notifyListeners();
        return;
      } catch (_) {
        // Fall through to refresh when detail lookup fails.
      }
    }
    await loadNotificationsFromApi(refresh: true);
  }

  Future<void> loadIncidentsFromApi() async {
    if (!isAuthenticated || accessToken == null) {
      incidents.clear();
      incidentLoadError = null;
      notifyListeners();
      return;
    }
    loadingIncidents = true;
    incidentLoadError = null;
    notifyListeners();
    try {
      final rows =
          await _historyService.listIncidents(accessToken: accessToken!);
      incidents
        ..clear()
        ..addAll(
          rows.map(
            (row) => IncidentTrackingItem(
              row.id,
              row.type,
              row.status,
              row.agency,
              row.confidence,
              submittedAt: row.submittedAt,
              verificationStatus: row.verificationStatus,
            ),
          ),
        );
    } on IncidentApiException catch (error) {
      incidentLoadError = error.userMessage;
    } catch (_) {
      incidentLoadError = "Unable to load incident history.";
    } finally {
      loadingIncidents = false;
      notifyListeners();
    }
  }

  Future<void> refreshComposeDrafts() async {
    composeDrafts
      ..clear()
      ..addAll(await _composeDraftStore.loadDrafts());
    notifyListeners();
  }

  Future<void> saveComposeDraft(IncidentDraft draft) async {
    await _composeDraftStore.upsertDraft(draft);
    await refreshComposeDrafts();
  }

  Future<void> deleteComposeDraft(String clientSubmissionId) async {
    await _composeDraftStore.deleteDraft(clientSubmissionId);
    await refreshComposeDrafts();
  }

  bool _shouldTrackIncidentLocation(String type) {
    return type == IncidentType.emergency ||
        type == IncidentType.fire ||
        type == IncidentType.kidnapping ||
        type == IncidentType.sos;
  }

  void _ensureLocationTracker() {
    _locationTracker ??= IncidentLocationTracker(
        apiClient: TheEyeApiClient(baseUrl: theEyeApiUrl));
  }

  Future<void> startIncidentLocationTracking(String incidentId) async {
    if (accessToken == null) return;
    _ensureLocationTracker();
    _locationTracker!.start(
      incidentId: incidentId,
      accessToken: accessToken!,
    );
  }

  void stopIncidentLocationTracking() {
    _locationTracker?.stop();
  }

  @override
  CitizenProfile? get cachedCitizenProfile => _cachedCitizenProfile;

  @override
  void clearCitizenProfileCache() {
    _cachedCitizenProfile = null;
  }

  @override
  Future<CitizenProfile?> loadCitizenProfile(
      {bool forceRefresh = false}) async {
    if (!isAuthenticated || accessToken == null) {
      clearCitizenProfileCache();
      return null;
    }
    if (!forceRefresh && _cachedCitizenProfile != null) {
      return _cachedCitizenProfile;
    }
    final client = TheEyeApiClient(baseUrl: theEyeApiUrl);
    final profile = await client.fetchCitizenProfile(accessToken: accessToken!);
    _cachedCitizenProfile = profile;
    notifyListeners();
    return profile;
  }

  @override
  Future<CitizenProfile> updateCitizenProfile(
      Map<String, Object?> payload) async {
    final token = accessToken;
    if (token == null) {
      throw StateError("Authenticated session required to update profile");
    }
    final client = TheEyeApiClient(baseUrl: theEyeApiUrl);
    final updated = await client.updateCitizenProfile(
      accessToken: token,
      payload: payload,
    );
    _cachedCitizenProfile = updated;
    notifyListeners();
    return updated;
  }

  @override
  Future<void> clearSession() async {
    await _pushNotifications?.deactivateCurrentToken();
    final cacheScope = _notificationCacheScope;
    await _authService.logout();
    _cachedSession = null;
    _sessionAccessToken = null;
    clearCitizenProfileCache();
    notifications.clear();
    notificationLoadError = null;
    notificationNextCursor = null;
    notificationUnreadCount = 0;
    if (cacheScope != null) {
      await _notificationInboxCache.clear(cacheScope);
    }
    notifyListeners();
  }

  Future<SessionRestoreResult> restoreSession() async {
    if (_restoreInFlight != null) {
      return _restoreInFlight!;
    }

    final pending = _restoreSessionImpl();
    _restoreInFlight = pending;
    try {
      return await pending;
    } finally {
      if (identical(_restoreInFlight, pending)) {
        _restoreInFlight = null;
      }
    }
  }

  Future<SessionRestoreResult> _restoreSessionImpl() async {
    final result = await _authService.restorePersistedSession();
    if (result.session != null) {
      _cachedSession = result.session;
      _sessionAccessToken = result.session!.accessToken;
      notifyListeners();
      await persistBackgroundPushContext(
        accessToken: result.session!.accessToken,
        apiBaseUrl: theEyeApiUrl,
      );
      await _pushNotifications?.syncTokenWithBackend();
      unawaited(loadIncidentsFromApi());
      unawaited(loadNotificationsFromApi(refresh: true));
      unawaited(refreshComposeDrafts());
    } else if (result.status == SessionRestoreStatus.failed ||
        result.status == SessionRestoreStatus.unauthenticated) {
      _cachedSession = null;
      _sessionAccessToken = null;
      clearCitizenProfileCache();
      notifyListeners();
    }
    return result;
  }

  @override
  bool get isAuthenticated =>
      _cachedSession != null && (_cachedSession!.accessToken.isNotEmpty);

  void bindPushNotifications(PushNotificationService service) {
    _pushNotifications = service;
    service.onForegroundMessage = (message) {
      unawaited(
        upsertNotificationFromPush(
          notificationId: message.data["notificationId"]?.toString(),
          title:
              message.notification?.title ?? message.data["title"]?.toString(),
          body: message.notification?.body ?? message.data["body"]?.toString(),
          type: message.data["type"]?.toString(),
          priority: message.data["priority"]?.toString(),
        ),
      );
    };
  }

  void attachRetryCoordinator(PendingRetryCoordinator coordinator) {
    _retryCoordinator = coordinator;
  }

  void _onConnectivityChanged() {
    notifyListeners();
    unawaited(refreshPendingDrafts());
  }

  void toggleHighContrast(bool value) {
    highContrastMode = value;
    notifyListeners();
  }

  void toggleLowData(bool value) {
    lowDataMode = value;
    notifyListeners();
  }

  bool highContrastMode = false;
  @override
  bool lowDataMode = false;
  CarProfile? carProfile;

  ThemeMode get themeMode => _themeProvider.themeMode;
  ThemePreference get themePreference => _themeProvider.preference;

  Future<void> setThemePreference(ThemePreference preference) async {
    await _themeProvider.setPreference(preference);
    notifyListeners();
  }

  Future<void> _loadCarProfile() async {
    carProfile = await _carProfileStore.load();
    notifyListeners();
  }

  Future<void> saveCarProfile(CarProfile profile) async {
    await _carProfileStore.save(profile);
    carProfile = profile;
    notifyListeners();
  }

  Future<void> clearCarProfile() async {
    await _carProfileStore.clear();
    carProfile = null;
    notifyListeners();
  }

  void _onThemeChanged() {
    notifyListeners();
  }

  @override
  void dispose() {
    _locationTracker?.stop();
    _connectivity.removeListener(_onConnectivityChanged);
    _themeProvider.removeListener(_onThemeChanged);
    super.dispose();
  }

  Future<IncidentSubmissionResult> submitIncident(
    IncidentDraft draft, {
    EvidenceUploadProgress? onEvidenceProgress,
  }) async {
    lastSubmissionMessage = null;
    notifyListeners();

    final result = await _submissionService.submit(
      draft,
      accessToken: accessToken,
      forceOfflineQueue: !_connectivity.canSubmitToApi,
      onEvidenceProgress: onEvidenceProgress,
    );

    if (result.isSuccess) {
      if (result.incidentId != null &&
          _shouldTrackIncidentLocation(draft.type)) {
        unawaited(startIncidentLocationTracking(result.incidentId!));
      }
      unawaited(deleteComposeDraft(draft.clientSubmissionId));
      unawaited(loadIncidentsFromApi());
      unawaited(loadNotificationsFromApi(refresh: true));
    } else if (result.isQueued || result.canRetry) {
      unawaited(loadNotificationsFromApi(refresh: true));
    }

    lastSubmissionMessage = result.userMessage;
    await refreshPendingDrafts();
    notifyListeners();
    return result;
  }

  Future<void> syncPendingSubmissions() async {
    if (syncingPending || !online) return;
    syncingPending = true;
    notifyListeners();

    try {
      await _retryCoordinator?.triggerManualSync();
    } finally {
      syncingPending = false;
      await refreshPendingDrafts();
      notifyListeners();
    }
  }

  Future<void> handleRetryResults(
      List<IncidentSubmissionResult> results) async {
    for (final result in results) {
      if (result.isSuccess && result.incidentId != null) {
        unawaited(loadIncidentsFromApi());
      }
    }

    if (results.any((result) => result.isSuccess)) {
      unawaited(loadNotificationsFromApi(refresh: true));
    }

    await refreshPendingDrafts();
    notifyListeners();
  }

  Future<void> refreshPendingDrafts() async {
    pendingDrafts
      ..clear()
      ..addAll(await _submissionService.pendingDrafts());
  }

  @Deprecated("Use submitIncident with IncidentDraft")
  Future<IncidentSubmissionResult> submitDraft(String title, String type) {
    return submitIncident(
      IncidentDraft(
        clientSubmissionId: createClientSubmissionId(),
        type: type,
        description: normalizeIncidentDescription(title, fallback: type),
        latitude: 6.6018,
        longitude: 3.3515,
        capturedAt: DateTime.now().toUtc(),
      ),
    );
  }
}

class IncidentTrackingItem {
  IncidentTrackingItem(
    this.id,
    this.type,
    this.status,
    this.agency,
    this.confidence, {
    this.verificationStatus = "Pending",
    this.submittedAt,
  });

  final String id;
  final String type;
  final String status;
  final String agency;
  final int confidence;
  final String verificationStatus;
  final DateTime? submittedAt;
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(_routeAfterSplash());
  }

  Future<void> _routeAfterSplash() async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    final controller = appOf(context);
    final restore = await controller.restoreSession();
    if (!mounted) return;

    final route = switch (restore.status) {
      SessionRestoreStatus.restored => "/home",
      SessionRestoreStatus.profileIncomplete => "/profile",
      _ => "/login",
    };
    Navigator.of(context).pushReplacementNamed(route);
    StartupDiagnostics.checkpoint("STARTUP 5: $route visible");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EyeTokens.splashBackground,
      body: Semantics(
        label: "Loading THE EYE",
        child: Stack(
          fit: StackFit.expand,
          children: [
            Align(
              alignment: const Alignment(0, -0.05),
              child: Image.asset(
                BrandAssets.logomark,
                width: 220,
                height: 220,
                fit: BoxFit.contain,
                semanticLabel: "The Eye",
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.visibility,
                  color: BrandColors.green,
                  size: 160,
                ),
              ),
            ),
            const SafeArea(
              child: Column(
                children: [
                  SizedBox(height: 24),
                  Text("The Eye", style: EyeTypography.splashTitle),
                ],
              ),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 48),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Text("CAUTION", style: EyeTypography.splashCaution),
                      SizedBox(height: 4),
                      Text(
                        "The eye is watching",
                        style: EyeTypography.splashTagline,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class OtpVerificationArgs {
  const OtpVerificationArgs({required this.phone});

  final String phone;
}

class AccountStatusArgs {
  const AccountStatusArgs({required this.title, required this.message});

  final String title;
  final String message;
}

class AccountStatusScreen extends StatelessWidget {
  const AccountStatusScreen({
    required this.title,
    required this.message,
    super.key,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BrandColors.accentHover,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset(BrandAssets.lockupDarkBg,
                    height: 64, semanticLabel: "The Eye"),
                const SizedBox(height: 24),
                Text(title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: BrandColors.command)),
                const SizedBox(height: 12),
                Text(message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 16, color: BrandColors.command)),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () =>
                      Navigator.of(context).pushReplacementNamed("/login"),
                  style: FilledButton.styleFrom(
                      backgroundColor: BrandColors.accentHover,
                      minimumSize: const Size.fromHeight(48)),
                  child: const Text("Back to sign in"),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class LoginRegisterScreen extends StatefulWidget {
  const LoginRegisterScreen({super.key});

  @override
  State<LoginRegisterScreen> createState() => _LoginRegisterScreenState();
}

class _LoginRegisterScreenState extends State<LoginRegisterScreen>
    with WidgetsBindingObserver {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  String? identifierError;
  String? passwordError;
  String? formError;
  bool submitting = false;
  bool obscurePassword = true;
  SocialAuthProvider? activeSocialProvider;
  DateTime? _socialSignInStartedAt;

  bool get socialBusy => activeSocialProvider != null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || activeSocialProvider == null) {
      return;
    }
    final startedAt = _socialSignInStartedAt;
    if (startedAt == null) return;
    if (DateTime.now().difference(startedAt) > const Duration(seconds: 90)) {
      setState(() {
        activeSocialProvider = null;
        _socialSignInStartedAt = null;
        formError ??=
            "Google sign-in did not finish. If you picked an account, make sure the API is running and reachable from your phone.";
      });
    }
  }

  Future<void> _submitLogin() async {
    setState(() {
      submitting = true;
      identifierError = null;
      passwordError = null;
      formError = null;
    });

    final controller = appOf(context);
    final result = await controller.authService.login(
      identifier: _identifierController.text,
      password: _passwordController.text,
    );
    if (!mounted) return;

    if (result.fieldErrors.isNotEmpty) {
      setState(() {
        submitting = false;
        identifierError = result.fieldErrors["identifier"];
        passwordError = result.fieldErrors["password"];
        formError = result.userMessage;
      });
      return;
    }

    if (result.isSuccess && result.session != null) {
      await controller.setSession(result.session!);
      if (!mounted) return;
      if (!result.profileComplete) {
        Navigator.of(context).pushReplacementNamed("/profile");
        return;
      }
      Navigator.of(context).pushReplacementNamed("/home");
      return;
    }

    setState(() {
      submitting = false;
      formError = result.userMessage;
    });
  }

  Future<void> _handleSocialSignIn(SocialAuthProvider provider) async {
    if (submitting || socialBusy) return;

    setState(() {
      activeSocialProvider = provider;
      _socialSignInStartedAt = DateTime.now();
      formError = null;
    });

    final controller = appOf(context);
    SocialAuthResult result;
    try {
      result = provider == SocialAuthProvider.google
          ? await controller.socialAuthService.signInWithGoogle()
          : await controller.socialAuthService.signInWithApple();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        activeSocialProvider = null;
        _socialSignInStartedAt = null;
        formError =
            "Sign-in could not be completed. Check your connection and try again.";
      });
      return;
    }

    if (!mounted) return;

    if (result.isSuccess && result.session != null) {
      _socialSignInStartedAt = null;
      await controller.setSession(result.session!);
      if (!mounted) return;
      if (!result.profileComplete) {
        Navigator.of(context).pushReplacementNamed("/profile");
        return;
      }
      Navigator.of(context).pushReplacementNamed("/home");
      return;
    }

    if (result.status == SocialAuthStatus.accountSuspended ||
        result.status == SocialAuthStatus.accountDeactivated) {
      setState(() {
        activeSocialProvider = null;
        _socialSignInStartedAt = null;
      });
      Navigator.of(context).pushReplacementNamed(
        "/account-status",
        arguments: AccountStatusArgs(
          title: result.status == SocialAuthStatus.accountSuspended
              ? "Account suspended"
              : "Account deactivated",
          message:
              result.userMessage ?? "Your account cannot sign in right now.",
        ),
      );
      return;
    }

    setState(() {
      activeSocialProvider = null;
      _socialSignInStartedAt = null;
      if (result.status != SocialAuthStatus.cancelled) {
        formError = result.userMessage;
      }
    });
  }

  Future<void> _handleForgotPassword() async {
    final parsed = parseLoginIdentifier(_identifierController.text);
    final controller = appOf(context);

    if (parsed.kind == LoginIdentifierKind.phone &&
        isValidPhoneNumber(_identifierController.text)) {
      final result =
          await controller.authService.requestPhoneOtp(parsed.phone!);
      if (!mounted) return;
      if (!result.isSuccess) {
        setState(() => formError = result.userMessage);
        return;
      }
      Navigator.of(context).pushNamed(
        "/otp-verification",
        arguments: OtpVerificationArgs(phone: parsed.phone!),
      );
      return;
    }

    final result = await controller.authService
        .requestPasswordReset(_identifierController.text);
    if (!mounted) return;
    setState(() => formError = result.userMessage ??
        "If that email exists, reset instructions were sent.");
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = !submitting &&
        !socialBusy &&
        _identifierController.text.trim().isNotEmpty &&
        _passwordController.text.isNotEmpty;

    return Scaffold(
      backgroundColor: BrandColors.lightBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 42, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Welcome back!",
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: BrandColors.command,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                "Glad to have you back",
                style: TextStyle(fontSize: 16, color: BrandColors.ash),
              ),
              const SizedBox(height: 32),
              const Text(
                "Email",
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: BrandColors.command,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _identifierController,
                decoration: InputDecoration(
                  hintText: "Enter your correct email",
                  errorText: identifierError,
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(
                        color: BrandColors.authStroke, width: 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(
                        color: BrandColors.accentHover, width: 1),
                  ),
                ),
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.username],
                textInputAction: TextInputAction.next,
                onChanged: (_) {
                  if (identifierError != null) {
                    setState(() => identifierError = null);
                  } else {
                    setState(() {});
                  }
                },
              ),
              const SizedBox(height: 12),
              const Text(
                "Password",
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: BrandColors.command,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _passwordController,
                obscureText: obscurePassword,
                decoration: InputDecoration(
                  hintText: "Enter password",
                  errorText: passwordError,
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(
                        color: BrandColors.authStroke, width: 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(
                        color: BrandColors.accentHover, width: 1),
                  ),
                  suffixIcon: IconButton(
                    onPressed: () =>
                        setState(() => obscurePassword = !obscurePassword),
                    icon: Icon(
                      obscurePassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: BrandColors.ash,
                    ),
                  ),
                ),
                autofillHints: const [AutofillHints.password],
                onChanged: (_) {
                  if (passwordError != null) {
                    setState(() => passwordError = null);
                  } else {
                    setState(() {});
                  }
                },
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: submitting ? null : _handleForgotPassword,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    "Forgot password?",
                    style: TextStyle(color: BrandColors.accentHover),
                  ),
                ),
              ),
              if (formError != null) ...[
                const SizedBox(height: 8),
                Text(
                  formError!,
                  style: const TextStyle(
                    color: BrandColors.danger,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: canSubmit
                      ? BrandColors.accentHover
                      : BrandColors.authInactive,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(51),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: canSubmit ? _submitLogin : null,
                child: submitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text("Log In"),
              ),
              const SizedBox(height: 16),
              const Center(
                child: Text(
                  "Or",
                  style: TextStyle(fontSize: 16, color: BrandColors.command),
                ),
              ),
              const SizedBox(height: 16),
              _SocialSignInButton(
                label: "Continue with Google",
                semanticLabel: "Continue with Google",
                icon: Icons.g_mobiledata_rounded,
                loading: activeSocialProvider == SocialAuthProvider.google,
                enabled: !submitting && !socialBusy,
                onPressed: () => _handleSocialSignIn(SocialAuthProvider.google),
              ),
              if (SocialAuthService.isAppleSignInSupported) ...[
                const SizedBox(height: 12),
                _SocialSignInButton(
                  label: "Continue with Apple",
                  semanticLabel: "Continue with Apple",
                  icon: Icons.apple,
                  loading: activeSocialProvider == SocialAuthProvider.apple,
                  enabled: !submitting && !socialBusy,
                  onPressed: () =>
                      _handleSocialSignIn(SocialAuthProvider.apple),
                ),
              ],
              const SizedBox(height: 16),
              TextButton(
                onPressed: submitting || socialBusy
                    ? null
                    : () => Navigator.of(context).pushReplacementNamed("/home"),
                child: const Text(
                  "Continue without signing in",
                  style: TextStyle(color: BrandColors.accentHover),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text.rich(
                  TextSpan(
                    style: const TextStyle(
                      fontSize: 14,
                      color: BrandColors.command,
                    ),
                    children: [
                      const TextSpan(text: "New user? "),
                      WidgetSpan(
                        alignment: PlaceholderAlignment.baseline,
                        baseline: TextBaseline.alphabetic,
                        child: GestureDetector(
                          onTap: socialBusy || submitting
                              ? null
                              : () =>
                                  Navigator.of(context).pushNamed("/register"),
                          child: const Text(
                            "Create an account",
                            style: TextStyle(color: BrandColors.accentHover),
                          ),
                        ),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class EmailRegistrationScreen extends StatefulWidget {
  const EmailRegistrationScreen({super.key});

  @override
  State<EmailRegistrationScreen> createState() =>
      _EmailRegistrationScreenState();
}

class _EmailRegistrationScreenState extends State<EmailRegistrationScreen> {
  final _emailController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  String? emailError;
  String? firstNameError;
  String? lastNameError;
  String? passwordError;
  String? confirmPasswordError;
  String? formError;
  bool submitting = false;
  bool obscurePassword = true;
  bool obscureConfirmPassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submitRegistration() async {
    setState(() {
      submitting = true;
      emailError = null;
      firstNameError = null;
      lastNameError = null;
      passwordError = null;
      confirmPasswordError = null;
      formError = null;
    });

    final controller = appOf(context);
    final result = await controller.authService.register(
      email: _emailController.text,
      password: _passwordController.text,
      confirmPassword: _confirmPasswordController.text,
      firstName: _firstNameController.text,
      lastName: _lastNameController.text,
    );
    if (!mounted) return;

    if (result.fieldErrors.isNotEmpty) {
      setState(() {
        submitting = false;
        emailError = result.fieldErrors["email"];
        firstNameError = result.fieldErrors["firstName"];
        lastNameError = result.fieldErrors["lastName"];
        passwordError = result.fieldErrors["password"];
        confirmPasswordError = result.fieldErrors["confirmPassword"];
        formError = result.userMessage;
      });
      return;
    }

    if (result.isSuccess && result.session != null) {
      await controller.setSession(result.session!);
      if (!mounted) return;
      if (!result.profileComplete) {
        Navigator.of(context).pushReplacementNamed("/profile");
        return;
      }
      Navigator.of(context).pushReplacementNamed("/home");
      return;
    }

    setState(() {
      submitting = false;
      formError = result.userMessage;
    });
  }

  InputDecoration _fieldDecoration({
    required String hintText,
    String? errorText,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      errorText: errorText,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: BrandColors.authStroke, width: 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: BrandColors.accentHover, width: 1),
      ),
      suffixIcon: suffixIcon,
    );
  }

  Widget _labeledField({
    required String label,
    required Widget field,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: BrandColors.command,
          ),
        ),
        const SizedBox(height: 8),
        field,
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = !submitting &&
        _emailController.text.trim().isNotEmpty &&
        _firstNameController.text.trim().isNotEmpty &&
        _lastNameController.text.trim().isNotEmpty &&
        _passwordController.text.isNotEmpty &&
        _confirmPasswordController.text.isNotEmpty;

    return Scaffold(
      backgroundColor: BrandColors.lightBackground,
      appBar: AppBar(
        backgroundColor: BrandColors.lightBackground,
        elevation: 0,
        foregroundColor: BrandColors.command,
        title: const Text("Create account"),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Join THE EYE",
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: BrandColors.command,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                "Create your citizen account with email",
                style: TextStyle(fontSize: 16, color: BrandColors.ash),
              ),
              const SizedBox(height: 24),
              _labeledField(
                label: "Email",
                field: TextField(
                  controller: _emailController,
                  decoration: _fieldDecoration(
                    hintText: "Enter your email",
                    errorText: emailError,
                  ),
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() => emailError = null),
                ),
              ),
              const SizedBox(height: 12),
              _labeledField(
                label: "First name",
                field: TextField(
                  controller: _firstNameController,
                  decoration: _fieldDecoration(
                    hintText: "First name",
                    errorText: firstNameError,
                  ),
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() => firstNameError = null),
                ),
              ),
              const SizedBox(height: 12),
              _labeledField(
                label: "Last name",
                field: TextField(
                  controller: _lastNameController,
                  decoration: _fieldDecoration(
                    hintText: "Last name",
                    errorText: lastNameError,
                  ),
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() => lastNameError = null),
                ),
              ),
              const SizedBox(height: 12),
              _labeledField(
                label: "Password",
                field: TextField(
                  controller: _passwordController,
                  obscureText: obscurePassword,
                  decoration: _fieldDecoration(
                    hintText: "At least 8 characters",
                    errorText: passwordError,
                    suffixIcon: IconButton(
                      onPressed: () =>
                          setState(() => obscurePassword = !obscurePassword),
                      icon: Icon(
                        obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: BrandColors.ash,
                      ),
                    ),
                  ),
                  autofillHints: const [AutofillHints.newPassword],
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() => passwordError = null),
                ),
              ),
              const SizedBox(height: 12),
              _labeledField(
                label: "Confirm password",
                field: TextField(
                  controller: _confirmPasswordController,
                  obscureText: obscureConfirmPassword,
                  decoration: _fieldDecoration(
                    hintText: "Re-enter password",
                    errorText: confirmPasswordError,
                    suffixIcon: IconButton(
                      onPressed: () => setState(() =>
                          obscureConfirmPassword = !obscureConfirmPassword),
                      icon: Icon(
                        obscureConfirmPassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: BrandColors.ash,
                      ),
                    ),
                  ),
                  autofillHints: const [AutofillHints.newPassword],
                  onChanged: (_) => setState(() => confirmPasswordError = null),
                  onSubmitted: (_) {
                    if (canSubmit) _submitRegistration();
                  },
                ),
              ),
              if (formError != null) ...[
                const SizedBox(height: 8),
                Text(
                  formError!,
                  style: const TextStyle(
                    color: BrandColors.danger,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: canSubmit
                      ? BrandColors.accentHover
                      : BrandColors.authInactive,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(51),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: canSubmit ? _submitRegistration : null,
                child: submitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text("Create account"),
              ),
              const SizedBox(height: 16),
              Center(
                child: Text.rich(
                  TextSpan(
                    style: const TextStyle(
                      fontSize: 14,
                      color: BrandColors.command,
                    ),
                    children: [
                      const TextSpan(text: "Already have an account? "),
                      WidgetSpan(
                        alignment: PlaceholderAlignment.baseline,
                        baseline: TextBaseline.alphabetic,
                        child: GestureDetector(
                          onTap: submitting
                              ? null
                              : () => Navigator.of(context)
                                  .pushReplacementNamed("/login"),
                          child: const Text(
                            "Log in",
                            style: TextStyle(color: BrandColors.accentHover),
                          ),
                        ),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SocialSignInButton extends StatelessWidget {
  const _SocialSignInButton({
    required this.label,
    required this.semanticLabel,
    required this.icon,
    required this.onPressed,
    required this.loading,
    required this.enabled,
  });

  final String label;
  final String semanticLabel;
  final IconData icon;
  final VoidCallback onPressed;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          side: const BorderSide(color: BrandColors.accentHover, width: 1),
          foregroundColor: BrandColors.accentHover,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        onPressed: enabled && !loading ? onPressed : null,
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2))
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 28, color: BrandColors.accentHover),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w400,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class OtpVerificationScreen extends StatefulWidget {
  const OtpVerificationScreen({this.args, super.key});

  final OtpVerificationArgs? args;

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  final _otpController = TextEditingController();
  String? otpError;
  String? formError;
  bool verifying = false;
  bool resending = false;
  int resendSecondsRemaining = 0;
  Timer? _resendTimer;

  @override
  void initState() {
    super.initState();
    _startResendCountdown();
  }

  @override
  void dispose() {
    _otpController.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  void _startResendCountdown() {
    _resendTimer?.cancel();
    setState(() =>
        resendSecondsRemaining = AuthValidationRules.resendCooldownSeconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (resendSecondsRemaining <= 1) {
        timer.cancel();
        setState(() => resendSecondsRemaining = 0);
        return;
      }
      setState(() => resendSecondsRemaining -= 1);
    });
  }

  String? get _phone => widget.args?.phone;

  Future<void> _verify() async {
    final phone = _phone;
    if (phone == null) {
      setState(() =>
          formError = "Go back and request a code with your phone number.");
      return;
    }

    setState(() {
      verifying = true;
      otpError = null;
      formError = null;
    });

    final controller = appOf(context);
    final result = await controller.authService.verifyPhoneOtp(
      phone: phone,
      code: _otpController.text,
    );
    if (!mounted) return;

    if (result.fieldErrors["otp"] != null) {
      setState(() {
        verifying = false;
        otpError = result.fieldErrors["otp"];
      });
      return;
    }

    if (result.isSuccess && result.session != null) {
      await controller.setSession(result.session!);
      if (!mounted) return;
      if (!result.profileComplete) {
        Navigator.of(context).pushReplacementNamed("/profile");
        return;
      }
      Navigator.of(context).pushReplacementNamed("/home");
      return;
    }

    setState(() {
      verifying = false;
      formError = result.userMessage;
    });
  }

  Future<void> _resend() async {
    final phone = _phone;
    if (phone == null || resendSecondsRemaining > 0 || resending) return;

    setState(() {
      resending = true;
      formError = null;
    });

    final result = await appOf(context).authService.requestPhoneOtp(phone);
    if (!mounted) return;

    setState(() => resending = false);
    if (!result.isSuccess) {
      setState(() => formError = result.userMessage);
      return;
    }

    _startResendCountdown();
    setState(() => formError = result.userMessage);
  }

  @override
  Widget build(BuildContext context) {
    final args = widget.args ??
        (ModalRoute.of(context)?.settings.arguments as OtpVerificationArgs?);
    final phone = args?.phone;
    final maskedDestination =
        phone == null ? "your phone" : maskPhoneForOtp(phone);
    final codeComplete =
        _otpController.text.length == AuthValidationRules.otpLength;

    return Scaffold(
      backgroundColor: EyeTokens.whiteBg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
          child: Column(
            children: [
              Image.asset(
                BrandAssets.otpEmailSent,
                width: 132,
                height: 134,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Container(
                  width: 132,
                  height: 134,
                  decoration: const BoxDecoration(
                    color: EyeTokens.greenMain,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.send_rounded,
                      color: Colors.white, size: 56),
                ),
              ),
              const SizedBox(height: 32),
              Text(
                "Verify your account",
                textAlign: TextAlign.center,
                style: EyeTypography.fieldHint.copyWith(
                  color: EyeTokens.black1,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Please enter the 6-digit verification code sent to $maskedDestination",
                textAlign: TextAlign.center,
                style:
                    EyeTypography.fieldHint.copyWith(color: EyeTokens.black1),
              ),
              const SizedBox(height: 48),
              EyeOtpInput(
                controller: _otpController,
                length: AuthValidationRules.otpLength,
                errorText: otpError,
                onChanged: (value) {
                  final sanitized = sanitizeOtpInput(value);
                  if (sanitized != value) {
                    _otpController.value = TextEditingValue(
                      text: sanitized,
                      selection:
                          TextSelection.collapsed(offset: sanitized.length),
                    );
                  }
                  if (otpError != null) setState(() => otpError = null);
                  setState(() {});
                },
              ),
              const SizedBox(height: 32),
              EyePrimaryButton(
                label: "Verify",
                loading: verifying,
                enabled: codeComplete && !verifying,
                onPressed: codeComplete && !verifying ? _verify : null,
              ),
              const SizedBox(height: 12),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    "Didn't receive code? ",
                    style: EyeTypography.fieldHint
                        .copyWith(color: EyeTokens.black1),
                  ),
                  GestureDetector(
                    onTap: (resendSecondsRemaining > 0 ||
                            resending ||
                            phone == null)
                        ? null
                        : _resend,
                    child: Text(
                      resendSecondsRemaining > 0
                          ? "Resend code in ${formatResendCountdown(resendSecondsRemaining)}"
                          : resending
                              ? "Resending..."
                              : "Resend code",
                      style: EyeTypography.link.copyWith(
                        decoration: TextDecoration.underline,
                        color: resendSecondsRemaining > 0 || resending
                            ? EyeTokens.greenMain
                            : EyeTokens.greenMain,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                alignment: WrapAlignment.center,
                children: [
                  Text(
                    "Experiencing issues? ",
                    style: EyeTypography.fieldHint
                        .copyWith(color: EyeTokens.black1),
                  ),
                  GestureDetector(
                    onTap: () => showAppSnackBar(
                      context,
                      "Contact your local THE EYE support desk for help.",
                    ),
                    child: Text(
                      "Contact support",
                      style: EyeTypography.link.copyWith(
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
              if (formError != null) ...[
                const SizedBox(height: 16),
                Text(
                  formError!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: BrandColors.danger,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              TextButton(
                onPressed: () =>
                    Navigator.of(context).pushReplacementNamed("/login"),
                child: const Text("Back to sign in"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const _heroSlides = [
    EyeHeroSlide(
      title: "Accident Reporting",
      subtitle:
          "Report incidents with diligence and make sure you get help quickly.",
      gradient: [Color(0xFF1A2A3A), Color(0xFF4A5568)],
      icon: Icons.car_crash,
    ),
    EyeHeroSlide(
      title: "Emergency Case",
      subtitle:
          "Share your live location during emergencies to get help faster",
      gradient: [Color(0xFF7F1D1D), Color(0xFFB91C1C)],
      icon: Icons.emergency,
    ),
    EyeHeroSlide(
      title: "Report Crime",
      subtitle:
          "Report crimes quickly and securely with our easy-to-use platform.",
      gradient: [Color(0xFF1E3A5F), Color(0xFF312E81)],
      icon: Icons.local_police,
    ),
    EyeHeroSlide(
      title: "Job Vacancies",
      subtitle:
          "Your gateway to the latest job opportunities that are specifically suited for you.",
      gradient: [Color(0xFF14532D), Color(0xFF166534)],
      icon: Icons.work_outline,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    return SafetyScaffold(
      title: "Home",
      selectedIndex: 0,
      useFigmaShell: true,
      body: ListView(
        padding:
            const EdgeInsets.only(bottom: EyeTokens.contentBottomClearance),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                IconButton(
                  tooltip: "Incident history",
                  onPressed: () => Navigator.of(context).pushNamed("/tracking"),
                  icon: const Icon(Icons.history, color: EyeTokens.greenMain),
                ),
                const Spacer(),
                IconButton(
                  tooltip: "Notifications",
                  onPressed: () =>
                      Navigator.of(context).pushNamed("/notifications"),
                  icon: const Icon(Icons.notifications_none,
                      color: EyeTokens.greenMain),
                ),
              ],
            ),
          ),
          const EyeHeroCarousel(slides: _heroSlides),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: EyeTokens.cardGap,
              crossAxisSpacing: EyeTokens.cardGap,
              childAspectRatio: 165 / 150,
              children: [
                EyeServiceCard(
                  title: "Emergency Case",
                  description:
                      "Ensure fast and accurate information during urgent situations",
                  icon: Icons.emergency_share,
                  onTap: () =>
                      Navigator.of(context).pushNamed("/report/emergency"),
                ),
                EyeServiceCard(
                  title: "Accident Reporting",
                  description:
                      "Report accidents swiftly and accurately with our intuitive platform",
                  icon: Icons.car_crash_outlined,
                  onTap: () =>
                      Navigator.of(context).pushNamed("/report/accident"),
                ),
                EyeServiceCard(
                  title: "Nearest Police Station",
                  description:
                      "Locate the nearest police station quickly in case of emergencies",
                  icon: Icons.local_police_outlined,
                  onTap: () =>
                      Navigator.of(context).pushNamed("/police-stations"),
                ),
                EyeServiceCard(
                  title: "Job Vacancies",
                  description:
                      "Discover job opportunities tailored to your skills and interests",
                  icon: Icons.work_outline,
                  onTap: () => Navigator.of(context).pushNamed("/broadcasts"),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: StatusStrip(controller: controller),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SectionCard(
              title: "All services",
              child: GridView.count(
                crossAxisCount: MediaQuery.sizeOf(context).width > 640 ? 3 : 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.15,
                children: [
                  ActionTile(
                      "Live emergency video",
                      Icons.videocam,
                      Colors.red.shade900,
                      () => Navigator.of(context).pushNamed("/live-video")),
                  ActionTile(
                      "Report crime",
                      Icons.local_police,
                      Colors.indigo.shade700,
                      () => Navigator.of(context).pushNamed("/report/crime")),
                  ActionTile(
                      "Fire report",
                      Icons.local_fire_department,
                      Colors.deepOrange.shade700,
                      () => Navigator.of(context).pushNamed("/report/fire")),
                  ActionTile(
                      "Kidnapping report",
                      Icons.report,
                      Colors.red.shade900,
                      () => Navigator.of(context)
                          .pushNamed("/report/kidnapping")),
                  ActionTile(
                      "Abuse report",
                      Icons.health_and_safety,
                      Colors.pink.shade700,
                      () => Navigator.of(context).pushNamed("/report/abuse")),
                  ActionTile(
                      "Suspicious activity",
                      Icons.visibility,
                      Colors.amber.shade900,
                      () => Navigator.of(context)
                          .pushNamed("/report/suspicious-activity")),
                  ActionTile(
                      "Missing person",
                      Icons.person_search,
                      Colors.teal.shade700,
                      () => Navigator.of(context).pushNamed("/missing-person")),
                  ActionTile(
                      "Stolen vehicle",
                      Icons.directions_car,
                      Colors.blueGrey.shade700,
                      () => Navigator.of(context).pushNamed("/stolen-vehicle")),
                  ActionTile("SOS device", Icons.watch, Colors.red.shade800,
                      () => Navigator.of(context).pushNamed("/smartwatch")),
                  ActionTile(
                      "Neighborhood Watch",
                      Icons.groups,
                      Colors.teal.shade800,
                      () => Navigator.of(context)
                          .pushNamed("/neighborhood-watch")),
                  ActionTile(
                      "Safety broadcasts",
                      Icons.campaign,
                      Colors.purple.shade700,
                      () => Navigator.of(context).pushNamed("/broadcasts")),
                  ActionTile(
                      "Incident status",
                      Icons.radar,
                      Colors.cyan.shade800,
                      () => Navigator.of(context).pushNamed("/tracking")),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SectionCard(
              title: "Active incidents",
              child: Column(
                children: controller.incidents
                    .take(2)
                    .map((incident) => IncidentStatusTile(incident: incident))
                    .toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ReportScreen extends StatefulWidget {
  const ReportScreen({required this.type, this.initialDraft, super.key});

  final ReportType type;
  final IncidentDraft? initialDraft;

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

Widget _reportRoute(BuildContext context, ReportType type) {
  final draft = ModalRoute.of(context)?.settings.arguments;
  return ReportScreen(
    type: type,
    initialDraft: draft is IncidentDraft ? draft : null,
  );
}

class _ReportScreenState extends State<ReportScreen> {
  bool anonymous = false;
  bool notifyEmergencyContact = true;
  bool manualLocation = false;
  bool submitting = false;
  bool loadingEmergencyContacts = false;
  String? descriptionError;
  String? locationError;
  String? submissionError;
  String composeDraftId = createClientSubmissionId();
  double? draftLatitude;
  double? draftLongitude;
  double? draftAccuracy;
  List<EmergencyContact> emergencyContacts = const [];
  final Set<String> selectedEmergencyContactIds = {};
  Timer? composeSaveTimer;
  final _evidenceSectionKey = GlobalKey<ManagedEvidenceSectionState>();
  final descriptionController = TextEditingController();
  final manualAddressController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final draft = widget.initialDraft;
    if (draft != null) {
      composeDraftId = draft.clientSubmissionId;
      descriptionController.text = draft.description;
      anonymous = draft.anonymous;
      notifyEmergencyContact = draft.notifyEmergencyContacts;
      selectedEmergencyContactIds.addAll(draft.emergencyContactIds);
      manualLocation =
          draft.manualAddress != null && draft.manualAddress!.isNotEmpty;
      manualAddressController.text = draft.manualAddress ?? "";
      draftLatitude = draft.latitude;
      draftLongitude = draft.longitude;
      draftAccuracy = draft.locationAccuracyMeters;
    }
    descriptionController.addListener(_scheduleComposeDraftSave);
    manualAddressController.addListener(_scheduleComposeDraftSave);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_loadEmergencyContacts());
    });
  }

  @override
  void dispose() {
    composeSaveTimer?.cancel();
    descriptionController.dispose();
    manualAddressController.dispose();
    super.dispose();
  }

  void _scheduleComposeDraftSave() {
    composeSaveTimer?.cancel();
    composeSaveTimer = Timer(const Duration(milliseconds: 800), () {
      if (mounted) unawaited(_persistComposeDraft());
    });
  }

  Future<void> _loadEmergencyContacts() async {
    final controller = appOf(context);
    if (!controller.isAuthenticated || controller.accessToken == null) return;
    setState(() => loadingEmergencyContacts = true);
    try {
      final client = TheEyeApiClient(baseUrl: theEyeApiUrl);
      final contacts = await client.listEmergencyContacts(
        accessToken: controller.accessToken!,
      );
      if (!mounted) return;
      setState(() {
        emergencyContacts = contacts;
        if (selectedEmergencyContactIds.isEmpty && contacts.isNotEmpty) {
          selectedEmergencyContactIds.addAll(
            contacts.take(3).map((contact) => contact.id),
          );
        }
      });
    } catch (_) {
      if (mounted) setState(() => emergencyContacts = const []);
    } finally {
      if (mounted) setState(() => loadingEmergencyContacts = false);
    }
  }

  Future<void> _persistComposeDraft() async {
    final trimmed = descriptionController.text.trim();
    if (trimmed.isEmpty &&
        !anonymous &&
        !notifyEmergencyContact &&
        !manualLocation) {
      return;
    }

    final controller = appOf(context);
    Position? position;
    if (draftLatitude != null && draftLongitude != null) {
      position = Position(
        latitude: draftLatitude!,
        longitude: draftLongitude!,
        timestamp: DateTime.now().toUtc(),
        accuracy: draftAccuracy ?? 0,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
    } else {
      final outcome = await captureLocationOutcome(
        accuracy: LocationAccuracy.low,
      );
      position = outcome.position;
      if (position != null) {
        draftLatitude = position.latitude;
        draftLongitude = position.longitude;
        draftAccuracy = position.accuracy;
      }
    }
    if (position == null || !mounted) return;

    final draft = buildIncidentDraft(
      type: widget.type.incidentType,
      description: trimmed.isEmpty ? "${widget.type.label} draft" : trimmed,
      position: position,
      anonymous: anonymous,
      notifyEmergencyContacts: notifyEmergencyContact,
      emergencyContactIds: selectedEmergencyContactIds.toList(),
      manualAddress:
          manualLocation ? manualAddressController.text.trim() : null,
      title: trimmed.isEmpty ? widget.type.label : trimmed,
      clientSubmissionId: composeDraftId,
    );
    await controller.saveComposeDraft(draft);
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final isEmergency = widget.type == ReportType.emergency;
    return Scaffold(
      backgroundColor: EyeTokens.whiteBg,
      body: SafeArea(
        child: Column(
          children: [
            EyePageBackHeader(title: widget.type.figmaTitle),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  if (controller.showConnectivityBanner)
                    OfflineStatusBanner(state: controller.connectivityState),
                  if (controller.showConnectivityBanner)
                    const SizedBox(height: 12),
                  if (isEmergency) ...[
                    SizedBox(
                      width: double.infinity,
                      height: EyeTokens.buttonHeight,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.red.shade700,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(EyeTokens.radiusSm),
                          ),
                        ),
                        onPressed: submitting
                            ? null
                            : () => _submit(context, urgent: true),
                        icon: submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.flash_on),
                        label: Text(
                          submitting ? "Sending..." : "Send emergency now",
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    EyeOutlinedButton(
                      label: "Start live emergency video",
                      icon: const Icon(Icons.videocam, size: 20),
                      onPressed: () =>
                          Navigator.of(context).pushNamed("/live-video"),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Text("Location of the incident",
                      style: EyeTypography.fieldLabel),
                  const SizedBox(height: 8),
                  if (locationError != null) ...[
                    LocationDeniedBanner(
                      message: locationError!,
                      onOpenSettings: () => openAppSettings(),
                    ),
                    const SizedBox(height: 12),
                  ],
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: manualLocation,
                    onChanged: (value) =>
                        setState(() => manualLocation = value),
                    title: const Text("Manual location adjustment"),
                    subtitle: const Text("GPS is captured automatically"),
                  ),
                  if (manualLocation) ...[
                    const SizedBox(height: 8),
                    EyeTextField(
                      label: "Adjusted location",
                      controller: manualAddressController,
                      hint: "Enter the specific address",
                    ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    isEmergency
                        ? "Injuries or fatalities"
                        : "${widget.type.label} description",
                    style: EyeTypography.fieldLabel,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: descriptionController,
                    maxLines: isEmergency ? 5 : 4,
                    style: EyeTypography.fieldHint
                        .copyWith(color: EyeTokens.black1),
                    decoration: InputDecoration(
                      hintText: isEmergency
                          ? "Enter information about the injuries"
                          : "Describe what happened",
                      hintStyle: EyeTypography.fieldHint,
                      errorText: descriptionError,
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 12,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
                        borderSide: const BorderSide(color: EyeTokens.stroke),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
                        borderSide: const BorderSide(
                          color: EyeTokens.greenMain,
                          width: 2,
                        ),
                      ),
                      errorBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
                        borderSide: const BorderSide(
                          color: EyeTokens.danger,
                          width: 2,
                        ),
                      ),
                    ),
                    onChanged: (_) {
                      if (descriptionError != null) {
                        setState(() => descriptionError = null);
                      }
                    },
                  ),
                  const SizedBox(height: 16),
                  ManagedEvidenceSection(
                    key: _evidenceSectionKey,
                    lowDataMode: controller.lowDataMode,
                    figmaStyle: true,
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: anonymous,
                    onChanged: (value) => setState(() => anonymous = value),
                    title: const Text("Report anonymously"),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: notifyEmergencyContact,
                    onChanged: (value) {
                      setState(() => notifyEmergencyContact = value);
                      if (value) unawaited(_loadEmergencyContacts());
                      _scheduleComposeDraftSave();
                    },
                    title: const Text("Notify emergency contact"),
                  ),
                  if (notifyEmergencyContact) ...[
                    if (loadingEmergencyContacts)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: LinearProgressIndicator(),
                      )
                    else if (emergencyContacts.isEmpty)
                      const ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text("No saved emergency contacts"),
                        subtitle: Text("Add contacts from your profile"),
                      )
                    else
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: emergencyContacts
                            .map(
                              (contact) => FilterChip(
                                label: Text(contact.name),
                                selected: selectedEmergencyContactIds
                                    .contains(contact.id),
                                onSelected: (selected) {
                                  setState(() {
                                    if (selected) {
                                      selectedEmergencyContactIds
                                          .add(contact.id);
                                    } else {
                                      selectedEmergencyContactIds
                                          .remove(contact.id);
                                    }
                                  });
                                  _scheduleComposeDraftSave();
                                },
                              ),
                            )
                            .toList(),
                      ),
                  ],
                  if (submissionError != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      submissionError!,
                      style: const TextStyle(color: BrandColors.danger),
                    ),
                  ],
                  const SizedBox(height: 16),
                  EyePrimaryButton(
                    label: "Submit",
                    loading: submitting,
                    enabled: !submitting,
                    onPressed: submitting ? null : () => _submit(context),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit(BuildContext context, {bool urgent = false}) async {
    final trimmed = descriptionController.text.trim();
    if (widget.type != ReportType.emergency && trimmed.isEmpty) {
      setState(
          () => descriptionError = "Add a short description before submitting");
      showAppSnackBar(
          context, "Please describe the incident before submitting.",
          isError: true);
      return;
    }

    setState(() {
      submitting = true;
      descriptionError = null;
      locationError = null;
      submissionError = null;
    });

    final controller = appOf(context);
    final outcome = await captureLocationOutcome(
        accuracy: controller.lowDataMode
            ? LocationAccuracy.medium
            : LocationAccuracy.high);
    if (!context.mounted) return;

    if (outcome.result != LocationCaptureResult.granted ||
        outcome.position == null) {
      setState(() {
        submitting = false;
        locationError = locationFailureMessage(outcome.result);
      });
      showAppSnackBar(context, locationFailureMessage(outcome.result),
          isError: true);
      return;
    }

    final draft = buildIncidentDraft(
      type: widget.type.incidentType,
      description: trimmed.isEmpty
          ? "Emergency report submitted via THE EYE mobile."
          : trimmed,
      position: outcome.position!,
      anonymous: anonymous,
      notifyEmergencyContacts: notifyEmergencyContact,
      emergencyContactIds: selectedEmergencyContactIds.toList(),
      manualAddress:
          manualLocation ? manualAddressController.text.trim() : null,
      title: trimmed.isEmpty ? widget.type.label : trimmed,
      localMedia: _evidenceSectionKey.currentState?.attachments ?? const [],
      clientSubmissionId: composeDraftId,
    );

    for (final attachment in draft.localMedia) {
      _evidenceSectionKey.currentState?.markUploading(attachment.localId, 0);
    }

    final result = await controller.submitIncident(
      draft,
      onEvidenceProgress: (localId, progress) {
        if (progress >= 1) {
          _evidenceSectionKey.currentState?.markUploaded(localId);
        } else {
          _evidenceSectionKey.currentState?.markUploading(localId, progress);
        }
      },
    );
    if (!context.mounted) return;
    setState(() => submitting = false);

    for (final attachment in draft.localMedia) {
      if (result.isSuccess &&
          result.userMessage != null &&
          result.userMessage!.contains("Evidence upload failed")) {
        _evidenceSectionKey.currentState
            ?.markUploadFailed(attachment.localId, result.userMessage!);
      }
    }

    if (result.status == IncidentSubmissionStatus.duplicateInFlight) {
      return;
    }

    if (result.status == IncidentSubmissionStatus.validationError ||
        result.status == IncidentSubmissionStatus.serverValidationError) {
      setState(() {
        submissionError = result.userMessage;
        descriptionError = result.fieldErrors["description"];
      });
      showAppSnackBar(context, result.userMessage ?? "Unable to submit report.",
          isError: true);
      return;
    }

    if (result.status == IncidentSubmissionStatus.unauthorized) {
      showAppSnackBar(context, result.userMessage ?? "Sign in is required.",
          isError: true);
      Navigator.of(context).pushNamed("/login");
      return;
    }

    if (result.isSuccess) {
      showAppSnackBar(
          context,
          urgent
              ? "Emergency sent. Track status in Incident status."
              : "${widget.type.label} report submitted.");
    } else if (result.isQueued || result.canRetry) {
      showAppSnackBar(context,
          result.userMessage ?? "${widget.type.label} saved for retry.");
    } else {
      showAppSnackBar(context, result.userMessage ?? "Unable to submit report.",
          isError: true);
      return;
    }

    Navigator.of(context).pushNamed("/tracking");
  }
}

class MissingPersonBroadcastScreen extends StatefulWidget {
  const MissingPersonBroadcastScreen({super.key});

  @override
  State<MissingPersonBroadcastScreen> createState() =>
      _MissingPersonBroadcastScreenState();
}

class _MissingPersonBroadcastScreenState
    extends State<MissingPersonBroadcastScreen> {
  final fullNameController = TextEditingController();
  final descriptionController = TextEditingController();
  final _evidenceSectionKey = GlobalKey<ManagedEvidenceSectionState>();
  bool submitting = false;

  @override
  void dispose() {
    fullNameController.dispose();
    descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (fullNameController.text.trim().isEmpty) {
      showAppSnackBar(context, "Enter the missing person's full name.",
          isError: true);
      return;
    }

    setState(() => submitting = true);
    final controller = appOf(context);
    final outcome = await captureLocationOutcome();
    if (!mounted) return;
    if (outcome.result != LocationCaptureResult.granted ||
        outcome.position == null) {
      setState(() => submitting = false);
      showAppSnackBar(context, locationFailureMessage(outcome.result),
          isError: true);
      return;
    }

    final draft = buildIncidentDraft(
      type: IncidentType.missingPerson,
      description: descriptionController.text.trim().isEmpty
          ? "Missing person report for ${fullNameController.text.trim()}"
          : descriptionController.text.trim(),
      position: outcome.position!,
      title: "Missing person: ${fullNameController.text.trim()}",
      missingPerson:
          MissingPersonDetails(fullName: fullNameController.text.trim()),
      localMedia: _evidenceSectionKey.currentState?.attachments ?? const [],
    );

    final result = await controller.submitIncident(draft);
    if (!mounted) return;
    setState(() => submitting = false);

    if (result.isSuccess || result.isQueued || result.canRetry) {
      showAppSnackBar(
          context, result.userMessage ?? "Missing person report submitted.");
      Navigator.of(context).pushNamed("/tracking");
      return;
    }

    showAppSnackBar(context,
        result.userMessage ?? "Unable to submit missing person report.",
        isError: true);
  }

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Missing person",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Missing person broadcast",
            child: Column(
              children: [
                const Icon(Icons.person_search,
                    size: 52, color: BrandColors.green),
                const SizedBox(height: 16),
                TextField(
                    controller: fullNameController,
                    decoration: const InputDecoration(labelText: "Full name")),
                const SizedBox(height: 12),
                TextField(
                    controller: descriptionController,
                    maxLines: 3,
                    decoration:
                        const InputDecoration(labelText: "Description")),
                const SizedBox(height: 12),
                ManagedEvidenceSection(
                    key: _evidenceSectionKey,
                    lowDataMode: appOf(context).lowDataMode),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: submitting ? null : _submit,
                  child: submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text("Submit broadcast"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class LiveVideoRouteArgs {
  const LiveVideoRouteArgs({this.autoStartStream = false});

  final bool autoStartStream;
}

class LiveEmergencyVideoScreen extends StatefulWidget {
  const LiveEmergencyVideoScreen({this.autoStartStream = false, super.key});

  final bool autoStartStream;

  @override
  State<LiveEmergencyVideoScreen> createState() =>
      _LiveEmergencyVideoScreenState();
}

class _LiveEmergencyVideoScreenState extends State<LiveEmergencyVideoScreen> {
  final TheEyeApiClient apiClient = TheEyeApiClient(baseUrl: theEyeApiUrl);
  late final LiveVideoSessionController liveVideoController =
      LiveVideoSessionController();
  bool lowBandwidth = true;
  bool startingStream = false;
  bool stoppingStream = false;
  bool _streamStartInFlight = false;
  bool permissionDenied = false;
  String? permissionError;
  String? activeIncidentId;
  String roomName = "eye-incident-active-emergency";
  String liveSessionId = "";
  Position? latestPosition;
  DateTime? lastCapturedAt;
  Timer? locationTimer;

  @override
  void initState() {
    super.initState();
    liveVideoController.addListener(_onLiveVideoChanged);
    unawaited(_initializeLiveVideo());
  }

  Future<void> _initializeLiveVideo() async {
    await _preparePreview();
    if (!mounted || !widget.autoStartStream || streaming) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || streaming) return;
      unawaited(_startStream(context));
    });
  }

  Future<void> _preparePreview() async {
    final ok =
        await liveVideoController.startLocalPreview(lowBandwidth: lowBandwidth);
    if (!mounted) return;
    if (!ok && liveVideoController.errorMessage != null) {
      setState(() {
        permissionDenied = true;
        permissionError = liveVideoController.errorMessage;
      });
    }
  }

  void _onLiveVideoChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    locationTimer?.cancel();
    liveVideoController.removeListener(_onLiveVideoChanged);
    liveVideoController.dispose();
    super.dispose();
  }

  bool get streaming => liveVideoController.isStreaming;

  LiveVideoEvidenceOverlay get _overlay {
    final gps = latestPosition == null
        ? "Waiting for GPS"
        : "${latestPosition!.latitude.toStringAsFixed(6)}, ${latestPosition!.longitude.toStringAsFixed(6)}";
    final accuracy = latestPosition == null
        ? "Unknown"
        : "±${latestPosition!.accuracy.toStringAsFixed(0)}m";
    return LiveVideoEvidenceOverlay.fromApi(
      liveVideoController.evidenceOverlayRaw,
      connectionStatus:
          liveVideoConnectionLabel(liveVideoController.connectionState),
      fallbackIncidentId: activeIncidentId,
      fallbackSessionId: liveSessionId,
    ).copyWithFallbackGps(
        gps: gps,
        accuracy: accuracy,
        time: lastCapturedAt == null
            ? null
            : formatEvidenceTimestamp(lastCapturedAt!));
  }

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Live emergency video",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          LiveVideoPreviewPane(
            controller: liveVideoController,
            overlay: _overlay,
            onOpenMaps: openMaps,
          ),
          const SizedBox(height: 16),
          if (permissionDenied ||
              permissionError != null ||
              liveVideoController.errorMessage != null) ...[
            LocationDeniedBanner(
              message: permissionError ??
                  liveVideoController.errorMessage ??
                  "Camera and microphone permission are required for live emergency video.",
              onOpenSettings: () => openAppSettings(),
            ),
            const SizedBox(height: 16),
          ],
          SectionCard(
            title: "LiveKit emergency stream",
            child: Column(
              children: [
                SwitchListTile(
                  value: lowBandwidth,
                  onChanged: streaming
                      ? null
                      : (value) async {
                          setState(() => lowBandwidth = value);
                          await liveVideoController.startLocalPreview(
                              lowBandwidth: value);
                        },
                  title: const Text("Emergency low-bandwidth mode"),
                  subtitle: const Text(
                      "Prioritizes audio and lower video bitrate for weak networks"),
                ),
                if (streaming) ...[
                  SwitchListTile(
                    value: !liveVideoController.isMuted,
                    onChanged: (_) => liveVideoController.toggleMute(),
                    title: const Text("Microphone"),
                    subtitle: Text(liveVideoController.isMuted
                        ? "Muted"
                        : "Live audio enabled"),
                  ),
                  SwitchListTile(
                    value: liveVideoController.isCameraEnabled,
                    onChanged: (_) => liveVideoController.toggleCamera(),
                    title: const Text("Camera"),
                    subtitle: Text(liveVideoController.isCameraEnabled
                        ? "Camera enabled"
                        : "Camera off"),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: liveVideoController.switchCamera,
                          icon: const Icon(Icons.cameraswitch),
                          label: const Text("Switch camera"),
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (liveVideoController.connectionState ==
                          LiveVideoConnectionState.disconnected)
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () =>
                                liveVideoController.safeReconnect(),
                            icon: const Icon(Icons.refresh),
                            label: const Text("Reconnect"),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                ],
                if (liveVideoController.recordingConfigured)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Text(
                        "Server-side recording is configured for this session.",
                        style: TextStyle(
                            fontSize: 12, color: BrandColors.lightTextMuted)),
                  ),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                      backgroundColor:
                          streaming ? Colors.black : Colors.red.shade700),
                  onPressed: (startingStream || stoppingStream)
                      ? null
                      : () => streaming
                          ? _stopStream(context)
                          : _startStream(context),
                  icon: (startingStream || stoppingStream)
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Icon(streaming ? Icons.stop_circle : Icons.play_circle),
                  label: Text(
                    startingStream
                        ? "Starting stream..."
                        : stoppingStream
                            ? "Stopping stream..."
                            : streaming
                                ? "Stop live video"
                                : "Start live video",
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Location sharing",
            child: Text(streaming
                ? "Your live GPS is being shared with authorized emergency admins every 5 seconds."
                : "Location is captured before the LiveKit stream starts and stored with the evidence timeline."),
          ),
        ],
      ),
    );
  }

  Future<void> _startStream(BuildContext context) async {
    if (_streamStartInFlight || streaming) return;
    _streamStartInFlight = true;
    setState(() {
      startingStream = true;
      permissionDenied = false;
      permissionError = null;
    });

    try {
      final previewOk = await liveVideoController
          .startLocalPreview(lowBandwidth: lowBandwidth)
          .timeout(kLiveVideoStartTimeout);
      if (!mounted) return;
      if (!previewOk) {
        setState(() {
          permissionDenied = true;
          permissionError = liveVideoController.errorMessage;
        });
        if (liveVideoController.errorMessage != null) {
          showAppSnackBar(context, liveVideoController.errorMessage!,
              isError: true);
        }
        return;
      }

      final outcome = await captureLocationOutcome(
          accuracy:
              lowBandwidth ? LocationAccuracy.medium : LocationAccuracy.high);
      if (!mounted) return;
      if (outcome.position == null) {
        final message = locationFailureMessage(outcome.result);
        setState(() {
          permissionDenied = true;
          permissionError = message;
        });
        showAppSnackBar(context, message, isError: true);
        return;
      }

      final position = outcome.position!;
      final appController = appOf(context);
      final draft = buildIncidentDraft(
        type: IncidentType.emergency,
        description: "Live emergency video started with GPS.",
        position: position,
        notifyEmergencyContacts: true,
        title: "Live emergency video",
      );
      final submission = await appController
          .submitIncident(draft)
          .timeout(kLiveVideoStartTimeout);
      if (!mounted) return;
      if (!submission.isSuccess || submission.incidentId == null) {
        showAppSnackBar(
            context,
            submission.userMessage ??
                "Unable to create incident for live video.",
            isError: true);
        return;
      }

      activeIncidentId = submission.incidentId;
      setState(() {
        latestPosition = position;
        lastCapturedAt = position.timestamp;
        roomName = "eye-incident-$activeIncidentId";
      });

      final accessToken = appController.session?.accessToken ??
          (theEyeAccessToken.isNotEmpty ? theEyeAccessToken : null);
      final envelope = await apiClient
          .startLiveVideo(
            incidentId: activeIncidentId!,
            payload: TheEyePayloads.liveVideoStart(
                position: position, lowBandwidthMode: lowBandwidth),
            accessToken: accessToken,
          )
          .timeout(kLiveVideoStartTimeout);
      final startResult = LiveVideoStartResult.fromResponse(envelope);
      liveSessionId = startResult.sessionId;
      roomName = startResult.roomName;
      final connected = await liveVideoController
          .connectPublisher(startResult)
          .timeout(kLiveVideoStartTimeout);
      if (!mounted) return;
      if (!connected) {
        showAppSnackBar(
            context,
            liveVideoController.errorMessage ??
                "Unable to join live video room.",
            isError: true);
        return;
      }

      if (!mounted) return;
      setState(() {
        permissionDenied = false;
        permissionError = null;
      });
      showAppSnackBar(
          context, "Live stream started. GPS is shared every 5 seconds.");
      locationTimer?.cancel();
      locationTimer =
          Timer.periodic(const Duration(seconds: 5), (_) => _sendGpsUpdate());
    } on TimeoutException {
      if (!mounted) return;
      showAppSnackBar(context,
          "Live video start timed out. Check your connection and try again.",
          isError: true);
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showAppSnackBar(
          context, mapLiveVideoApiError(error.statusCode, error.userMessage),
          isError: true);
    } catch (_) {
      if (!mounted) return;
      showAppSnackBar(context, "Unable to start live video right now.",
          isError: true);
    } finally {
      _streamStartInFlight = false;
      if (mounted) setState(() => startingStream = false);
    }
  }

  Future<void> _stopStream(BuildContext context) async {
    if (stoppingStream) return;
    setState(() => stoppingStream = true);
    try {
      locationTimer?.cancel();
      if (liveSessionId.isNotEmpty) {
        try {
          final accessToken = appOf(context).session?.accessToken ??
              (theEyeAccessToken.isNotEmpty ? theEyeAccessToken : null);
          await apiClient
              .stopLiveVideo(sessionId: liveSessionId, accessToken: accessToken)
              .timeout(const Duration(seconds: 15));
        } catch (_) {
          // Local stop still proceeds; server reconciliation happens on next start.
        }
      }
      await liveVideoController.stop(keepPreview: true);
      if (!mounted) return;
      setState(() {
        liveSessionId = "";
        activeIncidentId = null;
      });
      showAppSnackBar(context, "Live stream stopped.");
    } finally {
      if (mounted) setState(() => stoppingStream = false);
    }
  }

  Future<void> _sendGpsUpdate() async {
    final position = await _captureLocation();
    if (position == null || !mounted || liveSessionId.isEmpty) return;
    setState(() {
      latestPosition = position;
      lastCapturedAt = position.timestamp;
    });
    try {
      final accessToken = appOf(context).session?.accessToken ??
          (theEyeAccessToken.isNotEmpty ? theEyeAccessToken : null);
      await apiClient.postLiveVideoLocation(
        sessionId: liveSessionId,
        payload: TheEyePayloads.liveVideoLocationUpdate(position: position),
        accessToken: accessToken,
      );
    } catch (_) {
      unawaited(appOf(context).loadNotificationsFromApi(refresh: true));
    }
  }

  Future<Position?> _captureLocation() async {
    final outcome = await captureLocationOutcome(
        accuracy:
            lowBandwidth ? LocationAccuracy.medium : LocationAccuracy.high);
    return outcome.position;
  }
}

class StolenVehicleBroadcastScreen extends StatefulWidget {
  const StolenVehicleBroadcastScreen({super.key});

  @override
  State<StolenVehicleBroadcastScreen> createState() =>
      _StolenVehicleBroadcastScreenState();
}

class _StolenVehicleBroadcastScreenState
    extends State<StolenVehicleBroadcastScreen> {
  final plateController = TextEditingController();
  final makeController = TextEditingController();
  final modelController = TextEditingController();
  final colorController = TextEditingController();
  final yearController = TextEditingController();
  final vinController = TextEditingController();
  final descriptionController = TextEditingController();
  final _evidenceSectionKey = GlobalKey<ManagedEvidenceSectionState>();
  bool submitting = false;
  bool usedSavedCar = false;
  bool prefilledFromSavedCar = false;
  String? savedCarImagePath;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (prefilledFromSavedCar) return;
    prefilledFromSavedCar = true;
    _applySavedCarProfile(appOf(context).carProfile, notify: false);
  }

  void _applySavedCarProfile(CarProfile? profile, {bool notify = true}) {
    if (profile == null || !profile.hasRequiredFields) return;
    plateController.text = profile.plateNumber;
    makeController.text = profile.make;
    modelController.text = profile.model;
    colorController.text = profile.color ?? "";
    yearController.text = profile.year?.toString() ?? "";
    vinController.text = profile.vin ?? "";
    if (profile.notes != null && profile.notes!.isNotEmpty) {
      descriptionController.text = profile.notes!;
    }
    savedCarImagePath = profile.imagePath;
    usedSavedCar = true;
    if (notify && mounted) setState(() {});
  }

  @override
  void dispose() {
    plateController.dispose();
    makeController.dispose();
    modelController.dispose();
    colorController.dispose();
    yearController.dispose();
    vinController.dispose();
    descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (plateController.text.trim().isEmpty ||
        makeController.text.trim().isEmpty ||
        modelController.text.trim().isEmpty) {
      showAppSnackBar(context, "Plate number, make, and model are required.",
          isError: true);
      return;
    }

    setState(() => submitting = true);
    final controller = appOf(context);
    final outcome = await captureLocationOutcome();
    if (!mounted) return;
    if (outcome.result != LocationCaptureResult.granted ||
        outcome.position == null) {
      setState(() => submitting = false);
      showAppSnackBar(context, locationFailureMessage(outcome.result),
          isError: true);
      return;
    }

    final yearText = yearController.text.trim();
    int? year;
    if (yearText.isNotEmpty) {
      year = int.tryParse(yearText);
    }

    final draft = buildIncidentDraft(
      type: IncidentType.stolenVehicle,
      description: descriptionController.text.trim().isEmpty
          ? "Stolen vehicle report for ${plateController.text.trim()}"
          : descriptionController.text.trim(),
      position: outcome.position!,
      title: "Stolen vehicle: ${plateController.text.trim()}",
      stolenVehicle: StolenVehicleDetails(
        plateNumber: plateController.text.trim(),
        make: makeController.text.trim(),
        model: modelController.text.trim(),
        color: colorController.text.trim().isEmpty
            ? null
            : colorController.text.trim(),
        year: year,
        vin: vinController.text.trim().isEmpty
            ? null
            : vinController.text.trim(),
      ),
      localMedia: _evidenceSectionKey.currentState?.attachments ?? const [],
    );

    final result = await controller.submitIncident(draft);
    if (!mounted) return;
    setState(() => submitting = false);

    if (result.isSuccess || result.isQueued || result.canRetry) {
      showAppSnackBar(
          context, result.userMessage ?? "Stolen vehicle report submitted.");
      Navigator.of(context).pushNamed("/tracking");
      return;
    }

    showAppSnackBar(context,
        result.userMessage ?? "Unable to submit stolen vehicle report.",
        isError: true);
  }

  @override
  Widget build(BuildContext context) {
    final savedCar = appOf(context).carProfile;
    final hasSavedCar = savedCar?.hasRequiredFields ?? false;
    return SafetyScaffold(
      title: "Stolen vehicle",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Stolen vehicle broadcast",
            child: Column(
              children: [
                const Icon(Icons.directions_car,
                    size: 52, color: BrandColors.green),
                const SizedBox(height: 16),
                if (hasSavedCar)
                  OutlinedButton.icon(
                    onPressed: () {
                      _applySavedCarProfile(savedCar);
                      showAppSnackBar(
                          context, "Loaded your saved car details.");
                    },
                    icon: const Icon(Icons.directions_car_filled_outlined),
                    label: Text(usedSavedCar
                        ? "Reload my saved car"
                        : "Use my saved car"),
                  ),
                if (hasSavedCar) const SizedBox(height: 12),
                if (savedCarImagePath != null &&
                    File(savedCarImagePath!).existsSync())
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.file(
                        File(savedCarImagePath!),
                        height: 140,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                TextField(
                    controller: plateController,
                    decoration:
                        const InputDecoration(labelText: "Plate number")),
                const SizedBox(height: 12),
                TextField(
                    controller: makeController,
                    decoration: const InputDecoration(labelText: "Make")),
                const SizedBox(height: 12),
                TextField(
                    controller: modelController,
                    decoration: const InputDecoration(labelText: "Model")),
                const SizedBox(height: 12),
                TextField(
                    controller: yearController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: "Year")),
                const SizedBox(height: 12),
                TextField(
                    controller: colorController,
                    decoration: const InputDecoration(labelText: "Color")),
                const SizedBox(height: 12),
                TextField(
                    controller: vinController,
                    decoration:
                        const InputDecoration(labelText: "VIN (optional)")),
                const SizedBox(height: 12),
                TextField(
                    controller: descriptionController,
                    maxLines: 3,
                    decoration:
                        const InputDecoration(labelText: "Description")),
                const SizedBox(height: 12),
                ManagedEvidenceSection(
                    key: _evidenceSectionKey,
                    lowDataMode: appOf(context).lowDataMode),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: submitting ? null : _submit,
                  child: submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text("Submit broadcast"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class BroadcastCenterScreen extends StatelessWidget {
  const BroadcastCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final alerts = [
      (
        "Emergency broadcast",
        "P1",
        "Verified emergency near Allen Avenue",
        "1.2 km away",
        Icons.emergency,
        Colors.red.shade700
      ),
      (
        "Missing person broadcast",
        "P2",
        "Missing child last seen near Ikeja terminal",
        "Ikeja LGA",
        Icons.person_search,
        Colors.teal.shade700
      ),
      (
        "Stolen vehicle broadcast",
        "P2",
        "Silver Toyota Corolla, plate LAG-123-EYE",
        "Opebi and Allen Avenue",
        Icons.directions_car,
        Colors.blueGrey.shade700
      ),
      (
        "Crime broadcast",
        "P2",
        "Police response active near Allen Avenue",
        "2 km safety radius",
        Icons.local_police,
        Colors.indigo.shade700
      ),
      (
        "Accident broadcast",
        "P2",
        "Multi-vehicle collision affecting traffic",
        "Awolowo Way",
        Icons.car_crash,
        Colors.orange.shade800
      ),
      (
        "Government alert",
        "Official",
        "Temporary road closure for emergency response",
        "Lagos State",
        Icons.account_balance,
        BrandColors.green
      ),
      (
        "Community warning",
        "P3",
        "Neighborhood watch reports suspicious activity",
        "Allen Avenue community",
        Icons.groups,
        BrandColors.orange
      ),
    ];

    return SafetyScaffold(
      title: "Safety broadcasts",
      selectedIndex: 3,
      useFigmaShell: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          const SectionCard(
            title: "Alerts for your location",
            child: Text(
                "Verified emergency and government alerts are targeted using your current community and safety radius."),
          ),
          const SizedBox(height: 16),
          ...alerts.map(
            (alert) => ListTileCard(
              leading: CircleAvatar(
                backgroundColor: alert.$6.withValues(alpha: 0.12),
                foregroundColor: alert.$6,
                child: Icon(alert.$5),
              ),
              title: alert.$1,
              subtitle: "${alert.$2} - ${alert.$3}\n${alert.$4}",
              trailing: const Icon(Icons.chevron_right),
            ),
          ),
        ],
      ),
    );
  }
}

class BroadcastForm extends StatelessWidget {
  const BroadcastForm(
      {required this.icon,
      required this.title,
      required this.fields,
      required this.onSubmit,
      super.key});

  final IconData icon;
  final String title;
  final List<String> fields;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
      children: [
        SectionCard(
          title: title,
          child: Column(
            children: [
              Icon(icon,
                  size: 52, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              ...fields.map((field) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: TextField(
                        decoration: InputDecoration(labelText: field)),
                  )),
              ManagedEvidenceSection(
                  key: GlobalKey<ManagedEvidenceSectionState>(),
                  lowDataMode: appOf(context).lowDataMode),
              const SizedBox(height: 16),
              FilledButton(
                  onPressed: onSubmit, child: const Text("Submit broadcast")),
            ],
          ),
        ),
      ],
    );
  }
}

class NearbyPoliceStationsScreen extends StatelessWidget {
  const NearbyPoliceStationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final stations = [
      PoliceStationView("Ikeja Central Police Station", "+2348000003001",
          "Ikeja, Lagos", "police", 6.6018, 3.3515, "0.2 km"),
      PoliceStationView(
          "Alausa Security Post",
          "+2348000003002",
          "Alausa Secretariat Road, Ikeja",
          "security",
          6.6172,
          3.3589,
          "2.4 km"),
      PoliceStationView("Opebi Police Desk", "+2348000003003",
          "Opebi Road, Ikeja", "police", 6.5988, 3.3521, "1.1 km"),
    ];

    return SafetyScaffold(
      title: "Nearby police",
      selectedIndex: 1,
      useFigmaShell: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Container(
            height: 240,
            decoration: BoxDecoration(
              color: BrandColors.lightSurfaceMuted,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: BrandColors.lightBorder),
            ),
            child: const Center(
                child: Icon(Icons.map, size: 72, color: BrandColors.green)),
          ),
          const SizedBox(height: 16),
          const TextField(
              decoration: InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  labelText: "Search by state, LGA, or location")),
          const SizedBox(height: 12),
          ...stations.map((station) => PoliceStationCard(station: station)),
        ],
      ),
    );
  }
}

class PoliceStationView {
  PoliceStationView(this.name, this.phone, this.address, this.agencyType,
      this.latitude, this.longitude, this.distance);

  final String name;
  final String phone;
  final String address;
  final String agencyType;
  final double latitude;
  final double longitude;
  final String distance;

  Uri get navigationUri => Uri.parse(
      "https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude&travelmode=driving");
}

class PoliceStationCard extends StatelessWidget {
  const PoliceStationCard({required this.station, super.key});

  final PoliceStationView station;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BrandColors.lightBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                  station.agencyType == "police"
                      ? Icons.local_police
                      : Icons.security,
                  color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(
                  child: Text(station.name,
                      style: const TextStyle(fontWeight: FontWeight.w900))),
              Text(station.distance,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 8),
          Text(station.address),
          const SizedBox(height: 4),
          Text(
              "${station.phone} - ${station.agencyType} - ${station.latitude}, ${station.longitude}",
              style: const TextStyle(color: BrandColors.lightTextMuted)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.phone),
                      label: const Text("Call"))),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => launchUrl(station.navigationUri,
                      mode: LaunchMode.externalApplication),
                  icon: const Icon(Icons.navigation),
                  label: const Text("Navigate"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      unawaited(controller.loadNotificationsFromApi(refresh: true));
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    if (!controller.isAuthenticated) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      backgroundColor: EyeTokens.whiteBg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EyePageBackHeader(),
            if (controller.notificationUnreadCount > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () =>
                        unawaited(controller.markAllNotificationsRead()),
                    child: Text(
                        "Mark all read (${controller.notificationUnreadCount})"),
                  ),
                ),
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () =>
                    controller.loadNotificationsFromApi(refresh: true),
                child: _buildBody(controller),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(AppController controller) {
    if (controller.loadingNotifications && controller.notifications.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 120),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }
    if (controller.notificationLoadError != null &&
        controller.notifications.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          ListTile(
            leading: const Icon(Icons.cloud_off),
            title: const Text("Notifications unavailable"),
            subtitle: Text(controller.notificationLoadError!),
          ),
          FilledButton(
            onPressed: () =>
                unawaited(controller.loadNotificationsFromApi(refresh: true)),
            child: const Text("Retry"),
          ),
        ],
      );
    }
    if (controller.notifications.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: const [
          ListTile(
            leading: Icon(Icons.notifications_none),
            title: Text("No notifications yet"),
            subtitle:
                Text("Safety alerts and incident updates will appear here."),
          ),
        ],
      );
    }
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 240 &&
            controller.notificationNextCursor != null &&
            !controller.loadingMoreNotifications) {
          unawaited(controller.loadMoreNotifications());
        }
        return false;
      },
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: controller.notifications.length +
            (controller.loadingMoreNotifications ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          if (index >= controller.notifications.length) {
            return const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final alert = controller.notifications[index];
          return BroadcastAlertTile(
            alert: alert,
            onTap: () async {
              await controller.markNotificationRead(alert.id);
              final route = alert.deepLink ?? "/notifications";
              if (!context.mounted) return;
              if (route == "/notifications") return;
              Navigator.of(context).pushNamed(route);
            },
          );
        },
      ),
    );
  }
}

class IncidentTrackingScreen extends StatefulWidget {
  const IncidentTrackingScreen({super.key});

  @override
  State<IncidentTrackingScreen> createState() => _IncidentTrackingScreenState();
}

class _IncidentTrackingScreenState extends State<IncidentTrackingScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = appOf(context);
      unawaited(controller.loadIncidentsFromApi());
      unawaited(controller.refreshComposeDrafts());
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    return SafetyScaffold(
      title: "Incident status",
      selectedIndex: 2,
      body: RefreshIndicator(
        onRefresh: () async {
          await controller.loadIncidentsFromApi();
          await controller.refreshPendingDrafts();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          children: [
            if (controller.loadingIncidents)
              const Padding(
                padding: EdgeInsets.all(12),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (controller.incidentLoadError != null)
              ListTile(
                leading: const Icon(Icons.cloud_off),
                title: const Text("History unavailable"),
                subtitle: Text(controller.incidentLoadError!),
              ),
            if (controller.composeDrafts.isNotEmpty)
              SectionCard(
                title: "Saved drafts",
                child: Column(
                  children: controller.composeDrafts
                      .map(
                        (draft) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.edit_note),
                          title: Text(draft.type),
                          subtitle: Text(draft.description),
                          onTap: () {
                            final reportType =
                                reportTypeForIncidentType(draft.type);
                            if (reportType == null) return;
                            Navigator.of(context).pushNamed(
                              reportType.routePath,
                              arguments: draft,
                            );
                          },
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () => controller
                                .deleteComposeDraft(draft.clientSubmissionId),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            if (controller.pendingDrafts.isNotEmpty)
              SectionCard(
                title: "Pending submissions",
                child: Column(
                  children: [
                    ...controller.pendingDrafts.map(
                      (draft) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.cloud_off),
                        title: Text(draft.type),
                        subtitle: Text(draft.description),
                      ),
                    ),
                    if (controller.online)
                      FilledButton(
                        onPressed: controller.syncingPending
                            ? null
                            : () => controller.syncPendingSubmissions(),
                        child: Text(controller.syncingPending
                            ? "Retrying..."
                            : "Retry pending submissions"),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            if (controller.incidents.isEmpty && !controller.loadingIncidents)
              const ListTile(
                leading: Icon(Icons.history),
                title: Text("No submitted incidents yet"),
                subtitle: Text(
                    "Reports you submit will appear here after server confirmation."),
              ),
            ...controller.incidents.map(
              (incident) => IncidentStatusTile(
                incident: incident,
                onTap: () => Navigator.of(context).pushNamed(
                  "/incident-detail",
                  arguments: incident.id,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FamilySafetyCircleScreen extends StatelessWidget {
  const FamilySafetyCircleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final members = [
      ("Mum", "Safe at home", Icons.home),
      ("Brother", "On the move", Icons.directions_walk),
      ("Emergency contact", "Receives SOS alerts", Icons.phone_in_talk),
    ];
    return SafetyScaffold(
      title: "Family circle",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          FilledButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.group_add),
              label: const Text("Add family member")),
          const SizedBox(height: 16),
          ...members.map((member) => ListTileCard(
                leading: Icon(member.$3),
                title: member.$1,
                subtitle: member.$2,
              )),
        ],
      ),
    );
  }
}

class SmartwatchDeviceScreen extends StatefulWidget {
  const SmartwatchDeviceScreen({super.key});

  @override
  State<SmartwatchDeviceScreen> createState() => _SmartwatchDeviceScreenState();
}

class _SmartwatchDeviceScreenState extends State<SmartwatchDeviceScreen> {
  final TheEyeApiClient apiClient = TheEyeApiClient(baseUrl: theEyeApiUrl);
  final TextEditingController deviceIdController =
      TextEditingController(text: "EYE-WATCH-SEED-001");
  final TextEditingController deviceSecretController = TextEditingController();
  final TextEditingController pairingCodeController = TextEditingController();
  bool standaloneCellular = false;
  bool criticalAlerts = true;
  bool failoverEnabled = true;
  String pairingMethod = SmartwatchPairingMethod.pairingCode;
  String emergencyMode = SmartwatchEmergencyMode.normalSos;
  int batteryLevel = 82;
  int signalStrength = 74;
  bool locationDenied = false;
  bool sending = false;
  String status = "No device activity yet";
  Position? latestPosition;
  final List<String> sosHistory = [];

  @override
  void dispose() {
    deviceIdController.dispose();
    deviceSecretController.dispose();
    pairingCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "SOS device",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Connection mode",
            child: Row(
              children: [
                Expanded(
                  child: _ModeCard(
                    title: "Paired phone",
                    subtitle: "Watch relays SOS through this phone",
                    selected: !standaloneCellular,
                    color: BrandColors.green,
                    onTap: () => setState(() => standaloneCellular = false),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ModeCard(
                    title: "Standalone",
                    subtitle: "Watch uses LTE/WiFi directly",
                    selected: standaloneCellular,
                    color: BrandColors.orange,
                    onTap: () => setState(() => standaloneCellular = true),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SmartwatchCompanionPreview(
            standalone: standaloneCellular,
            batteryLevel: batteryLevel,
            signalStrength: signalStrength,
            sosActive: emergencyMode != SmartwatchEmergencyMode.normalSos,
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Pair smartwatch",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                    controller: deviceIdController,
                    decoration: const InputDecoration(labelText: "Device ID")),
                const SizedBox(height: 12),
                TextField(
                    controller: pairingCodeController,
                    decoration: const InputDecoration(
                        labelText: "Pairing code from watch")),
                const SizedBox(height: 12),
                TextField(
                    controller: deviceSecretController,
                    decoration: const InputDecoration(
                        labelText: "Device secret for standalone mode")),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: standaloneCellular,
                  onChanged: (value) =>
                      setState(() => standaloneCellular = value),
                  title: const Text("Standalone cellular mode"),
                  subtitle: const Text(
                      "Use when the watch sends SOS without the paired phone"),
                ),
                DropdownButtonFormField<String>(
                  value: pairingMethod,
                  decoration:
                      const InputDecoration(labelText: "Pairing method"),
                  items: const [
                    DropdownMenuItem(
                        value: SmartwatchPairingMethod.qrCode,
                        child: Text("QR Code")),
                    DropdownMenuItem(
                        value: SmartwatchPairingMethod.bluetooth,
                        child: Text("Bluetooth")),
                    DropdownMenuItem(
                        value: SmartwatchPairingMethod.pairingCode,
                        child: Text("Pairing Code")),
                    DropdownMenuItem(
                        value: SmartwatchPairingMethod.nfc,
                        child: Text("NFC future")),
                  ],
                  onChanged: (value) => setState(() => pairingMethod =
                      value ?? SmartwatchPairingMethod.pairingCode),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: criticalAlerts,
                  onChanged: (value) => setState(() => criticalAlerts = value),
                  title: const Text("Receive critical alerts on watch"),
                ),
                SwitchListTile(
                  value: failoverEnabled,
                  onChanged: (value) => setState(() => failoverEnabled = value),
                  title: const Text("Automatic standalone failover"),
                  subtitle: const Text(
                      "Use watch LTE or WiFi when phone connection is lost"),
                ),
                FilledButton.icon(
                    onPressed: sending ? null : _pairDevice,
                    icon: const Icon(Icons.watch),
                    label: const Text("Pair device")),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Device status",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ProfileRow(
                    "Mode",
                    standaloneCellular
                        ? "Standalone cellular"
                        : "Paired phone"),
                ProfileRow(
                    "Critical alerts", criticalAlerts ? "Enabled" : "Disabled"),
                ProfileRow(
                    "Failover", failoverEnabled ? "Enabled" : "Disabled"),
                ProfileRow("Battery", "$batteryLevel%"),
                ProfileRow("Signal", "$signalStrength%"),
                ProfileRow(
                    "Latest GPS",
                    latestPosition == null
                        ? "Waiting for location"
                        : "${latestPosition!.latitude.toStringAsFixed(6)}, ${latestPosition!.longitude.toStringAsFixed(6)}"),
                if (latestPosition != null)
                  TextButton.icon(
                    onPressed: () => openMaps(
                        latestPosition!.latitude, latestPosition!.longitude),
                    icon: const Icon(Icons.map),
                    label: const Text("Open GPS in maps"),
                  ),
                ProfileRow(
                    "Accuracy",
                    latestPosition == null
                        ? "-"
                        : "${latestPosition!.accuracy.toStringAsFixed(0)}m"),
                Text(status,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                if (locationDenied)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: LocationDeniedBanner(
                      message:
                          "Location is required for emergency smartwatch SOS.",
                      onOpenSettings: () => openAppSettings(),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Emergency mode",
            child: DropdownButtonFormField<String>(
              value: emergencyMode,
              decoration: const InputDecoration(labelText: "SOS workflow"),
              items: const [
                DropdownMenuItem(
                    value: SmartwatchEmergencyMode.silentSos,
                    child: Text("Silent SOS")),
                DropdownMenuItem(
                    value: SmartwatchEmergencyMode.normalSos,
                    child: Text("Normal SOS")),
                DropdownMenuItem(
                    value: SmartwatchEmergencyMode.medicalSos,
                    child: Text("Medical SOS")),
                DropdownMenuItem(
                    value: SmartwatchEmergencyMode.kidnappingSos,
                    child: Text("Kidnapping SOS")),
                DropdownMenuItem(
                    value: SmartwatchEmergencyMode.fireSos,
                    child: Text("Fire SOS")),
                DropdownMenuItem(
                    value: SmartwatchEmergencyMode.childSos,
                    child: Text("Child SOS")),
                DropdownMenuItem(
                    value: SmartwatchEmergencyMode.womenSafetySos,
                    child: Text("Women Safety SOS")),
              ],
              onChanged: (value) => setState(() =>
                  emergencyMode = value ?? SmartwatchEmergencyMode.normalSos),
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "SOS event history",
            child: sosHistory.isEmpty
                ? const Text(
                    "No SOS events yet. Trigger SOS to populate history.")
                : Column(
                    children: sosHistory
                        .map((entry) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(entry,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700))))
                        .toList()),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            style: FilledButton.styleFrom(
                backgroundColor: Colors.red.shade700,
                foregroundColor: Colors.white),
            onPressed: sending ? null : _triggerSos,
            icon: const Icon(Icons.sos),
            label: const Text("Trigger watch SOS"),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
              onPressed: sending ? null : _sendGpsUpdate,
              icon: const Icon(Icons.my_location),
              label: const Text("Send GPS update")),
          const SizedBox(height: 12),
          OutlinedButton.icon(
              onPressed: sending ? null : _sendHeartbeat,
              icon: const Icon(Icons.favorite),
              label: const Text("Send heartbeat")),
          const SizedBox(height: 12),
          OutlinedButton.icon(
              onPressed: sending ? null : _syncOfflineEvents,
              icon: const Icon(Icons.cloud_upload),
              label: const Text("Sync offline watch events")),
        ],
      ),
    );
  }

  Future<void> _pairDevice() async {
    await _sendRequest(
      () => apiClient.registerSmartwatch(
        TheEyePayloads.registerSmartwatchDevice(
          deviceId: deviceIdController.text.trim(),
          provider: "THE EYE Mobile Pairing",
          displayName: "My SOS Watch",
          standaloneCellular: standaloneCellular,
          pairingMethod: pairingMethod,
          failoverEnabled: failoverEnabled,
          criticalAlertsEnabled: criticalAlerts,
          pairingCode: pairingCodeController.text.trim(),
          firebaseEnv: AppFlavorConfig.firebaseEnvName,
        ),
      ),
      "Device paired — watch will receive credentials shortly",
    );
  }

  Future<void> _sendGpsUpdate() async {
    final position = await _captureLocation();
    if (position == null) {
      setState(() => locationDenied = true);
      return;
    }
    setState(() => latestPosition = position);
    await _sendRequest(
      () => apiClient.postSmartwatchGps(
        deviceId: deviceIdController.text.trim(),
        payload: TheEyePayloads.smartwatchGps(
          position: position,
          deviceId: deviceIdController.text.trim(),
          deviceSecret: deviceSecretController.text.trim(),
          standaloneCellular: standaloneCellular,
          batteryLevel: batteryLevel,
          signalStrength: signalStrength,
        ),
      ),
      "GPS update sent",
    );
  }

  Future<void> _triggerSos() async {
    final position = await _captureLocation();
    if (position == null) {
      setState(() => locationDenied = true);
      return;
    }
    setState(() {
      latestPosition = position;
      sosHistory.insert(0,
          "${formatEvidenceTimestamp(DateTime.now())} — $emergencyMode (${standaloneCellular ? "Standalone" : "Paired"})");
    });
    await _sendRequest(
      () => apiClient.postSmartwatchSos(
        TheEyePayloads.smartwatchSos(
          position: position,
          deviceId: deviceIdController.text.trim(),
          deviceSecret: deviceSecretController.text.trim(),
          standaloneCellular: standaloneCellular,
          batteryLevel: batteryLevel,
          signalStrength: signalStrength,
          emergencyMode: emergencyMode,
        ),
      ),
      "SOS sent. Family safety circle will be alerted.",
    );
  }

  Future<void> _sendHeartbeat() async {
    await _sendRequest(
      () => apiClient.postSmartwatchHeartbeat(
        deviceId: deviceIdController.text.trim(),
        payload: TheEyePayloads.smartwatchHeartbeat(
          deviceId: deviceIdController.text.trim(),
          deviceSecret: deviceSecretController.text.trim(),
          standaloneCellular: standaloneCellular,
          batteryLevel: batteryLevel,
          signalStrength: signalStrength,
        ),
      ),
      "Heartbeat sent",
    );
  }

  Future<void> _syncOfflineEvents() async {
    await _sendRequest(
      () => apiClient.postSmartwatchOfflineSync(
        deviceId: deviceIdController.text.trim(),
        payload: TheEyePayloads.smartwatchOfflineSync(
          deviceId: deviceIdController.text.trim(),
          deviceSecret: deviceSecretController.text.trim(),
          events: [
            {
              "eventType": SmartwatchOfflineEventType.heartbeat,
              "occurredAt": DateTime.now()
                  .subtract(const Duration(minutes: 2))
                  .toIso8601String(),
              "payload": {
                "batteryLevel": batteryLevel,
                "signalStrength": signalStrength,
                "offline": true
              },
            },
          ],
        ),
      ),
      "Offline watch events uploaded",
    );
  }

  Future<Position?> _captureLocation() async {
    final outcome =
        await captureLocationOutcome(accuracy: LocationAccuracy.high);
    return outcome.position;
  }

  Future<void> _sendRequest(
      Future<void> Function() request, String successMessage) async {
    setState(() {
      sending = true;
      status = "Sending request...";
    });
    try {
      await request();
      if (!mounted) return;
      setState(() {
        locationDenied = false;
        status = successMessage;
      });
      showAppSnackBar(context, successMessage);
    } catch (_) {
      if (!mounted) return;
      setState(() =>
          status = "Unable to reach THE EYE API. Request can be retried.");
      showAppSnackBar(
          context, "Unable to reach THE EYE API. Tap again to retry.",
          isError: true);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }
}

class NeighborhoodWatchHomeScreen extends StatelessWidget {
  const NeighborhoodWatchHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Neighborhood Watch",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Allen Avenue Estate",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text("Private estate community - approved resident"),
                const SizedBox(height: 12),
                FilledButton.icon(
                    onPressed: () => Navigator.of(context)
                        .pushNamed("/neighborhood-watch/create"),
                    icon: const Icon(Icons.add_alert),
                    label: const Text("Post safety update")),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            children: [
              ActionTile(
                  "My Communities",
                  Icons.home_work,
                  Colors.teal.shade700,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/communities")),
              ActionTile(
                  "Join Community",
                  Icons.group_add,
                  Colors.green.shade700,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/join")),
              ActionTile(
                  "Community Feed",
                  Icons.dynamic_feed,
                  Colors.blue.shade700,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/feed")),
              ActionTile(
                  "Community Map",
                  Icons.map,
                  Colors.indigo.shade700,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/map")),
              ActionTile(
                  "Community Chat",
                  Icons.chat,
                  Colors.purple.shade700,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/chat")),
              ActionTile(
                  "Volunteers",
                  Icons.volunteer_activism,
                  Colors.red.shade700,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/volunteers")),
              ActionTile(
                  "Patrols",
                  Icons.security,
                  Colors.orange.shade800,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/patrols")),
              ActionTile(
                  "Alerts",
                  Icons.campaign,
                  Colors.cyan.shade800,
                  () => Navigator.of(context)
                      .pushNamed("/neighborhood-watch/alerts")),
            ],
          ),
        ],
      ),
    );
  }
}

class MyCommunitiesScreen extends StatelessWidget {
  const MyCommunitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [
      "Allen Avenue Estate - Private - Moderator approved",
      "Opebi Street Watch - Public - Resident",
      "Ikeja Business Owners - Pending approval"
    ];
    return SafetyScaffold(
      title: "My Communities",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: items
            .map((item) => ListTileCard(
                leading: const Icon(Icons.groups),
                title: item.split(" - ").first,
                subtitle: item.substring(item.indexOf(" - ") + 3)))
            .toList(),
      ),
    );
  }
}

class JoinCommunityScreen extends StatelessWidget {
  const JoinCommunityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Join Community",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          const TextField(
              decoration: InputDecoration(
                  labelText: "Search country, state, LGA, estate, or street")),
          const SizedBox(height: 16),
          ListTileCard(
              leading: const Icon(Icons.lock),
              title: "Allen Avenue Estate",
              subtitle: "Private estate - request approval",
              trailing:
                  FilledButton(onPressed: () {}, child: const Text("Request"))),
          ListTileCard(
              leading: const Icon(Icons.public),
              title: "Opebi Street Watch",
              subtitle: "Public street community",
              trailing:
                  FilledButton(onPressed: () {}, child: const Text("Join"))),
        ],
      ),
    );
  }
}

class CommunityFeedScreen extends StatelessWidget {
  const CommunityFeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final posts = [
      (
        "Suspicious activity",
        "Two unknown riders circling Gate 2",
        "Pending Verification - 64%"
      ),
      ("Security meeting", "Night patrol briefing by 8 PM", "Verified - 91%"),
      ("Missing person", "Lost child near terminal", "Disputed - 48%"),
    ];
    return SafetyScaffold(
      title: "Community Feed",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          FilledButton.icon(
              onPressed: () =>
                  Navigator.of(context).pushNamed("/neighborhood-watch/create"),
              icon: const Icon(Icons.edit),
              label: const Text("Create community post")),
          const SizedBox(height: 16),
          ...posts.map((post) => ListTileCard(
              leading: const Icon(Icons.report),
              title: "${post.$1}: ${post.$2}",
              subtitle: post.$3)),
        ],
      ),
    );
  }
}

class CreateCommunityPostScreen extends StatelessWidget {
  const CreateCommunityPostScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final types = [
      "Suspicious activity",
      "Lost child",
      "Missing person",
      "Crime alert",
      "Accident alert",
      "Fire alert",
      "Flood warning",
      "Community announcement",
      "Security meeting",
      "Patrol update"
    ];
    return SafetyScaffold(
      title: "Create Post",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          DropdownButtonFormField<String>(
              items: types
                  .map((type) =>
                      DropdownMenuItem(value: type, child: Text(type)))
                  .toList(),
              onChanged: (_) {},
              decoration: const InputDecoration(labelText: "Post type")),
          const SizedBox(height: 12),
          const TextField(decoration: InputDecoration(labelText: "Title")),
          const SizedBox(height: 12),
          const TextField(
              maxLines: 4, decoration: InputDecoration(labelText: "Details")),
          const SizedBox(height: 12),
          ManagedEvidenceSection(lowDataMode: appOf(context).lowDataMode),
          const SizedBox(height: 12),
          FilledButton(
              onPressed: () =>
                  Navigator.of(context).pushNamed("/neighborhood-watch/feed"),
              child: const Text("Post to community")),
        ],
      ),
    );
  }
}

class CommunityMapScreen extends StatelessWidget {
  const CommunityMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Community Map",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Container(
              height: 360,
              decoration: BoxDecoration(
                  color: BrandColors.lightSurfaceMuted,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: BrandColors.lightBorder)),
              child: const Center(
                  child: Icon(Icons.map, size: 80, color: BrandColors.green))),
          const SizedBox(height: 16),
          const SectionCard(
              title: "Visible layers",
              child: Text(
                  "Community posts, incidents, safe points, police stations, hospitals, patrol points, and danger zones.")),
        ],
      ),
    );
  }
}

class CommunityChatScreen extends StatelessWidget {
  const CommunityChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final channels = [
      "General",
      "Emergency",
      "Security",
      "Volunteers",
      "Women Safety",
      "Parents",
      "Business Owners"
    ];
    return SafetyScaffold(
      title: "Community Chat",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: channels
            .map((channel) => ListTileCard(
                leading: const Icon(Icons.forum),
                title: channel,
                subtitle: "Realtime channel"))
            .toList(),
      ),
    );
  }
}

class VolunteersScreen extends StatelessWidget {
  const VolunteersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final types = [
      "Doctor",
      "Nurse",
      "First Aid",
      "Lawyer",
      "Security Volunteer",
      "Fire Volunteer",
      "Search and Rescue",
      "Blood Donor"
    ];
    return SafetyScaffold(
      title: "Volunteers",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          FilledButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.volunteer_activism),
              label: const Text("Register as volunteer")),
          const SizedBox(height: 16),
          ...types.map((type) => ListTileCard(
              leading: const Icon(Icons.health_and_safety),
              title: type,
              subtitle: "Notify nearby volunteers during emergencies")),
        ],
      ),
    );
  }
}

class PatrolsScreen extends StatelessWidget {
  const PatrolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Patrols",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          ListTileCard(
              leading: const Icon(Icons.route),
              title: "Gate 2 evening patrol",
              subtitle: "Scheduled - 4 volunteers - 6 checkpoints"),
          ListTileCard(
              leading: const Icon(Icons.security),
              title: "Opebi corridor patrol",
              subtitle: "Active - 6 volunteers - 11 checkpoints"),
          FilledButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.add_location_alt),
              label: const Text("Log patrol checkpoint")),
        ],
      ),
    );
  }
}

class CommunityAlertsScreen extends StatelessWidget {
  const CommunityAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final alerts = [
      "Nearby suspicious activity",
      "Community emergency alert",
      "Missing child nearby",
      "Security meeting reminder",
      "Patrol request",
      "Volunteer request"
    ];
    return SafetyScaffold(
      title: "Community Alerts",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: alerts
            .map((alert) => ListTileCard(
                leading: const Icon(Icons.campaign),
                title: alert,
                subtitle: "Location-based community notification"))
            .toList(),
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafetyScaffold(
      title: "Profile",
      selectedIndex: 4,
      useFigmaShell: true,
      body: ProfileScreenBody(),
    );
  }
}

class YourCarScreen extends StatefulWidget {
  const YourCarScreen({super.key});

  @override
  State<YourCarScreen> createState() => _YourCarScreenState();
}

class _YourCarScreenState extends State<YourCarScreen> {
  final makeController = TextEditingController();
  final modelController = TextEditingController();
  final yearController = TextEditingController();
  final colorController = TextEditingController();
  final plateController = TextEditingController();
  final vinController = TextEditingController();
  final notesController = TextEditingController();
  String? imagePath;
  bool saving = false;
  bool initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (initialized) return;
    initialized = true;
    final profile = appOf(context).carProfile;
    if (profile != null) {
      makeController.text = profile.make;
      modelController.text = profile.model;
      yearController.text = profile.year?.toString() ?? "";
      colorController.text = profile.color ?? "";
      plateController.text = profile.plateNumber;
      vinController.text = profile.vin ?? "";
      notesController.text = profile.notes ?? "";
      imagePath = profile.imagePath;
    }
  }

  @override
  void dispose() {
    makeController.dispose();
    modelController.dispose();
    yearController.dispose();
    colorController.dispose();
    plateController.dispose();
    vinController.dispose();
    notesController.dispose();
    super.dispose();
  }

  Future<String?> _persistCarImage(XFile picked) async {
    final documentsDir = await getApplicationDocumentsDirectory();
    final carDir = Directory(p.join(documentsDir.path, "car_profile"));
    if (!await carDir.exists()) {
      await carDir.create(recursive: true);
    }
    final extension =
        p.extension(picked.path).isEmpty ? ".jpg" : p.extension(picked.path);
    final destination = p.join(carDir.path, "car_photo$extension");
    await File(picked.path).copy(destination);
    return destination;
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: source,
      maxWidth: 1920,
      imageQuality: 85,
    );
    if (!mounted || picked == null) return;
    try {
      final savedPath = await _persistCarImage(picked);
      if (!mounted) return;
      setState(() => imagePath = savedPath);
    } catch (error) {
      if (!mounted) return;
      showAppSnackBar(context, "Unable to save car photo.", isError: true);
    }
  }

  Future<void> _save() async {
    if (makeController.text.trim().isEmpty ||
        modelController.text.trim().isEmpty ||
        plateController.text.trim().isEmpty) {
      showAppSnackBar(context, "Make, model, and plate number are required.",
          isError: true);
      return;
    }

    final yearText = yearController.text.trim();
    int? year;
    if (yearText.isNotEmpty) {
      year = int.tryParse(yearText);
      if (year == null) {
        showAppSnackBar(context, "Enter a valid year or leave it blank.",
            isError: true);
        return;
      }
    }

    setState(() => saving = true);
    final profile = CarProfile(
      make: makeController.text.trim(),
      model: modelController.text.trim(),
      plateNumber: plateController.text.trim(),
      year: year,
      color: colorController.text.trim().isEmpty
          ? null
          : colorController.text.trim(),
      vin: vinController.text.trim().isEmpty ? null : vinController.text.trim(),
      notes: notesController.text.trim().isEmpty
          ? null
          : notesController.text.trim(),
      imagePath: imagePath,
    );

    await appOf(context).saveCarProfile(profile);
    if (!mounted) return;
    setState(() => saving = false);
    showAppSnackBar(context, "Your car details were saved.");
    Navigator.of(context).pop();
  }

  Future<void> _removeCar() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Remove saved car?"),
        content: const Text(
            "This clears your saved vehicle details from this device."),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text("Cancel")),
          FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text("Remove")),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await appOf(context).clearCarProfile();
    if (!mounted) return;
    showAppSnackBar(context, "Saved car removed.");
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final hasSavedCar = appOf(context).carProfile != null;
    return SafetyScaffold(
      title: hasSavedCar ? "Your car" : "Add your car",
      useFigmaShell: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Vehicle details",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (imagePath != null && File(imagePath!).existsSync())
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.file(
                      File(imagePath!),
                      height: 180,
                      fit: BoxFit.cover,
                    ),
                  )
                else
                  Container(
                    height: 180,
                    decoration: BoxDecoration(
                      color: context.eyeSurfaceMuted,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: context.eyeBorder),
                    ),
                    child: Icon(Icons.directions_car,
                        size: 64, color: context.eyeMutedText),
                  ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickImage(ImageSource.camera),
                        icon: const Icon(Icons.photo_camera_outlined),
                        label: const Text("Take photo"),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickImage(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library_outlined),
                        label: const Text("Gallery"),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: makeController,
                  decoration: const InputDecoration(labelText: "Make"),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: modelController,
                  decoration: const InputDecoration(labelText: "Model"),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: yearController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: "Year"),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: colorController,
                  decoration: const InputDecoration(labelText: "Color"),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: plateController,
                  decoration: const InputDecoration(labelText: "Plate number"),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: vinController,
                  decoration:
                      const InputDecoration(labelText: "VIN (optional)"),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: "Notes"),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: saving ? null : _save,
                  child: saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(hasSavedCar ? "Save changes" : "Save your car"),
                ),
                if (hasSavedCar) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: saving ? null : _removeCar,
                    child: const Text("Remove saved car"),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _confirmAccountDeletion(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text("Delete account?"),
      content: const Text(
        "This deactivates your account and signs you out. Incident evidence and audit records may be retained where legally required. Continue?",
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text("Cancel"),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text("Deactivate account"),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  final controller = appOf(context);
  final token = controller.accessToken;
  if (token == null) return;

  try {
    final client = TheEyeApiClient(baseUrl: theEyeApiUrl);
    await client.requestAccountDeletion(accessToken: token);
    await controller.clearSession();
    if (!context.mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil("/login", (_) => false);
    showAppSnackBar(context, "Account deactivated.");
  } on AuthApiException catch (error) {
    if (!context.mounted) return;
    showAppSnackBar(context, error.userMessage, isError: true);
  } catch (_) {
    if (!context.mounted) return;
    showAppSnackBar(context, "Unable to process deletion request.",
        isError: true);
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final authenticated = controller.isAuthenticated;
    return SafetyScaffold(
      title: "Settings",
      selectedIndex: 4,
      useFigmaShell: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Account",
            child: Column(
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.person_outline,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  title: const Text("Profile"),
                  subtitle: Text(
                    authenticated
                        ? "View your citizen profile and KYC status"
                        : "Sign in to view your profile",
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).pushNamed("/profile"),
                ),
                if (authenticated) ...[
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.logout,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    title: const Text("Sign out"),
                    onTap: () async {
                      await controller.clearSession();
                      if (!context.mounted) return;
                      Navigator.of(context)
                          .pushNamedAndRemoveUntil("/login", (_) => false);
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.delete_outline,
                      color: Theme.of(context).colorScheme.error,
                    ),
                    title: const Text("Request account deletion"),
                    subtitle: const Text(
                      "Deactivates your account. Full erasure follows legal retention rules.",
                    ),
                    onTap: () => _confirmAccountDeletion(context),
                  ),
                ] else
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.login,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    title: const Text("Sign in"),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).pushNamed("/login"),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Your car",
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                Icons.directions_car,
                color: Theme.of(context).colorScheme.primary,
              ),
              title: Text(
                controller.carProfile == null ? "Add your car" : "Your car",
              ),
              subtitle: Text(
                controller.carProfile == null
                    ? "Save vehicle details for faster stolen car reports"
                    : controller.carProfile!.displayLabel,
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).pushNamed("/your-car"),
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Appearance",
            child: Column(
              children: [
                RadioListTile<ThemePreference>(
                  value: ThemePreference.dark,
                  groupValue: controller.themePreference,
                  onChanged: (value) {
                    if (value != null) {
                      unawaited(controller.setThemePreference(value));
                    }
                  },
                  title: const Text("Dark (default)"),
                ),
                RadioListTile<ThemePreference>(
                  value: ThemePreference.light,
                  groupValue: controller.themePreference,
                  onChanged: (value) {
                    if (value != null) {
                      unawaited(controller.setThemePreference(value));
                    }
                  },
                  title: const Text("Light"),
                ),
                RadioListTile<ThemePreference>(
                  value: ThemePreference.system,
                  groupValue: controller.themePreference,
                  onChanged: (value) {
                    if (value != null) {
                      unawaited(controller.setThemePreference(value));
                    }
                  },
                  title: const Text("System"),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Safety and data",
            child: Column(
              children: [
                SwitchListTile(
                  value: controller.highContrastMode,
                  onChanged: controller.toggleHighContrast,
                  title: const Text("High contrast mode"),
                  subtitle: const Text(
                      "Improves readability in bright or stressful conditions"),
                ),
                SwitchListTile(
                  value: controller.lowDataMode,
                  onChanged: controller.toggleLowData,
                  title: const Text("Low-data mode"),
                  subtitle:
                      const Text("Reduces media upload size before sending"),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    controller.online
                        ? Icons.cloud_done
                        : controller.connectivityState ==
                                ConnectivityState.reconnecting
                            ? Icons.cloud_sync
                            : Icons.cloud_off,
                    color: controller.online
                        ? BrandColors.green
                        : BrandColors.orange,
                  ),
                  title: const Text("Internet connection"),
                  subtitle: Text(controller.connectivityState.statusLabel),
                  trailing: Text(
                    controller.online ? "Online" : "Auto-detected",
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: controller.online
                          ? BrandColors.green
                          : BrandColors.orange,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Connected safety devices",
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pushNamed("/smartwatch"),
              icon: const Icon(Icons.watch),
              label: const Text("Manage SOS smartwatch"),
            ),
          ),
        ],
      ),
    );
  }
}

class SafetyScaffold extends StatelessWidget {
  const SafetyScaffold({
    required this.title,
    required this.body,
    this.selectedIndex = 0,
    this.useFigmaShell = false,
    super.key,
  });

  final String title;
  final Widget body;
  final int selectedIndex;
  final bool useFigmaShell;

  void _navigateTab(BuildContext context, int tabIndex) {
    final route = switch (tabIndex) {
      0 => EyeNavRoutes.home,
      1 => EyeNavRoutes.services,
      3 => EyeNavRoutes.broadcast,
      4 => EyeNavRoutes.settings,
      _ => null,
    };
    if (route == null) return;
    if (ModalRoute.of(context)?.settings.name != route) {
      Navigator.of(context).pushReplacementNamed(route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final routeName = ModalRoute.of(context)?.settings.name;
    final navIndex = useFigmaShell
        ? selectedIndex
        : EyeNavRoutes.selectedIndexForRoute(routeName);

    return Scaffold(
      backgroundColor: useFigmaShell
          ? (context.isDarkTheme
              ? Theme.of(context).scaffoldBackgroundColor
              : EyeTokens.whiteBg)
          : null,
      appBar: useFigmaShell
          ? null
          : AppBar(
              leading: Navigator.of(context).canPop()
                  ? IconButton(
                      tooltip: "Back",
                      icon: const Icon(Icons.arrow_back),
                      onPressed: () => Navigator.of(context).maybePop(),
                    )
                  : null,
              title: Text(title),
              actions: [
                IconButton(
                  tooltip: "Settings",
                  icon: const Icon(Icons.settings),
                  onPressed: () => Navigator.of(context).pushNamed("/settings"),
                ),
              ],
            ),
      body: body,
      bottomNavigationBar: useFigmaShell
          ? EyeBottomNav(
              selectedIndex: navIndex,
              onTabSelected: (index) {
                if (index != 2) _navigateTab(context, index);
              },
              onEyePressed: () => _openSos(context),
            )
          : NavigationBar(
              selectedIndex: selectedIndex.clamp(0, 4),
              onDestinationSelected: (index) {
                final routes = [
                  "/home",
                  "/police-stations",
                  "/tracking",
                  "/family",
                  "/profile"
                ];
                final route = routes[index];
                if (ModalRoute.of(context)?.settings.name != route) {
                  Navigator.of(context).pushReplacementNamed(route);
                }
              },
              destinations: const [
                NavigationDestination(icon: Icon(Icons.home), label: "Home"),
                NavigationDestination(
                    icon: Icon(Icons.local_police), label: "Police"),
                NavigationDestination(
                    icon: Icon(Icons.route), label: "Tracking"),
                NavigationDestination(
                    icon: Icon(Icons.family_restroom), label: "Family"),
                NavigationDestination(
                    icon: Icon(Icons.person), label: "Profile"),
              ],
            ),
    );
  }
}

void _openSos(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => _SosBottomSheet(parentContext: context),
  );
}

class _SosBottomSheet extends StatefulWidget {
  const _SosBottomSheet({required this.parentContext});

  final BuildContext parentContext;

  @override
  State<_SosBottomSheet> createState() => _SosBottomSheetState();
}

class _SosBottomSheetState extends State<_SosBottomSheet> {
  bool sendingAlert = false;

  Future<void> _sendSosAlert() async {
    if (sendingAlert) return;
    setState(() => sendingAlert = true);

    final parentContext = widget.parentContext;
    final controller = appOf(parentContext);

    // Close the sheet before location permission / GPS so Android can show
    // system dialogs above the app (modal sheets block them otherwise).
    Navigator.of(context).pop();
    showAppSnackBar(parentContext, "Sending SOS alert...");

    try {
      final outcome = await captureLocationOutcome().timeout(
        kSosSubmissionTimeout,
        onTimeout: () =>
            const LocationCaptureOutcome(result: LocationCaptureResult.timeout),
      );
      if (!parentContext.mounted) return;

      if (outcome.result != LocationCaptureResult.granted ||
          outcome.position == null) {
        final message = locationFailureMessage(outcome.result);
        showAppSnackBar(parentContext, message, isError: true);
        return;
      }

      final draft = buildIncidentDraft(
        type: IncidentType.sos,
        description: "SOS emergency triggered from mobile app.",
        position: outcome.position!,
        notifyEmergencyContacts: true,
        title: "SOS emergency",
      );

      final result =
          await controller.submitIncident(draft).timeout(kSosSubmissionTimeout);
      if (!parentContext.mounted) return;

      if (result.status == IncidentSubmissionStatus.duplicateInFlight) {
        showAppSnackBar(
            parentContext, result.userMessage ?? "SOS is already sending.",
            isError: true);
        return;
      }

      if (result.isSuccess || result.isQueued || result.canRetry) {
        showAppSnackBar(parentContext,
            result.userMessage ?? "SOS sent with your GPS location.");
        Navigator.of(parentContext).pushNamed("/tracking");
        return;
      }

      showAppSnackBar(
          parentContext, result.userMessage ?? "Unable to send SOS.",
          isError: true);
    } on TimeoutException {
      if (parentContext.mounted) {
        showAppSnackBar(parentContext,
            "SOS timed out. Check your connection and try again.",
            isError: true);
      }
    } catch (_) {
      if (parentContext.mounted) {
        showAppSnackBar(parentContext,
            "Unable to send SOS. Check your connection and try again.",
            isError: true);
      }
    }
  }

  void _startSosLiveVideo() {
    Navigator.of(context).pop();
    if (!widget.parentContext.mounted) return;
    Navigator.of(widget.parentContext).pushNamed(
      "/live-video",
      arguments: const LiveVideoRouteArgs(autoStartStream: true),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 8, 20, 20 + MediaQuery.viewPaddingOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: const Text("Send SOS alert?",
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          ),
          const SizedBox(height: 8),
          const Text(
              "Choose a fast GPS alert or start live emergency video for responders."),
          const SizedBox(height: 20),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              minimumSize: const Size.fromHeight(EyeTokens.sosButtonHeight),
            ),
            onPressed: sendingAlert ? null : () => unawaited(_sendSosAlert()),
            icon: sendingAlert
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.flash_on),
            label: Text(sendingAlert ? "Sending SOS..." : "Send SOS now"),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: Colors.black,
              minimumSize: const Size.fromHeight(EyeTokens.sosButtonHeight),
            ),
            onPressed: sendingAlert ? null : _startSosLiveVideo,
            icon: const Icon(Icons.videocam),
            label: const Text("Start SOS live video"),
          ),
          const SizedBox(height: 6),
          const Text(
            "Live video opens the emergency stream screen. GPS and contact alerts are sent when streaming starts.",
            style: TextStyle(fontSize: 12, color: BrandColors.lightTextMuted),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
              onPressed:
                  sendingAlert ? null : () => Navigator.of(context).pop(),
              child: const Text("Cancel")),
        ],
      ),
    );
  }
}

class OfflineStatusBanner extends StatelessWidget {
  const OfflineStatusBanner({required this.state, super.key});

  final ConnectivityState state;

  @override
  Widget build(BuildContext context) {
    final icon = switch (state) {
      ConnectivityState.reconnecting => Icons.cloud_sync,
      ConnectivityState.limited => Icons.cloud_queue,
      ConnectivityState.offline => Icons.cloud_off,
      ConnectivityState.online => Icons.cloud_done,
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.eyeWarningSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BrandColors.orange.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Icon(icon, color: BrandColors.orange),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              state.bannerMessage,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class LocationDeniedBanner extends StatelessWidget {
  const LocationDeniedBanner(
      {required this.message, this.onOpenSettings, super.key});

  final String message;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.eyeDangerSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.location_off, color: Colors.red.shade700),
              const SizedBox(width: 12),
              Expanded(
                  child: Text(message,
                      style: const TextStyle(fontWeight: FontWeight.w700))),
            ],
          ),
          if (onOpenSettings != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onOpenSettings,
              icon: const Icon(Icons.settings),
              label: const Text("Open location settings"),
            ),
          ],
        ],
      ),
    );
  }
}

class StatusStrip extends StatelessWidget {
  const StatusStrip({required this.controller, super.key});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        StatusPill(
          icon: controller.online
              ? Icons.cloud_done
              : controller.connectivityState == ConnectivityState.reconnecting
                  ? Icons.cloud_sync
                  : Icons.cloud_off,
          label: controller.connectivityState == ConnectivityState.online
              ? "Online"
              : controller.connectivityState == ConnectivityState.reconnecting
                  ? "Reconnecting"
                  : controller.connectivityState == ConnectivityState.limited
                      ? "Limited connectivity"
                      : "Offline drafts active",
        ),
        if (controller.lowDataMode)
          const StatusPill(icon: Icons.data_saver_on, label: "Low-data"),
        if (controller.highContrastMode)
          const StatusPill(icon: Icons.contrast, label: "High contrast"),
      ],
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({required this.icon, required this.label, super.key});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BrandColors.lightBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class EmergencyHero extends StatelessWidget {
  const EmergencyHero({required this.onPressed, super.key});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: BrandColors.commandSurface,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text("Need help now?",
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          const Text("SOS sends your GPS and alerts emergency contacts.",
              style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 18),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: onPressed,
            icon: const Icon(Icons.sos),
            label: const Text("Send SOS"),
          ),
        ],
      ),
    );
  }
}

class ActionTile extends StatelessWidget {
  const ActionTile(this.label, this.icon, this.color, this.onTap, {super.key});

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: Semantics(
        button: true,
        label: label,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 88),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                border: Border.all(color: BrandColors.lightBorder),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Icon(icon, color: color, size: 34),
                  Text(label,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ListTileCard extends StatelessWidget {
  const ListTileCard(
      {required this.leading,
      required this.title,
      required this.subtitle,
      this.trailing,
      this.onTap,
      super.key});

  final Widget leading;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BrandColors.lightBorder),
      ),
      child: ListTile(
        onTap: onTap,
        minVerticalPadding: 14,
        leading: leading,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
        trailing: trailing,
      ),
    );
  }
}

class IncidentStatusTile extends StatelessWidget {
  const IncidentStatusTile({required this.incident, this.onTap, super.key});

  final IncidentTrackingItem incident;
  final VoidCallback? onTap;

  Color _verificationColor(String status) {
    switch (status) {
      case "Verified":
        return BrandColors.green;
      case "Disputed":
        return BrandColors.orange;
      case "False Information":
        return Colors.red.shade700;
      default:
        return BrandColors.lightTextMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListTileCard(
      onTap: onTap,
      leading: const Icon(Icons.radar),
      title: "${incident.id} - ${incident.type}",
      subtitle:
          "${incident.status} - ${incident.agency} - ${incident.confidence}% confidence\nVerification: ${incident.verificationStatus}",
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: _verificationColor(incident.verificationStatus)
              .withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(incident.verificationStatus,
            style: TextStyle(
                color: _verificationColor(incident.verificationStatus),
                fontWeight: FontWeight.w800,
                fontSize: 11)),
      ),
    );
  }
}

class BroadcastAlertTile extends StatelessWidget {
  const BroadcastAlertTile({required this.alert, this.onTap, super.key});

  final InboxNotificationItem alert;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final showCategory = alert.type.toLowerCase().contains("health") ||
        alert.type.toLowerCase().contains("broadcast") ||
        alert.type.toLowerCase().contains("official");
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: EyeNotificationCard(
        category: showCategory ? alert.type : null,
        title: alert.title,
        timestamp: formatNotificationAge(alert.receivedAt),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard(
      {required this.title,
      required this.subtitle,
      required this.selected,
      required this.color,
      required this.onTap});

  final String title;
  final String subtitle;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: selected ? color : BrandColors.lightBorder,
              width: selected ? 2 : 1),
          color: selected ? color.withValues(alpha: 0.08) : Colors.white,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: selected ? color : BrandColors.command)),
            const SizedBox(height: 4),
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 12, color: BrandColors.lightTextMuted)),
          ],
        ),
      ),
    );
  }
}

class SmartwatchCompanionPreview extends StatelessWidget {
  const SmartwatchCompanionPreview(
      {required this.standalone,
      required this.batteryLevel,
      required this.signalStrength,
      required this.sosActive,
      super.key});

  final bool standalone;
  final int batteryLevel;
  final int signalStrength;
  final bool sosActive;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: "Watch companion preview",
      child: Center(
        child: Container(
          width: 184,
          height: 224,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: BrandColors.commandSurface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
                color: sosActive ? Colors.red : BrandColors.green, width: 2),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Icon(
                      standalone
                          ? Icons.signal_cellular_alt
                          : Icons.bluetooth_connected,
                      color: Colors.white,
                      size: 16),
                  Text(standalone ? "LTE" : "Phone",
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 10)),
                ],
              ),
              Column(
                children: [
                  Icon(sosActive ? Icons.sos : Icons.watch,
                      color: sosActive ? Colors.red : BrandColors.green,
                      size: 36),
                  const SizedBox(height: 6),
                  Text(
                      sosActive
                          ? "SOS sent"
                          : standalone
                              ? "Standalone"
                              : "Paired",
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 12)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("Bat $batteryLevel%",
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 10)),
                  Text("Sig $signalStrength%",
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 10)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ProfileRow extends StatelessWidget {
  const ProfileRow(this.label, this.value, {super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(color: BrandColors.lightTextMuted))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
