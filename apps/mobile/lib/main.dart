import "dart:async";
import "dart:io" show Directory, File, Platform;

import "package:firebase_core/firebase_core.dart";
import "package:firebase_messaging/firebase_messaging.dart";
import "package:flutter/foundation.dart" show kDebugMode, kIsWeb;
import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:google_fonts/google_fonts.dart";
import "package:image_picker/image_picker.dart";
import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";
import "package:share_plus/share_plus.dart";
import "package:the_eye_flutter_l10n/the_eye_locales.dart";
import "package:url_launcher/url_launcher.dart";
import "package:uuid/uuid.dart";

import "auth/auth_service.dart";
import "auth/account_recovery_flow.dart";
import "auth/biometric_auth_service.dart";
import "auth/biometric_preference_store.dart";
import "auth/auth_persistence_preference_store.dart";
import "auth/auth_session_store.dart";
import "auth/auth_validation.dart";
import "auth/social_auth_service.dart";
import "contracts/report_type.dart";
import "contracts/the_eye_api_client.dart";
import "contracts/the_eye_api_paths.dart";
import "contracts/the_eye_enums.dart";
import "contracts/the_eye_payloads.dart";
import "voice/voice_report_validation.dart";
import "voice/voice_recorder.dart";
import "neighborhood_watch/community_conversation_eligibility.dart";
import "neighborhood_watch/community_post_route_args.dart";
import "evidence/evidence_attachment_picker.dart";
import "evidence/evidence_capture_controller.dart";
import "evidence/local_evidence_attachment.dart";
import "evidence/evidence_capture_service.dart";
import "evidence/evidence_policy.dart";
import "evidence/evidence_upload_service.dart";
import "evidence/evidence_validation.dart";
import "connectivity/connectivity_service.dart";
import "connectivity/connectivity_state.dart";
import "connectivity/network_interface_reader.dart";
import "connectivity/pending_retry_coordinator.dart";
import "incidents/compose_draft_store.dart";
import "incidents/incident_detail_screen.dart";
import "incidents/incident_draft.dart";
import "incidents/incident_draft_factory.dart";
import "incidents/incident_history_service.dart";
import "activity/activity_history_screen.dart";
import "activity/incident_archive_screen.dart";
import "activity/broadcast_archive_screen.dart";
import "activity/activity_navigation.dart";
import "incidents/incident_location_tracker.dart";
import "incidents/incident_submission_result.dart";
import "incidents/incident_submission_service.dart";
import "emergency/active_emergency_screen.dart";
import "emergency/incident_communication_screen.dart";
import "emergency/active_emergency_navigation.dart";
import "emergency/active_emergencies_selector_screen.dart";
import "emergency/live_video_startup_phase.dart";
import "emergency/active_emergency_service.dart";
import "emergency/active_emergency_store.dart";
import "incidents/pending_submission_store.dart";
import "location/location_permission_settings_section.dart";
import "location/location_permission_service.dart";
import "location/location_reverse_geocode.dart";
import "presentation/citizen_location_presentation.dart";
import "l10n/generated/app_localizations.dart";
import "live_video/live_video_api_models.dart";
import "live_video/live_video_connection_state.dart";
import "live_video/live_video_disconnect_source.dart";
import "live_video/live_video_evidence_overlay.dart";
import "live_video/live_video_lifecycle_phase.dart";
import "live_video/live_video_preview_pane.dart";
import "live_video/live_video_join_flow.dart";
import "live_video/live_video_safe_log.dart";
import "live_video/live_video_session_controller.dart";
import "live_video/live_video_error_codes.dart";
import "live_video/live_video_stop_routing.dart";
import "live_video/live_video_startup_trace.dart";
import "live_video/live_video_start_validation.dart";
import "danger_trigger/danger_trigger_screen.dart";
import "danger_trigger/danger_trigger_alert_screen.dart";
import "brand.dart";
import "config/app_flavor.dart";
import "config/firebase_bootstrap.dart";
import "config/the_eye_api_config.dart";
import "design_system/eye_design_system.dart";
import "presentation/citizen_date_time.dart";
import "presentation/citizen_notification_presenter.dart";
import "presentation/citizen_time_picker.dart";
import "presentation/missing_person_age.dart";
import "vehicles/vehicle_image_persist.dart";
import "vehicles/vehicle_photo_section.dart";
import "push/push_background_handler.dart";
import "auth/citizen_auth_return_listener.dart";
import "push/push_deep_link_router.dart";
import "push/push_navigation.dart";
import "push/push_notification_service.dart";
import "broadcasts/broadcast_feed_cache.dart";
import "broadcasts/broadcast_feed_service.dart";
import "broadcasts/broadcast_media_upload_service.dart";
import "broadcasts/broadcast_navigation.dart";
import "broadcasts/broadcast_screens.dart";
import "broadcasts/broadcast_session.dart";
import "broadcasts/stolen_vehicle_broadcast_draft_store.dart";
import "broadcasts/broadcast_submission_service.dart";
import "presentation/citizen_broadcast_presenter.dart";
import "community_verification/community_verification_screen.dart";
import "community_verification/community_verification_service.dart";
import "neighborhood_watch/community_access_status.dart";
import "neighborhood_watch/community_discovery_presentation.dart";
import "neighborhood_watch/neighborhood_watch_prototype_chrome.dart";
import "neighborhood_watch/neighborhood_watch_service.dart";
import "neighborhood_watch/neighborhood_watch_destinations.dart";
import "neighborhood_watch/neighborhood_watch_session.dart";
import "neighborhood_watch/nw_home_screen.dart";
import "neighborhood_watch/volunteer_categories.dart";
import "navigation/navigate_back_or_home.dart";
import "incidents/live_video_incident_retry.dart";
import "neighborhood_watch/community_media_upload_service.dart";
import "neighborhood_watch/community_members_screen.dart";
import "neighborhood_watch/community_post_detail_screen.dart";
import "neighborhood_watch/geo_community_chat_view.dart";
import "neighborhood_watch/community_report_screen.dart";
import "neighborhood_watch/private_community_membership_screen.dart";
import "notifications/notification_destination.dart";
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
import "presentation/citizen_presentation.dart";
import "police/police_stations_screen.dart";
import "profile/profile_screen.dart";
import "settings/build_diagnostics_screen.dart";
import "settings/language_region_preference_store.dart";
import "settings/language_region_settings_screen.dart";
import "support/support_chat_screens.dart";
import "support/support_home_screen.dart";
import "support/support_models.dart";

export "app/app_scope.dart" show AppScope;
export "location/location_permission_service.dart"
    show
        LocationAccessResult,
        LocationCaptureOutcome,
        LocationCaptureResult,
        LocationPermissionState,
        LocationRecoveryAction,
        LocationSource,
        captureLocationOutcome,
        kEmergencyLocationTimeout,
        kLocationCaptureTimeout,
        kLocationPermissionTimeout,
        locationFailureMessage,
        locationMetadataFields,
        locationStateMessage,
        nearbyLocationNotice,
        openAppSettings,
        openLocationSettings,
        resolveLocationAccess,
        resolveLocationPermission,
        resolveLocationPermissionState,
        sosLocationUserMessage;
import "theme/the_eye_theme.dart";
import "theme/eye_theme_builder.dart";
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

Widget _buildActiveEmergencyRoute(BuildContext context,
    {String? routeIncidentId}) {
  final args = ModalRoute.of(context)?.settings.arguments;
  final incidentId = routeIncidentId ??
      (args is Map ? args["incidentId"] as String? : args as String?) ??
      "";
  final silent = args is Map ? args["silent"] == true : false;
  final liveVideoError = args is Map ? args["liveVideoError"] as String? : null;
  final controller = appOf(context);
  final token = controller.accessToken ?? "";
  if (incidentId.isNotEmpty) {
    unawaited(controller.startIncidentLocationTracking(incidentId));
  }
  return ActiveEmergencyScreen(
    incidentId: incidentId,
    accessToken: token,
    service: controller.activeEmergencyService,
    apiClient: controller.apiClient,
    silent: silent,
    liveVideoErrorMessage: liveVideoError,
    onStopLocationTracking: () async =>
        controller.stopIncidentLocationTracking(),
    onStartLiveVideo: (activeIncidentId) async {
      final result = await Navigator.of(context).pushNamed(
        "/live-video",
        arguments: LiveVideoRouteArgs(
          incidentId: activeIncidentId,
          autoStartStream: true,
          returnToActiveEmergency: true,
        ),
      );
      if (result is LiveVideoReturnResult &&
          result.errorMessage != null &&
          context.mounted) {
        await Navigator.of(context).pushReplacementNamed(
          "/active-emergency/$activeIncidentId",
          arguments: {
            "incidentId": activeIncidentId,
            "silent": silent,
            "liveVideoError": result.errorMessage,
          },
        );
      }
    },
  );
}

Route<dynamic>? _onGenerateRoute(RouteSettings settings) {
  final name = settings.name ?? "";
  if (name == NeighborhoodWatchDestinations.create) {
    return PageRouteBuilder<void>(
      settings: settings,
      opaque: false,
      barrierDismissible: true,
      barrierColor: Colors.black54,
      barrierLabel: "Close community composer",
      transitionDuration: const Duration(milliseconds: 240),
      reverseTransitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (context, animation, secondaryAnimation) =>
          const CreateCommunityPostScreen(),
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 1),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
            reverseCurve: Curves.easeInCubic,
          )),
          child: child,
        );
      },
    );
  }
  if (name.startsWith("/incident-detail/") && name.endsWith("/messages")) {
    final incidentId = name
        .substring("/incident-detail/".length, name.length - "/messages".length)
        .trim();
    if (incidentId.isEmpty) return null;
    final detailArgs = settings.arguments is Map
        ? Map<String, dynamic>.from(settings.arguments as Map)
        : const <String, dynamic>{};
    return MaterialPageRoute(
      settings: settings,
      builder: (context) {
        final app = appOf(context);
        return IncidentCommunicationScreen(
          incidentId: incidentId,
          accessToken: app.accessToken ?? "",
          apiClient: app.apiClient,
          readOnly: true,
          publicReference: detailArgs["publicReference"]?.toString(),
          locationLabel: detailArgs["locationLabel"]?.toString(),
          reportedAt: detailArgs["reportedAt"] is DateTime
              ? detailArgs["reportedAt"] as DateTime
              : DateTime.tryParse(detailArgs["reportedAt"]?.toString() ?? ""),
        );
      },
    );
  }
  if (name.startsWith("/active-emergency/") &&
      name != "/active-emergency/none") {
    final remainder = name.substring("/active-emergency/".length).trim();
    if (remainder.endsWith("/messages")) {
      final incidentId =
          remainder.substring(0, remainder.length - "/messages".length).trim();
      if (incidentId.isEmpty) return null;
      final messageArgs = settings.arguments is Map
          ? Map<String, dynamic>.from(settings.arguments as Map)
          : const <String, dynamic>{};
      return MaterialPageRoute(
        settings: settings,
        builder: (context) {
          final app = appOf(context);
          return IncidentCommunicationScreen(
            incidentId: incidentId,
            accessToken: app.accessToken ?? "",
            apiClient: app.apiClient,
            publicReference: messageArgs["publicReference"]?.toString(),
            locationLabel: messageArgs["locationLabel"]?.toString(),
            reportedAt: messageArgs["reportedAt"] is DateTime
                ? messageArgs["reportedAt"] as DateTime
                : DateTime.tryParse(
                    messageArgs["reportedAt"]?.toString() ?? ""),
            confirmStillOngoing: messageArgs["confirmStillOngoing"] == true,
            confirmResolved: messageArgs["confirmResolved"] == true,
          );
        },
      );
    }
    final incidentId = remainder;
    if (incidentId.isEmpty) {
      return MaterialPageRoute(
        settings: settings,
        builder: (context) => const NoActiveEmergencyScreen(),
      );
    }
    return MaterialPageRoute(
      settings: settings,
      builder: (context) => _buildActiveEmergencyRoute(
        context,
        routeIncidentId: incidentId,
      ),
    );
  }
  final broadcastRoute = resolveBroadcastRoute(
    settings,
    missingPersonBuilder: () => const MissingPersonBroadcastScreen(),
    stolenVehicleBuilder: () => const StolenVehicleBroadcastScreen(),
  );
  if (broadcastRoute != null) return broadcastRoute;
  if (name.startsWith("/community-verification/")) {
    final requestId = name.substring("/community-verification/".length).trim();
    if (requestId.isEmpty) return null;
    return MaterialPageRoute(
      settings: settings,
      builder: (context) {
        final app = appOf(context);
        return CommunityVerificationScreen(
          requestId: requestId,
          service: CommunityVerificationService(app.apiClient),
          accessToken: app.accessToken ?? "",
          highContrast: app.highContrastMode,
        );
      },
    );
  }
  if (name.startsWith("/incident-archive/")) {
    final incidentId = name.substring("/incident-archive/".length).trim();
    if (incidentId.isEmpty) return null;
    return MaterialPageRoute(
      settings: settings,
      builder: (context) => IncidentArchiveScreen(
        incidentId: incidentId,
        accessToken: appOf(context).accessToken ?? "",
        apiClient: appOf(context).apiClient,
      ),
    );
  }
  if (name.startsWith("/broadcast-archive/")) {
    final broadcastId = name.substring("/broadcast-archive/".length).trim();
    if (broadcastId.isEmpty) return null;
    return MaterialPageRoute(
      settings: settings,
      builder: (context) => BroadcastArchiveScreen(
        broadcastId: broadcastId,
        accessToken: appOf(context).accessToken ?? "",
        apiClient: appOf(context).apiClient,
      ),
    );
  }
  if (NeighborhoodWatchDestinations.isPostRoute(name)) {
    final postId = NeighborhoodWatchDestinations.postIdFromRoute(name);
    if (postId == null || postId.isEmpty) return null;
    return MaterialPageRoute(
      settings: settings,
      builder: (context) {
        final controller = appOf(context);
        return CommunityPostDetailScreen(
          accessToken: controller.accessToken ?? "",
          args: resolveCommunityPostRouteArgs(
            pathPostId: postId,
            settingsArguments: settings.arguments,
            selectedCommunityId: controller.selectedCommunity?.id,
            currentUserId: controller.cachedCitizenProfile?.id,
          ),
          isOnline: controller.online,
        );
      },
    );
  }
  if (NeighborhoodWatchDestinations.isPatrolRoute(name)) {
    final scheduleId = NeighborhoodWatchDestinations.patrolIdFromRoute(name);
    return MaterialPageRoute(
      settings: settings,
      builder: (context) => PatrolsScreen(highlightScheduleId: scheduleId),
    );
  }
  if (NeighborhoodWatchDestinations.isPrivateCommunityRoute(name)) {
    final communityId =
        NeighborhoodWatchDestinations.privateCommunityIdFromRoute(name);
    if (communityId == null || communityId.isEmpty) return null;
    return MaterialPageRoute(
      settings: settings,
      builder: (context) {
        final controller = appOf(context);
        return PrivateCommunityMembershipScreen(
          accessToken: controller.accessToken ?? "",
          communityId: communityId,
        );
      },
    );
  }
  return null;
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

const kSosSubmissionTimeout = Duration(seconds: 45);
const kLiveVideoStartTimeout = Duration(seconds: 45);

String safeBroadcastPublishErrorLog(Object error, StackTrace stackTrace) {
  final redactedMessage = error.toString().replaceAllMapped(
    RegExp(r"https?://\S+"),
    (match) {
      final raw = match.group(0) ?? "";
      final uri = Uri.tryParse(raw);
      if (uri == null) return "<redacted-url>";
      return uri.replace(query: "redacted", fragment: "").toString();
    },
  );
  final stackHead = stackTrace.toString().split("\n").take(6).join("\n");
  return "${error.runtimeType}: $redactedMessage\n$stackHead";
}

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
    final authSessionStore = await SecureAuthSessionStore.create()
        .timeout(const Duration(seconds: 5));
    final authPersistencePreferenceStore =
        await AuthPersistencePreferenceStore.create()
            .timeout(const Duration(seconds: 5));
    await authPersistencePreferenceStore
        .applyColdLaunchPolicy(authSessionStore);
    final vehicleGarageStore =
        await SharedPreferencesVehicleGarageStore.create()
            .timeout(const Duration(seconds: 5));
    final languageRegionPreferenceStore =
        await LanguageRegionPreferenceStore.create()
            .timeout(const Duration(seconds: 5));
    final initialLocale = TheEyeLocaleCatalog.resolvePreferredLocale(
      cachedLocale: languageRegionPreferenceStore.preferredLocale,
      deviceLocales: WidgetsBinding.instance.platformDispatcher.locales,
    );

    AuthService? authService;
    AppController? controller;
    final apiClient = TheEyeApiClient(
      baseUrl: theEyeApiUrl,
      accessTokenProvider: () => controller?.accessToken,
      onUnauthorizedRefresh: (rejectedAccessToken) async {
        final currentAccessToken = controller?.accessToken;
        if (currentAccessToken != null &&
            currentAccessToken.isNotEmpty &&
            currentAccessToken != rejectedAccessToken) {
          return currentAccessToken;
        }
        final service = authService;
        if (service == null) return null;
        final refreshed = await service.refreshSessionSingleFlight();
        final appController = controller;
        if (refreshed == null) {
          appController?.clearCachedSession();
          return null;
        }
        await appController?.applyRefreshedSession(refreshed);
        return refreshed.accessToken;
      },
    );
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

    authService = AuthService(
      apiClient: apiClient,
      sessionStore: authSessionStore,
      languageRegionPreferenceStore: languageRegionPreferenceStore,
    );
    controller = AppController(
      apiClient: apiClient,
      submissionService: submissionService,
      connectivity: connectivity,
      authService: authService,
      socialAuthService: SocialAuthService(
        apiClient: apiClient,
        sessionStore: authSessionStore,
      ),
      authSessionStore: authSessionStore,
      authPersistencePreferenceStore: authPersistencePreferenceStore,
      biometricAuthService: BiometricAuthService(),
      biometricPreferenceStore: SecureBiometricPreferenceStore(),
      themeProvider: themeProvider,
      vehicleGarageStore: vehicleGarageStore,
      initialLocale: initialLocale,
      languageRegionPreferenceStore: languageRegionPreferenceStore,
    );
    await controller.loadPersistedSession().timeout(const Duration(seconds: 5));
    final appController = controller!;

    final pushNotifications = PushNotificationService(
      apiClient: apiClient,
      accessTokenProvider: () => appController.accessToken,
    );
    appController.bindPushNotifications(pushNotifications);

    final retryCoordinator = PendingRetryCoordinator(
      connectivity: connectivity,
      submissionService: submissionService,
      accessTokenProvider: () => appController.accessToken,
    );
    retryCoordinator.onSyncComplete = appController.handleRetryResults;
    appController.attachRetryCoordinator(retryCoordinator);

    StartupDiagnostics.checkpoint("critical dependencies ready");
    return TheEyeAppDependencies(
      controller: appController,
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

class _TheEyeAppState extends State<TheEyeApp> with WidgetsBindingObserver {
  AppController get controller => widget.controller;
  StreamSubscription<PushNavigationRequest>? _pushNavigationSubscription;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pushNavigationSubscription =
        widget.pushNotifications.navigationStream.listen((request) {
      unawaited(_handlePushNavigation(request));
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    unawaited(controller.ensureFreshSession());
  }

  Future<void> _handlePushNavigation(PushNavigationRequest request) async {
    if (!PushDeepLinkRouter.isAllowedDestination(request.route)) return;
    await controller.handlePushNavigation(request);
    if (!mounted) return;
    final navigator = theEyeNavigatorKey.currentState;
    if (navigator == null) return;

    if (request.route.startsWith("/active-emergency/") &&
        request.route.endsWith("/messages")) {
      final incidentId = request.route
          .substring("/active-emergency/".length,
              request.route.length - "/messages".length)
          .trim();
      if (incidentId.isEmpty) return;
      navigator.pushNamed("/active-emergency/$incidentId/messages");
      return;
    }

    if (request.route.startsWith("/incident-detail/") &&
        request.route.endsWith("/messages")) {
      final incidentId = request.route
          .substring("/incident-detail/".length,
              request.route.length - "/messages".length)
          .trim();
      if (incidentId.isEmpty) return;
      navigator.pushNamed("/incident-detail/$incidentId/messages");
      return;
    }

    if (request.route.startsWith("/danger-trigger/events/")) {
      final eventId =
          request.route.substring("/danger-trigger/events/".length).trim();
      if (eventId.isEmpty) return;
      navigator.pushNamed("/danger-trigger/alert", arguments: eventId);
      return;
    }

    if (request.route == "/incident-detail") {
      final incidentId = request.incidentId;
      if (incidentId == null || incidentId.isEmpty) return;
      navigator.pushNamed("/incident-detail", arguments: incidentId);
      return;
    }

    if (request.route == "/active-emergency") {
      final currentRoute =
          ModalRoute.of(theEyeNavigatorKey.currentContext!)?.settings.name;
      if (currentRoute != null &&
          currentRoute.startsWith("/active-emergency")) {
        return;
      }
      final incidentId = request.incidentId;
      if (incidentId == null || incidentId.isEmpty) {
        navigator.pushNamed("/active-emergencies");
        return;
      }
      final token = controller.accessToken;
      if (token != null && token.isNotEmpty) {
        try {
          await controller.activeEmergencyService.fetchActiveEmergencyContract(
            incidentId,
            token,
            silent: request.silent,
          );
        } catch (_) {
          await controller.activateActiveEmergency(
            incidentId,
            silent: request.silent,
          );
        }
      }
      unawaited(controller.startIncidentLocationTracking(incidentId));
      navigator.pushNamedAndRemoveUntil(
        "/active-emergency/$incidentId",
        (existing) => existing.isFirst || existing.settings.name == "/home",
        arguments: {
          "incidentId": incidentId,
          "silent": request.silent,
        },
      );
      return;
    }

    if (request.route == "/support/conversation") {
      final conversationId = request.conversationId;
      if (conversationId == null || conversationId.isEmpty) {
        navigator.pushNamed("/support/chats");
        return;
      }
      navigator.pushNamed(
        request.route,
        arguments: SupportConversationRouteArgs(conversationId: conversationId),
      );
      return;
    }

    navigator.pushNamedAndRemoveUntil(
      request.route,
      (existing) => existing.isFirst || existing.settings.name == "/home",
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pushNavigationSubscription?.cancel();
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
            locale: controller.locale,
            supportedLocales: TheEyeLocaleCatalog.supportedLocales,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
            ],
            theme: buildTheme(controller.highContrastMode),
            darkTheme: buildDarkTheme(controller.highContrastMode),
            themeMode: controller.themeMode,
            onGenerateRoute: _onGenerateRoute,
            builder: (context, child) {
              final content = child ?? const StartupSplashScreen();
              return CitizenAuthReturnHost(
                navigatorKey: theEyeNavigatorKey,
                isAuthenticated: () => controller.isAuthenticated,
                child: content,
              );
            },
            routes: {
              "/": (_) => const SplashScreen(),
              "/login": (_) => const LoginRegisterScreen(),
              "/account-recovery": (context) => AccountRecoveryRequestScreen(
                    authService: appOf(context).authService,
                  ),
              "/account-recovery/complete": (context) {
                final token =
                    ModalRoute.of(context)?.settings.arguments as String? ?? "";
                final controller = appOf(context);
                return AccountRecoveryCompleteScreen(
                  token: token,
                  authService: controller.authService,
                  socialAuthService: controller.socialAuthService,
                  onRecoveryComplete: (session,
                      {required profileComplete}) async {
                    await controller.setSession(session);
                    if (!profileComplete) {
                      await controller.loadCitizenProfile(forceRefresh: true);
                    }
                  },
                );
              },
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
                final routeArgs = args is LiveVideoRouteArgs ? args : null;
                final autoStart = routeArgs?.autoStartStream ?? false;
                return LiveEmergencyVideoScreen(
                  autoStartStream: autoStart,
                  incidentId: routeArgs?.incidentId,
                  returnToActiveEmergency:
                      routeArgs?.returnToActiveEmergency ?? false,
                );
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
              BroadcastRoutes.create: (_) => const BroadcastCreateHubScreen(),
              BroadcastRoutes.mine: (_) => const MyBroadcastsScreen(),
              BroadcastRoutes.createMissingPerson: (_) =>
                  const MissingPersonBroadcastScreen(),
              BroadcastRoutes.createStolenVehicle: (_) =>
                  const StolenVehicleBroadcastScreen(),
              "/police-stations": (_) => const NearbyPoliceStationsScreen(),
              "/notifications": (_) => const NotificationsScreen(),
              "/tracking": (_) => const IncidentTrackingScreen(),
              "/active-emergency": (context) =>
                  _buildActiveEmergencyRoute(context),
              "/active-emergencies": (context) => FutureBuilder(
                    future: appOf(context)
                        .activeEmergencyService
                        .listActiveReferences(),
                    builder: (context, snapshot) {
                      final refs = snapshot.data ?? const [];
                      return ActiveEmergenciesSelectorScreen(references: refs);
                    },
                  ),
              "/active-emergency/none": (_) => const NoActiveEmergencyScreen(),
              "/incident-detail": (context) {
                final incidentId =
                    ModalRoute.of(context)?.settings.arguments as String? ?? "";
                final token = appOf(context).accessToken ?? "";
                return IncidentDetailScreen(
                  incidentId: incidentId,
                  accessToken: token,
                  apiClient: appOf(context).apiClient,
                );
              },
              "/family": (_) => const FamilySafetyCircleScreen(),
              "/smartwatch": (_) => const SmartwatchDeviceScreen(),
              "/danger-trigger": (context) => DangerTriggerScreen(
                    apiClient: appOf(context).apiClient,
                    accessTokenProvider: () => appOf(context).accessToken,
                  ),
              "/danger-trigger/alert": (context) {
                final eventId =
                    ModalRoute.of(context)?.settings.arguments as String? ?? "";
                return DangerTriggerAlertScreen(
                  eventId: eventId,
                  apiClient: appOf(context).apiClient,
                  accessTokenProvider: () => appOf(context).accessToken,
                );
              },
              "/neighborhood-watch": (_) => const NeighborhoodWatchHomeScreen(),
              "/neighborhood-watch/communities": (_) =>
                  const NeighborhoodWatchHomeScreen(openChatWhenReady: true),
              "/neighborhood-watch/join": (_) =>
                  const NeighborhoodWatchHomeScreen(),
              "/neighborhood-watch/request-community": (_) =>
                  const NeighborhoodWatchHomeScreen(),
              "/neighborhood-watch/preview-community": (_) =>
                  const NeighborhoodWatchHomeScreen(),
              "/neighborhood-watch/feed": (_) =>
                  const NeighborhoodWatchHomeScreen(),
              "/neighborhood-watch/map": (_) => const CommunityMapScreen(),
              "/neighborhood-watch/chat": (context) {
                final args = ModalRoute.of(context)?.settings.arguments;
                final contextResolved =
                    args is Map && args["contextResolved"] == true;
                return contextResolved
                    ? const CommunityFeedScreen()
                    : const NeighborhoodWatchHomeScreen(
                        openChatWhenReady: true,
                      );
              },
              "/neighborhood-watch/volunteers": (_) => const VolunteersScreen(),
              "/neighborhood-watch/patrols": (_) => const PatrolsScreen(),
              "/neighborhood-watch/broadcasts": (_) =>
                  const BroadcastCenterScreen(),
              "/neighborhood-watch/alerts": (_) =>
                  const CommunityAlertsScreen(),
              "/neighborhood-watch/members": (context) {
                final controller = appOf(context);
                final community = controller.selectedCommunity;
                return CommunityMembersScreen(
                  accessToken: controller.accessToken ?? "",
                  communityId: community?.id ?? "",
                  communityName: community?.name ?? "Community",
                );
              },
              "/neighborhood-watch/post": (context) {
                final controller = appOf(context);
                final args = ModalRoute.of(context)?.settings.arguments
                    as CommunityPostDetailRouteArgs?;
                return CommunityPostDetailScreen(
                  accessToken: controller.accessToken ?? "",
                  args: args ??
                      CommunityPostDetailRouteArgs(
                        postId: "",
                        postTitle: "Post",
                        communityId: controller.selectedCommunity?.id ?? "",
                        currentUserId: controller.cachedCitizenProfile?.id,
                      ),
                  isOnline: controller.online,
                );
              },
              "/neighborhood-watch/report": (context) {
                final controller = appOf(context);
                final args = ModalRoute.of(context)?.settings.arguments
                    as CommunityReportRouteArgs?;
                return CommunityReportScreen(
                  accessToken: controller.accessToken ?? "",
                  apiClient: controller.apiClient,
                  args: args ??
                      CommunityReportRouteArgs(
                        communityId: controller.selectedCommunity?.id ?? "",
                        targetType: "Community",
                        targetId: controller.selectedCommunity?.id ?? "",
                        targetLabel:
                            controller.selectedCommunity?.name ?? "Community",
                      ),
                );
              },
              "/profile": (_) => const ProfileScreen(),
              "/profile/edit": (_) => const ProfileEditScreen(),
              "/profile/emergency-contacts": (context) =>
                  EmergencyContactsScreen(apiClient: appOf(context).apiClient),
              "/profile/kyc": (context) =>
                  KycScreen(apiClient: appOf(context).apiClient),
              "/settings": (_) => const SettingsScreen(),
              "/settings/diagnostics": (_) => const BuildDiagnosticsScreen(),
              "/settings/language-region": (_) =>
                  const LanguageRegionSettingsScreen(),
              "/support": (context) => SupportHomeScreen(
                    accessToken: appOf(context).accessToken ?? "",
                    onSendSos: () => _openSos(context),
                    onOpenActiveEmergency: () => unawaited(
                      ActiveEmergencyNavigation.open(
                        context,
                        appOf(context),
                      ),
                    ),
                  ),
              "/support/new": (context) {
                final prefill = ModalRoute.of(context)?.settings.arguments
                        as SupportNewChatPrefill? ??
                    const SupportNewChatPrefill();
                return SupportNewChatScreen(
                  accessToken: appOf(context).accessToken ?? "",
                  prefill: prefill,
                  apiClient: appOf(context).apiClient,
                );
              },
              "/support/chats": (context) => SupportChatListScreen(
                    accessToken: appOf(context).accessToken ?? "",
                    apiClient: appOf(context).apiClient,
                  ),
              "/support/faq": (_) => const SupportFaqScreen(),
              "/support/conversation": (context) {
                final args = ModalRoute.of(context)?.settings.arguments
                    as SupportConversationRouteArgs?;
                final controller = appOf(context);
                if (args == null) {
                  return const Scaffold(
                      body: Center(child: Text("Conversation not found")));
                }
                return SupportConversationScreen(
                  accessToken: controller.accessToken ?? "",
                  conversationId: args.conversationId,
                  isOnline: controller.online,
                  apiClient: controller.apiClient,
                );
              },
              "/your-car": (_) => const YourCarScreen(),
              "/your-car/detail": (context) {
                final args = ModalRoute.of(context)?.settings.arguments;
                return VehicleDetailScreen(
                  args: args is _VehicleEditorArgs
                      ? args
                      : const _VehicleEditorArgs(),
                );
              },
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

  const semantics = EyeSemanticColors.light;

  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: BrandColors.lightBackground,
    fontFamily: _montserratFontFamily(),
    textTheme: textTheme,
    extensions: const [semantics],
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: semantics.primaryAction,
        foregroundColor: semantics.primaryActionForeground,
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: semantics.interactiveText,
        side: BorderSide(color: semantics.interactiveText),
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: EyeThemeBuilder.inputDecoration(semantics),
    textSelectionTheme: EyeThemeBuilder.textSelection(semantics),
    dialogTheme: EyeThemeBuilder.dialog(semantics),
    bottomSheetTheme: EyeThemeBuilder.bottomSheet(semantics),
    navigationBarTheme: EyeThemeBuilder.navigationBar(semantics),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: semantics.linkText,
        minimumSize: const Size(48, 48),
      ),
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
  const semantics = EyeSemanticColors.dark;
  final textTheme = _montserratTextTheme(baseTextTheme).apply(
    bodyColor: semantics.bodyText,
    displayColor: semantics.bodyText,
  );
  final scheme = ColorScheme.fromSeed(
    seedColor: BrandColors.orange,
    brightness: Brightness.dark,
    primary: semantics.primaryAction,
    onPrimary: semantics.primaryActionForeground,
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
    extensions: const [semantics],
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: semantics.primaryAction,
        foregroundColor: semantics.primaryActionForeground,
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: semantics.interactiveText,
        side: BorderSide(color: semantics.interactiveText),
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: EyeThemeBuilder.inputDecoration(semantics),
    textSelectionTheme: EyeThemeBuilder.textSelection(semantics),
    dialogTheme: EyeThemeBuilder.dialog(semantics),
    bottomSheetTheme: EyeThemeBuilder.bottomSheet(semantics),
    navigationBarTheme: EyeThemeBuilder.navigationBar(semantics),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: semantics.linkText,
        minimumSize: const Size(48, 48),
      ),
    ),
    cardTheme: CardThemeData(
        color: BrandColors.darkSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: BrandColors.darkBorder))),
    listTileTheme: ListTileThemeData(
      iconColor: semantics.interactiveText,
      textColor: semantics.bodyText,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: semantics.elevatedSurface,
      selectedColor: semantics.primaryAction.withValues(alpha: 0.24),
      labelStyle: TextStyle(color: semantics.bodyText),
      secondaryLabelStyle: TextStyle(color: semantics.bodyText),
      side: BorderSide(color: semantics.border),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? semantics.primaryAction
            : semantics.mutedText,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? semantics.primaryAction.withValues(alpha: 0.4)
            : semantics.elevatedSurface,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: BrandColors.darkSurface,
      foregroundColor: BrandColors.darkText,
      surfaceTintColor: Colors.transparent,
    ),
  );
}

typedef BackgroundPushContextPersister = Future<void> Function({
  required String accessToken,
  required String apiBaseUrl,
});

class AppController extends SessionAccessor
    implements
        ActiveEmergencyNavigationController,
        BroadcastSession,
        NeighborhoodWatchSession {
  AppController({
    required TheEyeApiClient apiClient,
    required IncidentSubmissionService submissionService,
    required ConnectivityService connectivity,
    required AuthService authService,
    required SocialAuthService socialAuthService,
    required AuthSessionStore authSessionStore,
    AuthPersistencePreferenceStore? authPersistencePreferenceStore,
    BiometricAuthService? biometricAuthService,
    BiometricPreferenceStore? biometricPreferenceStore,
    BackgroundPushContextPersister? backgroundPushContextPersister,
    required ThemeProvider themeProvider,
    required VehicleGarageStore vehicleGarageStore,
    Locale initialLocale = TheEyeLocaleCatalog.defaultLocale,
    LanguageRegionPreferenceStore? languageRegionPreferenceStore,
  })  : _apiClient = apiClient,
        _submissionService = submissionService,
        _historyService = IncidentHistoryService(apiClient: apiClient),
        _notificationInboxService =
            NotificationInboxService(apiClient: apiClient),
        _broadcastFeedService = BroadcastFeedService(apiClient: apiClient),
        _broadcastSubmissionService =
            BroadcastSubmissionService(apiClient: apiClient),
        _broadcastMediaUploadService =
            BroadcastMediaUploadService(apiClient: apiClient),
        _neighborhoodWatchService =
            NeighborhoodWatchService(apiClient: apiClient),
        _communityMediaUploadService =
            CommunityMediaUploadService(apiClient: apiClient),
        _connectivity = connectivity,
        _authService = authService,
        _socialAuthService = socialAuthService,
        _authSessionStore = authSessionStore,
        _authPersistencePreferenceStore = authPersistencePreferenceStore,
        _biometricAuthService = biometricAuthService ?? BiometricAuthService(),
        _biometricPreferenceStore =
            biometricPreferenceStore ?? InMemoryBiometricPreferenceStore(),
        _backgroundPushContextPersister =
            backgroundPushContextPersister ?? persistBackgroundPushContext,
        _remainSignedIn =
            authPersistencePreferenceStore?.remainSignedIn ?? true,
        _themeProvider = themeProvider,
        _vehicleGarageStore = vehicleGarageStore,
        _locale = initialLocale,
        _languageRegionPreferenceStore = languageRegionPreferenceStore {
    _connectivity.addListener(_onConnectivityChanged);
    _themeProvider.addListener(_onThemeChanged);
    unawaited(_loadVehicleGarageCache());
  }

  /// Shared HTTP client with single-flight 401 refresh (FUNC-004 / FUNC-0XX).
  final TheEyeApiClient _apiClient;
  final IncidentSubmissionService _submissionService;
  final IncidentHistoryService _historyService;
  final NotificationInboxService _notificationInboxService;
  final NotificationInboxCache _notificationInboxCache =
      NotificationInboxCache();
  final BroadcastFeedService _broadcastFeedService;
  final BroadcastSubmissionService _broadcastSubmissionService;
  final BroadcastMediaUploadService _broadcastMediaUploadService;
  final BroadcastFeedCache _broadcastFeedCache = BroadcastFeedCache();
  final ComposeDraftStore _composeDraftStore = ComposeDraftStore();
  EmergencyLocationCoordinator? _locationCoordinator;
  ActiveEmergencyService? _activeEmergencyService;
  final ConnectivityService _connectivity;
  final AuthService _authService;
  final SocialAuthService _socialAuthService;
  final AuthSessionStore _authSessionStore;
  final AuthPersistencePreferenceStore? _authPersistencePreferenceStore;
  final BiometricAuthService _biometricAuthService;
  final BiometricPreferenceStore _biometricPreferenceStore;
  final BackgroundPushContextPersister _backgroundPushContextPersister;
  BiometricPreference _biometricPreference =
      const BiometricPreference.disabled();
  bool _biometricUnlockRequired = false;
  bool _remainSignedIn;
  final ThemeProvider _themeProvider;
  final VehicleGarageStore _vehicleGarageStore;
  Locale _locale;
  LanguageRegionPreferenceStore? _languageRegionPreferenceStore;

  Future<LanguageRegionPreferenceStore> _languageRegionStore() async {
    return _languageRegionPreferenceStore ??=
        await LanguageRegionPreferenceStore.create();
  }

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
  final List<BroadcastFeedItem> broadcasts = [];
  bool loadingBroadcasts = false;
  String? broadcastLoadError;
  String? broadcastNextCursor;
  int broadcastUnreadCount = 0;
  bool loadingMoreBroadcasts = false;
  final NeighborhoodWatchService _neighborhoodWatchService;
  final CommunityMediaUploadService _communityMediaUploadService;
  final List<CommunitySummary> communities = [];
  CommunitySummary? selectedCommunity;
  CommunitySummary? currentAreaCommunity;
  bool loadingCommunities = false;
  String? communityLoadError;
  CommunityStatistics? communityStatistics;
  bool loadingCommunityStatistics = false;
  String? communityStatisticsError;
  final List<CommunityPostItem> communityFeed = [];
  bool loadingCommunityFeed = false;
  bool loadingOlderCommunityMessages = false;
  String? communityFeedError;
  String? communityFeedNextCursor;
  final List<CommunityPostItem> communityAlerts = [];
  bool loadingCommunityAlerts = false;
  String? communityAlertsError;
  final List<PatrolScheduleItem> communityPatrols = [];
  bool loadingCommunityPatrols = false;
  String? communityPatrolError;
  String? communityActionMessage;

  ConnectivityService get connectivity => _connectivity;
  AuthService get authService => _authService;
  @override
  TheEyeApiClient get apiClient => _apiClient;
  BroadcastFeedService get broadcastFeedService => _broadcastFeedService;
  BroadcastSubmissionService get broadcastSubmissionService =>
      _broadcastSubmissionService;
  BroadcastMediaUploadService get broadcastMediaUploadService =>
      _broadcastMediaUploadService;
  SocialAuthService get socialAuthService => _socialAuthService;
  ConnectivityState get connectivityState => _connectivity.state;
  bool get online => _connectivity.isOnline;
  bool get showConnectivityBanner => _connectivity.showConnectivityBanner;
  Locale get locale => _locale;

  void _setLocaleCode(String? code, {bool notify = true}) {
    final next = TheEyeLocaleCatalog.effectiveLocaleForCode(code);
    if (_locale == next) return;
    _locale = next;
    if (notify) notifyListeners();
  }

  void _setLocaleFromProfile(CitizenProfile profile, {bool notify = true}) {
    _setLocaleCode(
      profile.effectivePreferredLocale ?? profile.profile.preferredLocale,
      notify: notify,
    );
  }

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
  bool get remainSignedIn => _remainSignedIn;
  bool get biometricUnlockEnabled => _biometricPreference.hasAccountBinding;
  bool get biometricUnlockRequired => _biometricUnlockRequired;

  Future<BiometricCapability> biometricCapability() =>
      _biometricAuthService.capability();

  Future<void> setRemainSignedIn(bool value) async {
    if (_remainSignedIn == value) return;
    await _authPersistencePreferenceStore?.setRemainSignedIn(value);
    _remainSignedIn = value;
    if (!value) {
      await disableBiometricUnlock();
    }
    notifyListeners();
  }

  Future<void> loadPersistedSession() async {
    final session = await _authSessionStore.load();
    _biometricPreference = await _biometricPreferenceStore.load();
    _biometricUnlockRequired =
        session != null && _biometricPreference.hasAccountBinding;
    _cachedSession = _biometricUnlockRequired ? null : session;
    _sessionAccessToken =
        _biometricUnlockRequired ? null : session?.accessToken;
    final store = await _languageRegionStore();
    _setLocaleCode(store.preferredLocale, notify: false);
    notifyListeners();
    if (_sessionAccessToken != null && _sessionAccessToken!.isNotEmpty) {
      await _backgroundPushContextPersister(
        accessToken: _sessionAccessToken!,
        apiBaseUrl: theEyeApiUrl,
      );
      await _pushNotifications?.syncTokenWithBackend();
      unawaited(loadVehicleGarage(refresh: true));
      unawaited(loadNotificationsFromApi());
    }
  }

  Future<void> setSession(AuthSession session) async {
    await _authSessionStore.save(session);
    _cachedSession = session;
    _sessionAccessToken = session.accessToken;
    clearCitizenProfileCache();
    await _reconcileBiometricBinding(session.accessToken);
    notifyListeners();
    await _backgroundPushContextPersister(
      accessToken: session.accessToken,
      apiBaseUrl: theEyeApiUrl,
    );
    await _pushNotifications?.syncTokenWithBackend();
    unawaited(loadVehicleGarage(refresh: true));
    unawaited(loadIncidentsFromApi());
    unawaited(loadNotificationsFromApi());
  }

  Future<void> _reconcileBiometricBinding(String accessToken) async {
    if (!_biometricPreference.hasAccountBinding) return;
    try {
      final profile =
          await _apiClient.fetchCitizenProfile(accessToken: accessToken);
      _cachedCitizenProfile = profile;
      if (profile.id != _biometricPreference.accountId) {
        await disableBiometricUnlock(notify: false);
      }
    } catch (_) {
      // A transient profile request must not erase an explicit opt-in.
    }
  }

  Future<BiometricAuthenticationStatus> enableBiometricUnlock() async {
    if (!isAuthenticated) return BiometricAuthenticationStatus.error;
    final status = await _biometricAuthService.authenticate(
      reason: "Confirm your identity to enable biometric unlock",
    );
    if (status != BiometricAuthenticationStatus.success) return status;
    try {
      final profile = await loadCitizenProfile(forceRefresh: true);
      if (profile == null || profile.id.trim().isEmpty) {
        return BiometricAuthenticationStatus.error;
      }
      if (!_remainSignedIn) {
        await _authPersistencePreferenceStore?.setRemainSignedIn(true);
        _remainSignedIn = true;
      }
      await _biometricPreferenceStore.enableForAccount(profile.id);
      _biometricPreference =
          BiometricPreference(enabled: true, accountId: profile.id);
      notifyListeners();
      return BiometricAuthenticationStatus.success;
    } catch (_) {
      return BiometricAuthenticationStatus.error;
    }
  }

  Future<void> disableBiometricUnlock({bool notify = true}) async {
    await _biometricPreferenceStore.clear();
    _biometricPreference = const BiometricPreference.disabled();
    _biometricUnlockRequired = false;
    if (notify) notifyListeners();
  }

  Future<BiometricUnlockResult> unlockWithBiometrics() async {
    if (!_biometricUnlockRequired || !_biometricPreference.hasAccountBinding) {
      return const BiometricUnlockResult(
        status: BiometricAuthenticationStatus.unavailable,
      );
    }
    final status = await _biometricAuthService.authenticate();
    if (status != BiometricAuthenticationStatus.success) {
      return BiometricUnlockResult(status: status);
    }

    final restore = await _authService.restorePersistedSession();
    final profile = restore.citizenProfile;
    if (!restore.isAuthenticated || restore.session == null) {
      await disableBiometricUnlock(notify: false);
      clearCachedSession();
      return const BiometricUnlockResult(
        status: BiometricAuthenticationStatus.error,
      );
    }
    if (profile == null ||
        profile.id.trim().isEmpty ||
        profile.id != _biometricPreference.accountId) {
      await _authSessionStore.clear();
      await disableBiometricUnlock(notify: false);
      clearCachedSession();
      return const BiometricUnlockResult(
        status: BiometricAuthenticationStatus.error,
      );
    }

    _biometricUnlockRequired = false;
    _cachedCitizenProfile = profile;
    await _applyRestoredSession(restore.session!);
    return BiometricUnlockResult(
      status: BiometricAuthenticationStatus.success,
      profileComplete: restore.status != SessionRestoreStatus.profileIncomplete,
    );
  }

  Future<void> ensureFreshSession() async {
    final session = await _authService.ensureFreshSession();
    if (session == null) {
      clearCachedSession();
      return;
    }
    if (_sessionAccessToken != session.accessToken) {
      await applyRefreshedSession(session);
      return;
    }
    _cachedSession = session;
    _sessionAccessToken = session.accessToken;
    notifyListeners();
  }

  Future<void> applyRefreshedSession(AuthSession session) async {
    _cachedSession = session;
    _sessionAccessToken = session.accessToken;
    clearCitizenProfileCache();
    notifyListeners();
    await _backgroundPushContextPersister(
      accessToken: session.accessToken,
      apiBaseUrl: theEyeApiUrl,
    );
  }

  void clearCachedSession() {
    _cachedSession = null;
    _sessionAccessToken = null;
    clearCitizenProfileCache();
    vehicles = const [];
    notifications.clear();
    notificationLoadError = null;
    notificationNextCursor = null;
    notificationUnreadCount = 0;
    broadcasts.clear();
    broadcastLoadError = null;
    broadcastNextCursor = null;
    broadcastUnreadCount = 0;
    communities.clear();
    selectedCommunity = null;
    currentAreaCommunity = null;
    nwContextCommunityId = null;
    nwContextCanPost = false;
    communityLoadError = null;
    communityFeed.clear();
    communityFeedError = null;
    communityFeedNextCursor = null;
    communityAlerts.clear();
    communityAlertsError = null;
    communityPatrols.clear();
    communityPatrolError = null;
    communityActionMessage = null;
    notifyListeners();
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
    await ensureFreshSession();
    if (accessToken == null) return;
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
          ..addAll(deduplicateLogicalNotifications(page.items));
      } else {
        final existingKeys =
            notifications.map((item) => item.logicalEventKey).toSet();
        notifications.addAll(
          page.items.where(
            (item) => !existingKeys.contains(item.logicalEventKey),
          ),
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
      final existingKeys =
          notifications.map((item) => item.logicalEventKey).toSet();
      notifications.addAll(
        page.items.where(
          (item) => !existingKeys.contains(item.logicalEventKey),
        ),
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
        if (notifications.any(
          (existing) => existing.logicalEventKey == item.logicalEventKey,
        )) {
          return;
        }
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
    await ensureFreshSession();
    if (accessToken == null) return;
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
              publicReference: row.publicReference,
              displayStatus: row.displayStatus,
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

  void _ensureLocationCoordinator() {
    _locationCoordinator ??= sharedEmergencyLocationCoordinator();
  }

  EmergencyLocationCoordinator get locationCoordinator {
    _ensureLocationCoordinator();
    return _locationCoordinator!;
  }

  @override
  bool get isEmergencyLocationTracking =>
      _locationCoordinator?.isTracking ?? false;

  Future<void> startIncidentLocationTracking(
    String incidentId, {
    String? liveVideoSessionId,
  }) async {
    if (accessToken == null) return;
    locationCoordinator.startTracking(
      incidentId: incidentId,
      accessToken: accessToken!,
      apiClient: _apiClient,
      liveVideoSessionId: liveVideoSessionId,
    );
  }

  void stopIncidentLocationTracking() {
    _locationCoordinator?.stopTracking();
  }

  ActiveEmergencyService get activeEmergencyService =>
      _activeEmergencyService ??= ActiveEmergencyService(
        apiClient: _apiClient,
      );

  Future<void> activateActiveEmergency(String incidentId,
      {bool silent = false}) {
    return activeEmergencyService.activateIncident(incidentId, silent: silent);
  }

  String? _lastPushNavigationKey;

  Future<void> handlePushNavigation(PushNavigationRequest request) async {
    final key =
        "${request.route}:${request.incidentId ?? ""}:${request.silent}";
    if (_lastPushNavigationKey == key) return;
    _lastPushNavigationKey = key;

    if (request.route == "/incident-detail") return;
    if (request.route != "/active-emergency") return;
    final token = accessToken;
    if (token == null || token.isEmpty) return;

    final incidentId = request.incidentId;
    if (incidentId != null && incidentId.isNotEmpty) {
      await activateActiveEmergency(incidentId, silent: request.silent);
      try {
        await activeEmergencyService.refreshIncident(
          incidentId,
          token,
          silent: request.silent,
        );
      } catch (_) {
        // Fall back to stored snapshot when refresh fails.
      }
      unawaited(startIncidentLocationTracking(incidentId));
    }
  }

  Future<ActiveEmergencySnapshot?> restoreActiveEmergency() async {
    if (accessToken == null) return null;
    return activeEmergencyService.restoreActiveEmergency(accessToken!);
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
    final profile =
        await _apiClient.fetchCitizenProfile(accessToken: accessToken!);
    await (await _languageRegionStore()).saveFromProfile(profile);
    _cachedCitizenProfile = profile;
    _setLocaleFromProfile(profile, notify: false);
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
    final updated = await _apiClient.updateCitizenProfile(
      accessToken: token,
      payload: payload,
    );
    await (await _languageRegionStore()).saveFromProfile(updated);
    _cachedCitizenProfile = updated;
    _setLocaleFromProfile(updated, notify: false);
    notifyListeners();
    return updated;
  }

  @override
  Future<void> clearSession({bool preserveBiometricUnlock = true}) async {
    final cacheScope = _notificationCacheScope;
    final persistedSession = await _authSessionStore.load();
    final canLockForBiometrics = preserveBiometricUnlock &&
        _remainSignedIn &&
        _biometricPreference.hasAccountBinding &&
        persistedSession != null;
    if (canLockForBiometrics) {
      _biometricUnlockRequired = true;
      clearCachedSession();
      if (cacheScope != null) {
        await _notificationInboxCache.clear(cacheScope);
        await _broadcastFeedCache.clear(cacheScope);
      }
      return;
    }

    await _pushNotifications?.deactivateCurrentToken();
    await _authService.logout();
    await _socialAuthService.signOutProviders();
    await disableBiometricUnlock(notify: false);
    clearCachedSession();
    if (cacheScope != null) {
      await _notificationInboxCache.clear(cacheScope);
      await _broadcastFeedCache.clear(cacheScope);
    }
  }

  Future<void> loadCommunitiesFromApi({bool refresh = false}) async {
    if (!isAuthenticated || accessToken == null) {
      communities.clear();
      selectedCommunity = null;
      currentAreaCommunity = null;
      communityLoadError = null;
      notifyListeners();
      return;
    }
    loadingCommunities = true;
    communityLoadError = null;
    notifyListeners();
    try {
      final page = await _neighborhoodWatchService.listCommunities(
        accessToken: accessToken!,
      );
      communities
        ..clear()
        ..addAll(page.items);
      final current = currentAreaCommunity;
      selectedCommunity ??= current != null && current.id.isNotEmpty
          ? current
          : communities.firstWhere(
              (community) => community.isMember,
              orElse: () => communities.isNotEmpty
                  ? communities.first
                  : CommunitySummary(
                      id: "",
                      name: "",
                      visibility: "Public",
                      memberCount: 0,
                      activeAlertsCount: 0,
                    ),
            );
      if (selectedCommunity?.id.isEmpty ?? true) selectedCommunity = null;
    } on IncidentApiException catch (error) {
      communityLoadError = error.userMessage;
    } catch (_) {
      communityLoadError = "Unable to load communities.";
    } finally {
      loadingCommunities = false;
      notifyListeners();
    }
  }

  void selectCommunity(CommunitySummary community) {
    selectedCommunity = community;
    notifyListeners();
  }

  @override
  void applyNeighborhoodWatchContext({
    required CommunitySummary community,
    required bool canPost,
  }) {
    currentAreaCommunity = community;
    selectedCommunity = community;
    nwContextCommunityId = community.id;
    nwContextCanPost = canPost;
    notifyListeners();
  }

  @override
  void clearNeighborhoodWatchParticipationContext() {
    currentAreaCommunity = null;
    nwContextCommunityId = null;
    nwContextCanPost = false;
    notifyListeners();
  }

  Future<void> loadCommunityFeed({bool refresh = false}) async {
    final community = selectedCommunity;
    if (!isAuthenticated || accessToken == null || community == null) return;
    loadingCommunityFeed = true;
    communityFeedError = null;
    notifyListeners();
    try {
      final page = await _neighborhoodWatchService.communityFeed(
        accessToken: accessToken!,
        communityId: community.id,
        cursor: refresh ? null : communityFeedNextCursor,
      );
      if (refresh) {
        communityFeed
          ..clear()
          ..addAll(page.items);
      } else {
        final known = communityFeed.map((item) => item.id).toSet();
        communityFeed
            .addAll(page.items.where((item) => !known.contains(item.id)));
      }
      communityFeedNextCursor = page.nextCursor;
    } on IncidentApiException catch (error) {
      communityFeedError = error.userMessage;
    } catch (_) {
      communityFeedError = "Unable to load community feed.";
    } finally {
      loadingCommunityFeed = false;
      notifyListeners();
    }
  }

  Future<void> loadOlderCommunityMessages() async {
    if (loadingOlderCommunityMessages || communityFeedNextCursor == null) {
      return;
    }
    loadingOlderCommunityMessages = true;
    notifyListeners();
    try {
      await loadCommunityFeed();
    } finally {
      loadingOlderCommunityMessages = false;
      notifyListeners();
    }
  }

  Future<void> loadCommunityAlerts({bool refresh = false}) async {
    final community = selectedCommunity;
    if (!isAuthenticated || accessToken == null || community == null) return;
    loadingCommunityAlerts = true;
    communityAlertsError = null;
    notifyListeners();
    try {
      if (isDynamicAreaCommunityId(community.id)) {
        // Dynamic areas use conversation posts for hazards/warnings; no mapped alerts feed.
        final page = await _neighborhoodWatchService.communityFeed(
          accessToken: accessToken!,
          communityId: community.id,
        );
        communityAlerts
          ..clear()
          ..addAll(page.items.where((post) => const {
                "SuspiciousActivity",
                "LocalWarning",
                "RoadHazard",
                "CrimeAlert",
                "AccidentAlert",
                "FireAlert",
                "FloodWarning",
              }.contains(post.type)));
      } else {
        final page = await _neighborhoodWatchService.communityAlerts(
          accessToken: accessToken!,
          communityId: community.id,
        );
        communityAlerts
          ..clear()
          ..addAll(page.items);
      }
    } on IncidentApiException catch (error) {
      communityAlertsError = error.userMessage;
    } catch (_) {
      communityAlertsError = "Unable to load community alerts.";
    } finally {
      loadingCommunityAlerts = false;
      notifyListeners();
    }
  }

  Future<String?> toggleCommunityPostLike(CommunityPostItem post) async {
    if (!isAuthenticated || accessToken == null) {
      return "Sign in to react to community posts.";
    }
    final index = communityFeed.indexWhere((item) => item.id == post.id);
    if (index < 0) return "Community post is unavailable.";
    final wasLiked = communityFeed[index].viewerReacted;
    communityFeed[index] = communityFeed[index].copyWith(
      viewerReacted: !wasLiked,
      reactionCount: wasLiked
          ? (communityFeed[index].reactionCount > 0
              ? communityFeed[index].reactionCount - 1
              : 0)
          : communityFeed[index].reactionCount + 1,
    );
    notifyListeners();
    try {
      if (wasLiked) {
        await _neighborhoodWatchService.removeReaction(
          accessToken: accessToken!,
          postId: post.id,
        );
      } else {
        await _neighborhoodWatchService.addReaction(
          accessToken: accessToken!,
          postId: post.id,
        );
      }
      return null;
    } on IncidentApiException catch (error) {
      communityFeed[index] = post;
      notifyListeners();
      return error.userMessage;
    } catch (_) {
      communityFeed[index] = post;
      notifyListeners();
      return "Unable to update your reaction. Try again.";
    }
  }

  Future<void> loadCommunityPatrols() async {
    final community = selectedCommunity;
    if (!isAuthenticated || accessToken == null || community == null) return;
    if (isDynamicAreaCommunityId(community.id)) {
      communityPatrols.clear();
      communityPatrolError = null;
      loadingCommunityPatrols = false;
      notifyListeners();
      return;
    }
    loadingCommunityPatrols = true;
    communityPatrolError = null;
    notifyListeners();
    try {
      communityPatrols
        ..clear()
        ..addAll(await _neighborhoodWatchService.listPatrols(
          accessToken: accessToken!,
          communityId: community.id,
        ));
    } on IncidentApiException catch (error) {
      communityPatrolError = error.userMessage;
    } catch (_) {
      communityPatrolError = "Unable to load patrol schedules.";
    } finally {
      loadingCommunityPatrols = false;
      notifyListeners();
    }
  }

  Future<String?> joinSelectedCommunity(String communityId) async {
    if (!isAuthenticated || accessToken == null) return "Sign in required";
    try {
      await _neighborhoodWatchService.joinCommunity(
        accessToken: accessToken!,
        communityId: communityId,
      );
      await loadCommunitiesFromApi(refresh: true);
      communityActionMessage = "Community join request submitted";
      notifyListeners();
      return null;
    } on IncidentApiException catch (error) {
      return error.userMessage;
    } catch (_) {
      return "Unable to join community.";
    }
  }

  Future<CommunitySummary> joinCommunityAndRefresh(String communityId) async {
    if (!isAuthenticated || accessToken == null) {
      throw StateError("Sign in required");
    }
    await _neighborhoodWatchService.joinCommunity(
      accessToken: accessToken!,
      communityId: communityId,
    );
    final updated = await _neighborhoodWatchService.getCommunity(
      accessToken: accessToken!,
      communityId: communityId,
    );
    final index = communities.indexWhere((item) => item.id == communityId);
    if (index >= 0) {
      communities[index] = updated;
    } else {
      communities.add(updated);
    }
    if (updated.isMember || updated.isPending) {
      selectedCommunity = updated;
    }
    communityActionMessage = updated.isPending
        ? "Community join request submitted"
        : "Community joined";
    notifyListeners();
    return updated;
  }

  Future<CommunitySummary> getCommunityPreview(String communityId) async {
    if (!isAuthenticated || accessToken == null) {
      throw StateError("Sign in required");
    }
    return _neighborhoodWatchService.getCommunity(
      accessToken: accessToken!,
      communityId: communityId,
    );
  }

  Future<String?> requestCommunity({
    required String name,
    required String country,
    String? description,
    String? state,
    String? lga,
    String? ward,
    String? estate,
    String? street,
    required String visibility,
  }) async {
    if (!isAuthenticated || accessToken == null) return "Sign in required";
    try {
      await _neighborhoodWatchService.createCommunityRequest(
        accessToken: accessToken!,
        name: name,
        country: country,
        description: description,
        state: state,
        lga: lga,
        ward: ward,
        estate: estate,
        street: street,
        visibility: visibility,
      );
      communityActionMessage = "Community request submitted for review";
      notifyListeners();
      return null;
    } on IncidentApiException catch (error) {
      return error.userMessage;
    } catch (_) {
      return "Unable to request community.";
    }
  }

  Future<String?> leaveSelectedCommunity() async {
    final community = selectedCommunity;
    if (community == null || !isAuthenticated || accessToken == null) {
      return "No community selected";
    }
    try {
      await _neighborhoodWatchService.leaveCommunity(
        accessToken: accessToken!,
        communityId: community.id,
      );
      await loadCommunitiesFromApi(refresh: true);
      if (selectedCommunity?.id == community.id) {
        final remaining =
            communities.where((item) => item.isMember).toList(growable: false);
        selectedCommunity = remaining.isEmpty ? null : remaining.first;
      }
      communityActionMessage = "You left the community";
      notifyListeners();
      return null;
    } on IncidentApiException catch (error) {
      return error.userMessage;
    } catch (_) {
      return "Unable to leave community.";
    }
  }

  Future<void> loadCommunityStatistics() async {
    final community = selectedCommunity;
    if (community == null || !isAuthenticated || accessToken == null) return;
    loadingCommunityStatistics = true;
    communityStatisticsError = null;
    notifyListeners();
    try {
      communityStatistics = await _neighborhoodWatchService.getStatistics(
        accessToken: accessToken!,
        communityId: community.id,
      );
    } on IncidentApiException catch (error) {
      communityStatisticsError = error.userMessage;
    } catch (_) {
      communityStatisticsError = "Unable to load community statistics.";
    } finally {
      loadingCommunityStatistics = false;
      notifyListeners();
    }
  }

  /// Community id last confirmed via NW `/context` with posting permission.
  String? nwContextCommunityId;
  bool nwContextCanPost = false;

  CommunityAccessStatus get selectedCommunityAccessStatus =>
      communityAccessStatus(
        selectedCommunity: selectedCommunity,
        currentAreaCommunityId: nwContextCommunityId,
      );

  /// Public: approved members, or presence participants confirmed by context.
  /// Private: approved membership still required.
  bool get canStartCommunityConversation =>
      evaluateCanStartCommunityConversation(
        isAuthenticated: isAuthenticated,
        community: selectedCommunity,
        nwContextCanPost: nwContextCanPost,
        nwContextCommunityId: nwContextCommunityId,
      );

  Future<String?> createCommunityPost({
    required String type,
    required String title,
    required String body,
    List<LocalEvidenceAttachment> attachments = const [],
    CommunityMediaUploadProgress? onMediaProgress,
    double? latitude,
    double? longitude,
    String? clientMessageId,
    String? replyToPostId,
  }) async {
    final community = selectedCommunity;
    if (community == null) {
      return "Confirm your current location before starting a conversation";
    }
    if (community.visibility == "Private" && !community.isMember) {
      return "Approved community membership is required";
    }
    if (!canStartCommunityConversation) {
      return "You cannot start a conversation in this community right now";
    }
    if (!isAuthenticated || accessToken == null) return "Sign in required";
    try {
      var media = const <CommunityPostMediaItem>[];
      if (attachments.isNotEmpty) {
        try {
          media = await _communityMediaUploadService.uploadForPost(
            communityId: community.id,
            attachments: attachments,
            accessToken: accessToken!,
            onProgress: onMediaProgress,
          );
        } on CommunityMediaUploadFailure catch (error) {
          return error.message;
        }
      }
      await _neighborhoodWatchService.createPost(
        accessToken: accessToken!,
        communityId: community.id,
        type: type,
        title: title,
        body: body,
        latitude: latitude,
        longitude: longitude,
        media: media,
        clientMessageId: clientMessageId,
        replyToPostId: replyToPostId,
      );
      await loadCommunityFeed(refresh: true);
      communityActionMessage = "Post submitted for verification";
      notifyListeners();
      return null;
    } on IncidentApiException catch (error) {
      return error.userMessage;
    } catch (_) {
      return "Unable to create community post.";
    }
  }

  Future<String?> updateOwnCommunityMessage(
    CommunityPostItem post,
    String body,
  ) async {
    if (!isAuthenticated || accessToken == null) return "Sign in required";
    try {
      final updated = await _neighborhoodWatchService.updateOwnPost(
        accessToken: accessToken!,
        postId: post.id,
        body: body,
      );
      final index = communityFeed.indexWhere((item) => item.id == post.id);
      if (index >= 0) communityFeed[index] = updated;
      notifyListeners();
      return null;
    } on IncidentApiException catch (error) {
      return error.userMessage;
    } catch (_) {
      return "Unable to edit this message.";
    }
  }

  Future<String?> deleteOwnCommunityMessage(CommunityPostItem post) async {
    if (!isAuthenticated || accessToken == null) return "Sign in required";
    try {
      await _neighborhoodWatchService.deleteOwnPost(
        accessToken: accessToken!,
        postId: post.id,
      );
      communityFeed.removeWhere((item) => item.id == post.id);
      notifyListeners();
      return null;
    } on IncidentApiException catch (error) {
      return error.userMessage;
    } catch (_) {
      return "Unable to delete this message.";
    }
  }

  Future<void> loadBroadcastsFromApi({bool refresh = false}) async {
    if (!isAuthenticated || accessToken == null) {
      broadcasts.clear();
      broadcastLoadError = null;
      broadcastNextCursor = null;
      broadcastUnreadCount = 0;
      notifyListeners();
      return;
    }
    if (refresh) {
      broadcastNextCursor = null;
    }
    loadingBroadcasts = true;
    broadcastLoadError = null;
    notifyListeners();
    try {
      final page = await _broadcastFeedService.listCountryWide(
        accessToken: accessToken!,
        cursor: refresh ? null : broadcastNextCursor,
      );
      if (refresh || broadcastNextCursor == null) {
        broadcasts
          ..clear()
          ..addAll(page.items);
      } else {
        final existingIds = broadcasts.map((item) => item.id).toSet();
        broadcasts.addAll(
          page.items.where((item) => !existingIds.contains(item.id)),
        );
      }
      broadcastNextCursor = page.nextCursor;
      broadcastUnreadCount = await _broadcastFeedService.unreadCount(
        accessToken: accessToken!,
      );
      final cacheScope = _notificationCacheScope;
      if (cacheScope != null) {
        await _broadcastFeedCache.save(cacheScope, broadcasts);
      }
    } on IncidentApiException catch (error) {
      broadcastLoadError = error.userMessage;
      final cacheScope = _notificationCacheScope;
      if (cacheScope != null && broadcasts.isEmpty) {
        broadcasts
          ..clear()
          ..addAll(await _broadcastFeedCache.load(cacheScope));
      }
    } catch (error) {
      broadcastLoadError = error is StateError
          ? error.message
          : "Unable to load safety broadcasts.";
    } finally {
      loadingBroadcasts = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreBroadcasts() async {
    if (!isAuthenticated ||
        accessToken == null ||
        broadcastNextCursor == null ||
        loadingMoreBroadcasts) {
      return;
    }
    loadingMoreBroadcasts = true;
    notifyListeners();
    try {
      final page = await _broadcastFeedService.listCountryWide(
        accessToken: accessToken!,
        cursor: broadcastNextCursor,
      );
      final existingIds = broadcasts.map((item) => item.id).toSet();
      broadcasts.addAll(
        page.items.where((item) => !existingIds.contains(item.id)),
      );
      broadcastNextCursor = page.nextCursor;
    } on IncidentApiException catch (error) {
      broadcastLoadError = error.userMessage;
    } finally {
      loadingMoreBroadcasts = false;
      notifyListeners();
    }
  }

  Future<void> markBroadcastRead(String broadcastId) async {
    if (!isAuthenticated || accessToken == null) return;
    final index = broadcasts.indexWhere((item) => item.id == broadcastId);
    if (index >= 0 && !broadcasts[index].read) {
      broadcasts[index] = broadcasts[index].copyWith(read: true);
      broadcastUnreadCount =
          broadcastUnreadCount > 0 ? broadcastUnreadCount - 1 : 0;
      notifyListeners();
    }
    try {
      await _broadcastFeedService.markRead(
        accessToken: accessToken!,
        broadcastId: broadcastId,
      );
    } catch (_) {}
  }

  void upsertBroadcastFeedItem(BroadcastFeedItem item) {
    final index = broadcasts.indexWhere((entry) => entry.id == item.id);
    if (index >= 0) {
      broadcasts[index] = item.copyWith(read: false);
    } else {
      broadcasts.insert(0, item.copyWith(read: false));
      broadcastUnreadCount += 1;
    }
    notifyListeners();
    final cacheScope = _notificationCacheScope;
    if (cacheScope != null) {
      unawaited(_broadcastFeedCache.save(cacheScope, broadcasts));
    }
  }

  Future<SessionRestoreResult> restoreSession() async {
    if (_biometricUnlockRequired) {
      return const SessionRestoreResult(
        status: SessionRestoreStatus.biometricRequired,
      );
    }
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
      _cachedCitizenProfile = result.citizenProfile;
      await _applyRestoredSession(result.session!);
    } else if (result.status == SessionRestoreStatus.failed ||
        result.status == SessionRestoreStatus.unauthenticated) {
      _cachedSession = null;
      _sessionAccessToken = null;
      clearCitizenProfileCache();
      notifyListeners();
    }
    return result;
  }

  Future<void> _applyRestoredSession(AuthSession session) async {
    _cachedSession = session;
    _sessionAccessToken = session.accessToken;
    notifyListeners();
    await _backgroundPushContextPersister(
      accessToken: session.accessToken,
      apiBaseUrl: theEyeApiUrl,
    );
    await _pushNotifications?.syncTokenWithBackend();
    unawaited(loadVehicleGarage(refresh: true));
    unawaited(loadIncidentsFromApi());
    unawaited(loadNotificationsFromApi(refresh: true));
    unawaited(refreshComposeDrafts());
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
  List<CarProfile> vehicles = const [];
  CarProfile? get carProfile => primaryVehicle;
  CarProfile? get primaryVehicle {
    for (final vehicle in vehicles) {
      if (vehicle.isPrimary) return vehicle;
    }
    return vehicles.isNotEmpty ? vehicles.first : null;
  }

  ThemeMode get themeMode => _themeProvider.themeMode;
  ThemePreference get themePreference => _themeProvider.preference;

  Future<void> setThemePreference(ThemePreference preference) async {
    await _themeProvider.setPreference(preference);
    notifyListeners();
  }

  Future<void> _loadVehicleGarageCache() async {
    vehicles = await _vehicleGarageStore.loadVehicles();
    notifyListeners();
  }

  Future<void> loadVehicleGarage({bool refresh = false}) async {
    if (refresh || vehicles.isEmpty) {
      vehicles = await _vehicleGarageStore.loadVehicles();
      notifyListeners();
    }
    final token = accessToken;
    if (token == null || token.isEmpty) return;

    final api = _apiClient;
    try {
      var remote = await api.listMyVehicles(accessToken: token);
      if (remote.isEmpty) {
        final legacy = await _vehicleGarageStore.loadLegacyCarProfile();
        if (legacy != null && legacy.hasRequiredFields) {
          final created = await api.createMyVehicle(
            accessToken: token,
            payload: {
              "make": legacy.make,
              "model": legacy.model,
              "plateNumber": legacy.plateNumber,
              if (legacy.year != null) "year": legacy.year,
              if ((legacy.color ?? "").trim().isNotEmpty) "color": legacy.color,
              if ((legacy.vin ?? "").trim().isNotEmpty) "vin": legacy.vin,
              "isPrimary": true,
            },
          );
          remote = [created];
          await _vehicleGarageStore.clearLegacyCarProfile();
        }
      }
      final merged = _mergeRemoteVehicles(
        remote,
        previous: vehicles,
      );
      vehicles = merged;
      await _vehicleGarageStore.saveVehicles(vehicles);
      notifyListeners();
    } catch (_) {
      // Keep cached vehicles for offline display when garage sync fails.
    }
  }

  Future<CarProfile> addVehicle(CarProfile profile) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw StateError("Sign in to add vehicles");
    }
    final api = _apiClient;
    final created = await api.createMyVehicle(
      accessToken: token,
      payload: {
        "make": profile.make,
        "model": profile.model,
        "plateNumber": profile.plateNumber,
        if (profile.year != null) "year": profile.year,
        if ((profile.color ?? "").trim().isNotEmpty) "color": profile.color,
        if ((profile.vin ?? "").trim().isNotEmpty) "vin": profile.vin,
        if (profile.isPrimary) "isPrimary": true,
      },
    );
    final merged =
        _mergeRemoteVehicles([created], previous: vehicles, replace: false);
    vehicles = _upsertVehicle(
        merged,
        _fromApiVehicle(created).copyWith(
          imagePath: profile.photos.isNotEmpty
              ? profile.photos.first.previewUrl
              : profile.imagePath,
          photos: profile.photos,
          notes: profile.notes,
        ));
    await _vehicleGarageStore.saveVehicles(vehicles);
    notifyListeners();
    return vehicles.firstWhere((item) => item.id == created.id);
  }

  Future<CarProfile> updateVehicle(CarProfile profile) async {
    final token = accessToken;
    final vehicleId = profile.id;
    if (token == null ||
        token.isEmpty ||
        vehicleId == null ||
        vehicleId.isEmpty) {
      throw StateError("Sign in and select a valid vehicle");
    }
    final api = _apiClient;
    final updated = await api.updateMyVehicle(
      accessToken: token,
      vehicleId: vehicleId,
      payload: {
        "make": profile.make,
        "model": profile.model,
        "plateNumber": profile.plateNumber,
        "year": profile.year,
        "color": profile.color,
        "vin": profile.vin,
        "isPrimary": profile.isPrimary,
      },
    );
    vehicles = _upsertVehicle(
      _mergeRemoteVehicles([updated], previous: vehicles, replace: false),
      _fromApiVehicle(updated).copyWith(
        imagePath: profile.photos.isNotEmpty
            ? profile.photos.first.previewUrl
            : profile.imagePath,
        photos: profile.photos,
        notes: profile.notes,
      ),
    );
    await _vehicleGarageStore.saveVehicles(vehicles);
    notifyListeners();
    return vehicles.firstWhere((item) => item.id == updated.id);
  }

  Future<void> setPrimaryVehicle(String vehicleId) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw StateError("Sign in to update primary vehicle");
    }
    final api = _apiClient;
    final updated = await api.setMyVehiclePrimary(
      accessToken: token,
      vehicleId: vehicleId,
    );
    vehicles =
        _mergeRemoteVehicles([updated], previous: vehicles, replace: false);
    await loadVehicleGarage(refresh: true);
  }

  Future<void> deleteVehicle(String vehicleId) async {
    final token = accessToken;
    if (token == null || token.isEmpty) {
      throw StateError("Sign in to delete vehicles");
    }
    final api = _apiClient;
    await api.deleteMyVehicle(accessToken: token, vehicleId: vehicleId);
    vehicles =
        vehicles.where((item) => item.id != vehicleId).toList(growable: false);
    await _vehicleGarageStore.saveVehicles(vehicles);
    notifyListeners();
    await loadVehicleGarage(refresh: true);
  }

  List<CarProfile> _mergeRemoteVehicles(
    List<CitizenVehicleRecord> remote, {
    required List<CarProfile> previous,
    bool replace = true,
  }) {
    final previousById = {
      for (final item in previous)
        if (item.id != null && item.id!.isNotEmpty) item.id!: item
    };
    final previousByPlate = {
      for (final item in previous) item.plateNumber.trim().toUpperCase(): item
    };
    final remoteMapped = remote.map((item) {
      final byId = previousById[item.id];
      final byPlate = previousByPlate[item.plateNumber.trim().toUpperCase()];
      final photos = item.photos
          .map(
            (photo) => CarPhotoRef(
              id: photo.id,
              objectKey: photo.objectKey,
              contentType: photo.contentType,
              angle: photo.angle,
              sizeBytes: photo.sizeBytes,
              sortOrder: photo.sortOrder,
              createdAt: photo.createdAt,
              previewUrl: photo.signedGetUrl,
            ),
          )
          .toList(growable: false);
      final resolvedPhotos = photos.isNotEmpty
          ? photos
          : (byId?.photos ?? byPlate?.photos ?? const <CarPhotoRef>[]);
      final firstPhotoPreview =
          resolvedPhotos.isNotEmpty ? resolvedPhotos.first.previewUrl : null;
      return _fromApiVehicle(item).copyWith(
        imagePath: firstPhotoPreview ?? byId?.imagePath ?? byPlate?.imagePath,
        photos: resolvedPhotos,
        notes: byId?.notes ?? byPlate?.notes,
      );
    }).toList(growable: false);
    if (replace) return remoteMapped;

    final next = previous.toList(growable: true);
    for (final remoteVehicle in remoteMapped) {
      final index = next.indexWhere((item) => item.id == remoteVehicle.id);
      if (index >= 0) {
        next[index] = remoteVehicle;
      } else {
        next.add(remoteVehicle);
      }
    }
    return _reconcilePrimary(next);
  }

  CarProfile _fromApiVehicle(CitizenVehicleRecord record) {
    final photos = record.photos
        .map(
          (photo) => CarPhotoRef(
            id: photo.id,
            objectKey: photo.objectKey,
            contentType: photo.contentType,
            angle: photo.angle,
            sizeBytes: photo.sizeBytes,
            sortOrder: photo.sortOrder,
            createdAt: photo.createdAt,
            previewUrl: photo.signedGetUrl,
          ),
        )
        .toList(growable: false);
    return CarProfile(
      id: record.id,
      make: record.make,
      model: record.model,
      plateNumber: record.plateNumber,
      year: record.year,
      color: record.color,
      vin: record.vin,
      imagePath: photos.isNotEmpty ? photos.first.previewUrl : null,
      photos: photos,
      isPrimary: record.isPrimary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    );
  }

  List<CarProfile> _upsertVehicle(List<CarProfile> source, CarProfile updated) {
    final next = source.toList(growable: true);
    final index = next.indexWhere((item) => item.id == updated.id);
    if (index >= 0) {
      next[index] = updated;
    } else {
      next.insert(0, updated);
    }
    return _reconcilePrimary(next);
  }

  List<CarProfile> _reconcilePrimary(List<CarProfile> source) {
    final next = source.toList(growable: false);
    final primaryCount = next.where((item) => item.isPrimary).length;
    if (primaryCount <= 1) return next;
    var found = false;
    return next.map((item) {
      if (!item.isPrimary) return item;
      if (!found) {
        found = true;
        return item;
      }
      return item.copyWith(isPrimary: false);
    }).toList(growable: false);
  }

  Future<void> saveCarProfile(CarProfile profile) async {
    if (profile.id != null && profile.id!.isNotEmpty) {
      await updateVehicle(profile);
      return;
    }
    await addVehicle(profile);
  }

  Future<void> clearCarProfile() async {
    final primary = primaryVehicle;
    if (primary?.id != null && primary!.id!.isNotEmpty) {
      await deleteVehicle(primary.id!);
      return;
    }
    await _vehicleGarageStore.clear();
    vehicles = const [];
    notifyListeners();
  }

  void _onThemeChanged() {
    notifyListeners();
  }

  @override
  void dispose() {
    _locationCoordinator?.stopTracking();
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
      if (result.incidentId != null) {
        unawaited(
          activateActiveEmergency(
            result.incidentId!,
            silent: result.silent || draft.silent,
          ),
        );
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
        unawaited(
          activateActiveEmergency(
            result.incidentId!,
            silent: result.silent,
          ),
        );
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
    this.publicReference,
    this.displayStatus,
  });

  final String id;
  final String type;
  final String status;
  final String agency;
  final int confidence;
  final String verificationStatus;
  final DateTime? submittedAt;
  final String? publicReference;
  final String? displayStatus;
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

    if (restore.status == SessionRestoreStatus.restored) {
      final active = await controller.restoreActiveEmergency();
      if (active != null && mounted) {
        await controller.startIncidentLocationTracking(active.incidentId);
        await ActiveEmergencyNavigation.open(
          context,
          controller,
          incidentId: active.incidentId,
          silent: active.silent,
          replace: true,
        );
        StartupDiagnostics.checkpoint("STARTUP 5: /active-emergency visible");
        return;
      }
    }

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
  const LoginRegisterScreen({
    super.key,
    this.authService,
  });

  final AuthService? authService;

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
  String? formSuccess;
  bool submitting = false;
  bool forgotPasswordBusy = false;
  bool obscurePassword = true;
  bool biometricBusy = false;
  bool _loadedBiometricCapability = false;
  bool _didAutoPromptBiometrics = false;
  BiometricCapability biometricCapability =
      const BiometricCapability.unavailable();
  SocialAuthProvider? activeSocialProvider;
  DateTime? _socialSignInStartedAt;

  bool get socialBusy => activeSocialProvider != null;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loadedBiometricCapability) {
      _loadedBiometricCapability = true;
      final scopedSession =
          context.dependOnInheritedWidgetOfExactType<AppScope>()?.notifier;
      if (scopedSession is AppController) {
        unawaited(_loadBiometricCapability(scopedSession));
      }
    }
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map && args["authReturnMessage"] is String) {
      final message = (args["authReturnMessage"] as String).trim();
      if (message.isNotEmpty && formSuccess != message) {
        formSuccess = message;
      }
    }
  }

  Future<void> _loadBiometricCapability(AppController controller) async {
    final capability = await controller.biometricCapability();
    if (!mounted) return;
    setState(() => biometricCapability = capability);
    if (controller.biometricUnlockRequired &&
        capability.canAuthenticate &&
        !_didAutoPromptBiometrics) {
      _didAutoPromptBiometrics = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) unawaited(_unlockWithBiometrics());
      });
    }
  }

  Future<void> _unlockWithBiometrics() async {
    if (biometricBusy) return;
    setState(() {
      biometricBusy = true;
      formError = null;
    });
    final result = await appOf(context).unlockWithBiometrics();
    if (!mounted) return;
    if (result.isSuccess) {
      Navigator.of(context).pushReplacementNamed(
        result.profileComplete ? "/home" : "/profile",
      );
      return;
    }
    setState(() {
      biometricBusy = false;
      formError = _biometricMessage(result.status);
    });
  }

  String _biometricMessage(BiometricAuthenticationStatus status) {
    return switch (status) {
      BiometricAuthenticationStatus.cancelled =>
        "Biometric unlock was cancelled. You can still sign in normally.",
      BiometricAuthenticationStatus.lockedOut =>
        "Biometrics are temporarily locked. Unlock your device, then try again or sign in normally.",
      BiometricAuthenticationStatus.notEnrolled =>
        "No fingerprint or face is enrolled on this device. Sign in normally to continue.",
      BiometricAuthenticationStatus.unavailable =>
        "Biometric unlock is unavailable on this device. Sign in normally to continue.",
      _ => "Biometric unlock did not succeed. Sign in normally or try again.",
    };
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
      formSuccess = null;
    });

    final controller = appOf(context);
    final result = await controller.authService.login(
      identifier: _identifierController.text,
      password: _passwordController.text,
      remainSignedIn: controller.remainSignedIn,
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
          ? await controller.socialAuthService.signInWithGoogle(
              remainSignedIn: controller.remainSignedIn,
            )
          : await controller.socialAuthService.signInWithApple(
              remainSignedIn: controller.remainSignedIn,
            );
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
    if (submitting || forgotPasswordBusy || socialBusy) return;

    final parsed = parseLoginIdentifier(_identifierController.text);
    final authService = widget.authService ?? appOf(context).authService;

    setState(() {
      forgotPasswordBusy = true;
      formError = null;
      formSuccess = null;
    });
    try {
      if (parsed.kind == LoginIdentifierKind.phone &&
          isValidPhoneNumber(_identifierController.text)) {
        final result = await authService.requestPhoneOtp(parsed.phone!);
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

      final result =
          await authService.requestPasswordReset(_identifierController.text);
      if (!mounted) return;
      setState(() {
        if (result.isSuccess) {
          formSuccess = result.userMessage ??
              "If an account matches that email, password-reset instructions have been sent.";
          formError = null;
        } else {
          formError = result.userMessage ??
              "We couldn’t process your request right now.";
          formSuccess = null;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        formError = "We couldn’t process your request right now.";
        formSuccess = null;
      });
    } finally {
      if (mounted) {
        setState(() => forgotPasswordBusy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scopedSession =
        context.dependOnInheritedWidgetOfExactType<AppScope>()?.notifier;
    final appController = scopedSession is AppController ? scopedSession : null;
    final canSubmit = !submitting &&
        !socialBusy &&
        _identifierController.text.trim().isNotEmpty &&
        _passwordController.text.isNotEmpty;
    final semantics = EyeSemanticColors.of(context);

    return Scaffold(
      backgroundColor: semantics.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 42, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Welcome back!",
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: semantics.bodyText,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                "Glad to have you back",
                style: TextStyle(fontSize: 16, color: semantics.secondaryText),
              ),
              const SizedBox(height: 32),
              Text("Email", style: EyeInputTheme.labelStyle(context)),
              const SizedBox(height: 8),
              TextField(
                controller: _identifierController,
                style: EyeInputTheme.textStyle(context),
                cursorColor: EyeInputTheme.focusBorderColor(context),
                decoration: EyeInputTheme.decoration(
                  context,
                  hintText: "Enter your correct email",
                  errorText: identifierError,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
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
              Text("Password", style: EyeInputTheme.labelStyle(context)),
              const SizedBox(height: 8),
              TextField(
                controller: _passwordController,
                obscureText: obscurePassword,
                style: EyeInputTheme.textStyle(context),
                cursorColor: EyeInputTheme.focusBorderColor(context),
                decoration: EyeInputTheme.decoration(
                  context,
                  hintText: "Enter password",
                  errorText: passwordError,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                  suffixIcon: IconButton(
                    onPressed: () =>
                        setState(() => obscurePassword = !obscurePassword),
                    icon: Icon(
                      obscurePassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: semantics.secondaryText,
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
                  onPressed: (submitting || forgotPasswordBusy || socialBusy)
                      ? null
                      : _handleForgotPassword,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    forgotPasswordBusy ? "Sending…" : "Forgot password?",
                    style: EyeTypography.linkFor(context),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: (submitting || forgotPasswordBusy)
                      ? null
                      : () =>
                          Navigator.of(context).pushNamed("/account-recovery"),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    "Recover account",
                    style: EyeTypography.linkFor(context),
                  ),
                ),
              ),
              if (formSuccess != null) ...[
                const SizedBox(height: 8),
                Semantics(
                  liveRegion: true,
                  label: formSuccess!,
                  child: Material(
                    color: semantics.success.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Icon(Icons.check_circle_outline,
                              color: semantics.success),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              formSuccess!,
                              style: TextStyle(
                                color: semantics.bodyText,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
              if (formError != null) ...[
                const SizedBox(height: 8),
                Semantics(
                  liveRegion: true,
                  label: formError!,
                  child: Text(
                    formError!,
                    style: TextStyle(
                      color: semantics.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: canSubmit
                      ? EyeSemanticColors.of(context).primaryAction
                      : BrandColors.authInactive,
                  foregroundColor: canSubmit
                      ? EyeSemanticColors.of(context).primaryActionForeground
                      : BrandColors.ash,
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
              if (appController?.biometricUnlockRequired == true) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: submitting || socialBusy || biometricBusy
                      ? null
                      : _unlockWithBiometrics,
                  icon: biometricBusy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          biometricCapability.kind == BiometricKind.face
                              ? Icons.face_outlined
                              : Icons.fingerprint,
                        ),
                  label: Text(
                    biometricCapability.enrolled
                        ? "Unlock with ${biometricCapability.name}"
                        : "Unlock with biometrics",
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Center(
                child: Text(
                  "Or",
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: EyeSemanticColors.of(context).secondaryText,
                  ),
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
                child: Text(
                  "Continue without signing in",
                  style: EyeTypography.linkFor(context),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text.rich(
                  TextSpan(
                    style: TextStyle(
                      fontSize: 14,
                      color: EyeSemanticColors.of(context).bodyText,
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
                          child: Text(
                            "Create an account",
                            style: EyeTypography.linkFor(context),
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
      remainSignedIn: controller.remainSignedIn,
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

  InputDecoration _fieldDecoration(
    BuildContext context, {
    required String hintText,
    String? errorText,
    Widget? suffixIcon,
  }) {
    return EyeInputTheme.decoration(
      context,
      hintText: hintText,
      errorText: errorText,
      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
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
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
            color: EyeSemanticColors.of(context).bodyText,
          ),
        ),
        const SizedBox(height: 8),
        field,
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final canSubmit = !submitting &&
        _emailController.text.trim().isNotEmpty &&
        _firstNameController.text.trim().isNotEmpty &&
        _lastNameController.text.trim().isNotEmpty &&
        _passwordController.text.isNotEmpty &&
        _confirmPasswordController.text.isNotEmpty;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        foregroundColor: semantics.bodyText,
        title: const Text("Create account"),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Join THE EYE",
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: semantics.bodyText,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                "Create your citizen account with email",
                style: TextStyle(fontSize: 16, color: semantics.secondaryText),
              ),
              const SizedBox(height: 24),
              _labeledField(
                label: "Email",
                field: TextField(
                  controller: _emailController,
                  decoration: _fieldDecoration(
                    context,
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
                    context,
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
                    context,
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
                    context,
                    hintText: "At least 8 characters",
                    errorText: passwordError,
                    suffixIcon: IconButton(
                      onPressed: () =>
                          setState(() => obscurePassword = !obscurePassword),
                      icon: Icon(
                        obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: semantics.secondaryText,
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
                    context,
                    hintText: "Re-enter password",
                    errorText: confirmPasswordError,
                    suffixIcon: IconButton(
                      onPressed: () => setState(() =>
                          obscureConfirmPassword = !obscureConfirmPassword),
                      icon: Icon(
                        obscureConfirmPassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: semantics.secondaryText,
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
                      ? EyeSemanticColors.of(context).primaryAction
                      : BrandColors.authInactive,
                  foregroundColor: canSubmit
                      ? EyeSemanticColors.of(context).primaryActionForeground
                      : BrandColors.ash,
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
                    style: TextStyle(
                      fontSize: 14,
                      color: semantics.bodyText,
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
                          child: Text(
                            "Log in",
                            style: EyeTypography.linkFor(context),
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
    final semantics = EyeSemanticColors.of(context);
    return Semantics(
      button: true,
      label: semanticLabel,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          side: BorderSide(color: semantics.interactiveText, width: 1),
          foregroundColor: semantics.interactiveText,
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
                  Icon(icon, size: 28, color: semantics.interactiveText),
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
      remainSignedIn: controller.remainSignedIn,
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

  static const _terminalIncidentStatuses = {
    "Resolved",
    "Closed",
    "FalseReport",
    "CancelledByReporter",
    "ExpiredAfterReview",
  };

  void _openIncidentFromHome(
    BuildContext context,
    IncidentTrackingItem incident,
  ) {
    final incidentId = incident.id.trim();
    if (incidentId.isEmpty) return;
    if (_terminalIncidentStatuses.contains(incident.status)) {
      Navigator.of(context)
          .pushNamed("/incident-detail", arguments: incidentId);
      return;
    }
    Navigator.of(context).pushNamed(
      "/active-emergency/$incidentId",
      arguments: {
        "incidentId": incidentId,
        "silent": false,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    return SafetyScaffold(
      title: "Home",
      selectedIndex: 0,
      useFigmaShell: true,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding:
              const EdgeInsets.only(bottom: EyeTokens.contentBottomClearance),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  IconButton(
                    tooltip: "Incident history",
                    onPressed: () =>
                        Navigator.of(context).pushNamed("/tracking"),
                    icon: Icon(
                      Icons.history,
                      color: EyeSemanticColors.of(context).interactiveText,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: "Notifications",
                    onPressed: () =>
                        Navigator.of(context).pushNamed("/notifications"),
                    icon: Icon(
                      Icons.notifications_none,
                      color: EyeSemanticColors.of(context).interactiveText,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: StatusStrip(controller: controller),
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
                childAspectRatio: 1.15,
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
                    title: "Incident Tracking",
                    description:
                        "Track active reports and review incident status updates",
                    icon: Icons.route,
                    onTap: () => Navigator.of(context).pushNamed("/tracking"),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                title: "All services",
                child: GridView.count(
                  crossAxisCount:
                      MediaQuery.sizeOf(context).width > 640 ? 3 : 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.35,
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
                        () =>
                            Navigator.of(context).pushNamed("/missing-person")),
                    ActionTile(
                        "Stolen vehicle",
                        Icons.directions_car,
                        Colors.blueGrey.shade700,
                        () =>
                            Navigator.of(context).pushNamed("/stolen-vehicle")),
                    ActionTile(
                        "Danger Trigger",
                        Icons.warning_amber_rounded,
                        Colors.amber.shade800,
                        () =>
                            Navigator.of(context).pushNamed("/danger-trigger")),
                    ActionTile(
                        "Neighborhood Watch",
                        Icons.groups,
                        Colors.teal.shade800,
                        () => Navigator.of(context)
                            .pushNamed("/neighborhood-watch")),
                    ActionTile(
                        "Help & Support",
                        Icons.support_agent,
                        Colors.blue.shade800,
                        () => Navigator.of(context).pushNamed("/support")),
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
                      .map(
                        (incident) => IncidentStatusTile(
                          incident: incident,
                          onTap: () => _openIncidentFromHome(context, incident),
                        ),
                      )
                      .toList(),
                ),
              ),
            ),
          ],
        ),
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
      final contacts = await controller.apiClient.listEmergencyContacts(
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
      backgroundColor: EyeSemanticColors.of(context).background,
      body: Column(
        children: [
          EyePageHeader.secondary(title: widget.type.figmaTitle),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                16,
                8,
                16,
                EyeTokens.contentBottomClearance,
              ),
              children: [
                if (controller.showConnectivityBanner)
                  OfflineStatusBanner(state: controller.connectivityState),
                if (controller.showConnectivityBanner)
                  const SizedBox(height: 12),
                if (isEmergency) ...[
                  EyeOutlinedButton(
                    label: "Start live emergency video",
                    icon: const Icon(Icons.videocam, size: 20),
                    onPressed: () =>
                        Navigator.of(context).pushNamed("/live-video"),
                  ),
                  const SizedBox(height: 16),
                ],
                Text("Location of the incident",
                    style: EyeInputTheme.labelStyle(context)),
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
                  onChanged: (value) => setState(() => manualLocation = value),
                  title: Text(
                    "Manual location adjustment",
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  subtitle: Text(
                    "GPS is captured automatically",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
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
                  style: EyeInputTheme.labelStyle(context),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: descriptionController,
                  maxLines: isEmergency ? 5 : 4,
                  style: EyeInputTheme.textStyle(context),
                  cursorColor: EyeInputTheme.focusBorderColor(context),
                  decoration: EyeInputTheme.decoration(
                    context,
                    hintText: isEmergency
                        ? "Enter information about the injuries"
                        : "Describe what happened",
                    errorText: descriptionError,
                    radius: EyeTokens.radiusSm,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 12,
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
                  title: Text(
                    "Report anonymously",
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: notifyEmergencyContact,
                  onChanged: (value) {
                    setState(() => notifyEmergencyContact = value);
                    if (value) unawaited(_loadEmergencyContacts());
                    _scheduleComposeDraftSave();
                  },
                  title: Text(
                    "Notify emergency contact",
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
                if (notifyEmergencyContact) ...[
                  if (loadingEmergencyContacts)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: LinearProgressIndicator(),
                    )
                  else if (emergencyContacts.isEmpty)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        "No saved emergency contacts",
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      subtitle: Text(
                        "Add contacts from your profile",
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
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
                                    selectedEmergencyContactIds.add(contact.id);
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
    );
  }

  Future<void> _submit(BuildContext context, {bool urgent = false}) async {
    final trimmed = descriptionController.text.trim();
    final localMedia =
        _evidenceSectionKey.currentState?.attachments ?? const [];
    if (widget.type != ReportType.emergency &&
        !hasValidReportNarrative(
            description: trimmed, localMedia: localMedia)) {
      setState(() => descriptionError =
          "Add a description, voice recording, or photo/video evidence");
      showAppSnackBar(context,
          "Add a description, voice recording, or photo/video evidence.",
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
      description:
          trimmed.isEmpty && draftHasVoiceAttachment(localMedia: localMedia)
              ? normalizeVoiceOnlyDescription(widget.type.label)
              : trimmed.isEmpty
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

    try {
      final result = await controller.submitIncident(
        draft,
        onEvidenceProgress: (localId, progress) {
          if (progress >= 1) {
            _evidenceSectionKey.currentState?.markUploaded(localId);
          } else {
            _evidenceSectionKey.currentState?.markUploading(localId, progress);
          }
        },
      ).timeout(kSosSubmissionTimeout);

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
        showAppSnackBar(
            context, result.userMessage ?? "Unable to submit report.",
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
        await controller.deleteComposeDraft(composeDraftId);
        showAppSnackBar(
            context,
            urgent
                ? ActiveEmergencyNavigation.receivedCopy
                : "${widget.type.label} report submitted.");
      } else if (result.isQueued || result.canRetry) {
        showAppSnackBar(context,
            result.userMessage ?? "${widget.type.label} saved for retry.");
      } else {
        showAppSnackBar(
            context, result.userMessage ?? "Unable to submit report.",
            isError: true);
        return;
      }

      await ActiveEmergencyNavigation.openAfterSubmission(
        context,
        controller,
        result,
      );
    } on TimeoutException {
      if (!context.mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, "Report submission timed out (ERR-INC-408).",
          isError: true);
    } catch (_) {
      if (!context.mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, "Unable to submit report (ERR-INC-500).",
          isError: true);
    }
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
  final ageController = TextEditingController();
  final lastSeenLocationController = TextEditingController();
  final physicalController = TextEditingController();
  final clothingController = TextEditingController();
  final additionalController = TextEditingController();
  final _evidenceSectionKey = GlobalKey<ManagedEvidenceSectionState>();
  String? _gender;
  String _ageMode = MissingPersonAge.exactMode;
  String? _ageRange;
  DateTime? _lastSeenDate;
  TimeOfDay? _lastSeenTime;
  bool submitting = false;
  bool consent = false;

  DateTime? get _lastSeenAt {
    final date = _lastSeenDate;
    final time = _lastSeenTime;
    if (date == null || time == null) return null;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  @override
  void dispose() {
    fullNameController.dispose();
    ageController.dispose();
    lastSeenLocationController.dispose();
    physicalController.dispose();
    clothingController.dispose();
    additionalController.dispose();
    super.dispose();
  }

  Future<void> _pickLastSeenDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _lastSeenDate ?? now,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now,
    );
    if (date == null || !mounted) return;
    setState(() => _lastSeenDate = date);
  }

  Future<void> _pickLastSeenTime() async {
    final time = await showCitizenTimePicker(
      context,
      initialTime: _lastSeenTime ?? TimeOfDay.now(),
    );
    if (time == null || !mounted) return;
    setState(() => _lastSeenTime = time);
  }

  String? get _resolvedAge {
    if (_ageMode == MissingPersonAge.exactMode) {
      return ageController.text.trim();
    }
    return _ageRange;
  }

  void _clearDraft() {
    fullNameController.clear();
    ageController.clear();
    lastSeenLocationController.clear();
    physicalController.clear();
    clothingController.clear();
    additionalController.clear();
    _evidenceSectionKey.currentState?.clearAttachments();
    _gender = null;
    _ageMode = MissingPersonAge.exactMode;
    _ageRange = null;
    _lastSeenDate = null;
    _lastSeenTime = null;
    consent = false;
  }

  Future<void> _submit() async {
    if (fullNameController.text.trim().isEmpty) {
      showAppSnackBar(context, "Enter the missing person's full name.",
          isError: true);
      return;
    }
    final ageValue = _resolvedAge;
    if (ageValue == null ||
        ageValue.isEmpty ||
        !MissingPersonAge.isValidAgeOrRange(ageValue)) {
      showAppSnackBar(
        context,
        "Enter an exact age or choose an approximate age range.",
        isError: true,
      );
      return;
    }
    if (_lastSeenDate == null) {
      showAppSnackBar(context, "Select the last seen date.", isError: true);
      return;
    }
    if (_lastSeenTime == null) {
      showAppSnackBar(context, "Select the last seen time.", isError: true);
      return;
    }
    if (physicalController.text.trim().isEmpty) {
      showAppSnackBar(context, "Enter a physical description.", isError: true);
      return;
    }
    if (clothingController.text.trim().isEmpty) {
      showAppSnackBar(context, "Describe what they were wearing.",
          isError: true);
      return;
    }
    if (!consent) {
      showAppSnackBar(context, "Confirm consent to publish this broadcast.",
          isError: true);
      return;
    }

    setState(() => submitting = true);
    final controller = appOf(context);
    if (controller.accessToken == null) {
      setState(() => submitting = false);
      showAppSnackBar(context, "Sign in to publish a broadcast.",
          isError: true);
      return;
    }
    final outcome = await captureLocationOutcome();
    if (!mounted) return;
    if (outcome.result != LocationCaptureResult.granted ||
        outcome.position == null) {
      setState(() => submitting = false);
      showAppSnackBar(context, locationFailureMessage(outcome.result),
          isError: true);
      return;
    }

    final lastSeenLocation = lastSeenLocationController.text.trim();
    final additional = additionalController.text.trim();
    try {
      final localEvidence =
          _evidenceSectionKey.currentState?.attachments ?? const [];
      var uploadedEvidence = const <Map<String, Object?>>[];
      if (localEvidence.isNotEmpty) {
        try {
          uploadedEvidence =
              await controller.broadcastMediaUploadService.uploadAttachments(
            attachments: localEvidence,
            accessToken: controller.accessToken!,
          );
        } on BroadcastMediaUploadFailure catch (error) {
          if (!mounted) return;
          setState(() => submitting = false);
          showAppSnackBar(context, error.message, isError: true);
          return;
        }
      }
      final result =
          await controller.broadcastSubmissionService.createMissingPerson(
        accessToken: controller.accessToken!,
        payload: {
          "clientBroadcastId": createClientSubmissionId(),
          "fullName": fullNameController.text.trim(),
          "ageOrApproximateAge": MissingPersonAge.normalizeForApi(ageValue),
          if (_gender != null) "gender": _gender,
          "lastSeenAt": _lastSeenAt!.toUtc().toIso8601String(),
          "lastSeenLatitude": outcome.position!.latitude,
          "lastSeenLongitude": outcome.position!.longitude,
          if (lastSeenLocation.isNotEmpty) "lastSeenAddress": lastSeenLocation,
          "clothingDescription": clothingController.text.trim(),
          "physicalDescription": physicalController.text.trim(),
          "contactMethod": "in_app",
          "reporterRelationship": "Reporter",
          "consentDeclaration": true,
          if (additional.isNotEmpty) "additionalDescription": additional,
          if (uploadedEvidence.isNotEmpty)
            "metadata": {"attachments": uploadedEvidence},
        },
      ).timeout(kSosSubmissionTimeout);
      if (!mounted) return;
      setState(() => submitting = false);
      _clearDraft();
      if (mounted) setState(() {});
      showAppSnackBar(
        context,
        result.duplicate
            ? "This broadcast was already published."
            : "Missing person broadcast is now live.",
      );
      unawaited(controller.loadBroadcastsFromApi(refresh: true));
      final route = broadcastDetailRoute(result.id);
      if (route != null) {
        await Navigator.of(context).pushReplacementNamed(
          route,
          arguments: const BroadcastDetailNavigationArgs(
            returnToCenterOnBack: true,
          ),
        );
      }
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, error.userMessage, isError: true);
    } on TimeoutException {
      if (!mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, "Broadcast publish timed out (ERR-BRD-408).",
          isError: true);
    } catch (error, stackTrace) {
      debugPrint(
        "Missing person broadcast publish failed: "
        "${safeBroadcastPublishErrorLog(error, stackTrace)}",
      );
      if (!mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, "Unable to publish broadcast (ERR-BRD-500).",
          isError: true);
    }
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
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.person_search,
                    size: 52, color: BrandColors.green),
                const SizedBox(height: 16),
                TextField(
                  controller: fullNameController,
                  decoration: const InputDecoration(labelText: "Full name"),
                ),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: MissingPersonAge.exactMode,
                      label: Text("Exact age"),
                    ),
                    ButtonSegment(
                      value: MissingPersonAge.rangeMode,
                      label: Text("Approx. range"),
                    ),
                  ],
                  selected: {_ageMode},
                  onSelectionChanged: submitting
                      ? null
                      : (value) => setState(() => _ageMode = value.first),
                ),
                const SizedBox(height: 12),
                if (_ageMode == MissingPersonAge.exactMode)
                  TextField(
                    controller: ageController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: "Exact age",
                      hintText: "e.g. 15",
                    ),
                  )
                else
                  DropdownButtonFormField<String>(
                    initialValue: _ageRange,
                    decoration: const InputDecoration(
                      labelText: "Approximate age range",
                    ),
                    items: [
                      for (final range in MissingPersonAge.approvedRanges)
                        DropdownMenuItem(value: range, child: Text(range)),
                    ],
                    onChanged: submitting
                        ? null
                        : (value) => setState(() => _ageRange = value),
                  ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _gender,
                  decoration: const InputDecoration(labelText: "Gender"),
                  items: const [
                    DropdownMenuItem(value: "Female", child: Text("Female")),
                    DropdownMenuItem(value: "Male", child: Text("Male")),
                    DropdownMenuItem(value: "Other", child: Text("Other")),
                    DropdownMenuItem(
                        value: "PreferNotToSay",
                        child: Text("Prefer not to say")),
                  ],
                  onChanged: (value) => setState(() => _gender = value),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text("Last seen date"),
                  subtitle: Text(
                    _lastSeenDate == null
                        ? "Tap to select date"
                        : CitizenDateTimeFormatter.formatDate(_lastSeenDate!),
                  ),
                  trailing: const Icon(Icons.event),
                  onTap: submitting ? null : _pickLastSeenDate,
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text("Last seen time"),
                  subtitle: Text(
                    _lastSeenTime == null
                        ? "Tap to select time"
                        : formatCitizenTimeOfDay(_lastSeenTime!),
                  ),
                  trailing: const Icon(Icons.schedule),
                  onTap: submitting ? null : _pickLastSeenTime,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: lastSeenLocationController,
                  decoration: const InputDecoration(
                    labelText: "Last seen location",
                    hintText: "Area, landmark, or address",
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: physicalController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: "Physical description",
                    hintText: "Height, build, hair, distinguishing features",
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: clothingController,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: "Clothing / what they were wearing",
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: additionalController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: "Additional information",
                    hintText: "Optional context that may help locate them",
                  ),
                ),
                const SizedBox(height: 12),
                ManagedEvidenceSection(
                  key: _evidenceSectionKey,
                  lowDataMode: appOf(context).lowDataMode,
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: consent,
                  onChanged: submitting
                      ? null
                      : (value) => setState(() => consent = value ?? false),
                  title: const Text(
                    "I confirm this information is accurate and I consent to publish this broadcast.",
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: submitting ? null : _submit,
                  child: submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
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
  const LiveVideoRouteArgs({
    this.autoStartStream = false,
    this.incidentId,
    this.returnToActiveEmergency = false,
  });

  final bool autoStartStream;
  final String? incidentId;
  final bool returnToActiveEmergency;
}

class LiveVideoReturnResult {
  const LiveVideoReturnResult({this.errorMessage});

  final String? errorMessage;
}

class LiveEmergencyVideoScreen extends StatefulWidget {
  const LiveEmergencyVideoScreen({
    this.autoStartStream = false,
    this.incidentId,
    this.returnToActiveEmergency = false,
    super.key,
  });

  final bool autoStartStream;
  final String? incidentId;
  final bool returnToActiveEmergency;

  @override
  State<LiveEmergencyVideoScreen> createState() =>
      _LiveEmergencyVideoScreenState();
}

class _LiveEmergencyVideoScreenState extends State<LiveEmergencyVideoScreen> {
  TheEyeApiClient get apiClient => appOf(context).apiClient;
  late final LiveVideoSessionController liveVideoController =
      LiveVideoSessionController();
  bool lowBandwidth = true;
  bool startingStream = false;
  bool stoppingStream = false;
  bool _streamStartInFlight = false;
  LiveVideoStartupPhase _startupPhase = LiveVideoStartupPhase.idle;
  final LiveVideoStartupTrace _startupTrace = LiveVideoStartupTrace();
  bool permissionDenied = false;
  String? permissionError;
  String? locationStatusMessage;
  String? activeIncidentId;
  String roomName = "eye-incident-active-emergency";
  String liveSessionId = "";
  Position? latestPosition;
  DateTime? lastCapturedAt;
  EmergencyLocationListener? _locationListener;
  AppController? _appController;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    if (widget.incidentId != null && widget.incidentId!.isNotEmpty) {
      activeIncidentId = widget.incidentId;
      roomName = "eye-incident-${widget.incidentId}";
    }
    liveVideoController.addListener(_onLiveVideoChanged);
    unawaited(_initializeLiveVideo());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _appController ??= appOf(context);
  }

  Future<void> _initializeLiveVideo() async {
    if (!widget.autoStartStream) {
      await _preparePreview();
    }
    if (!mounted || _disposed || !widget.autoStartStream || streaming) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _disposed || streaming) return;
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
    _disposed = true;
    _startupPhase = LiveVideoStartupPhase.disposed;
    final listener = _locationListener;
    final appController = _appController;
    if (listener != null && appController != null) {
      appController.locationCoordinator.removeListener(listener);
    }
    appController?.stopIncidentLocationTracking();
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
                if (streaming)
                  EyeDestructiveButton(
                    label: stoppingStream
                        ? "Stopping stream..."
                        : "Stop Live Video",
                    loading: stoppingStream,
                    enabled: !stoppingStream,
                    onPressed: () => _stopStream(context),
                  )
                else
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: EyeSemanticColors.of(context).error,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed:
                        (startingStream || !liveVideoController.canStartSession)
                            ? null
                            : () => _startStream(context),
                    icon: startingStream
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.play_circle),
                    label: Text(
                      startingStream
                          ? "Starting stream..."
                          : liveVideoRetryUserMessage(
                              incidentActive: activeIncidentId != null &&
                                  activeIncidentId!.isNotEmpty,
                            ),
                    ),
                  ),
                if (!streaming &&
                    !startingStream &&
                    liveVideoController.startUnavailableReason != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      liveVideoController.startUnavailableReason!,
                      style: TextStyle(
                        color: EyeSemanticColors.of(context).secondaryText,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Location sharing",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (startingStream)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      _startupPhase.label,
                      style: TextStyle(
                        color: EyeSemanticColors.of(context).secondaryText,
                      ),
                    ),
                  ),
                Text(streaming
                    ? (locationStatusMessage ??
                        "Your live location is shared with authorized emergency admins while this stream is active.")
                    : "Location is acquired in the background while your emergency is created. Precise GPS retry continues automatically."),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _setStartupPhase(LiveVideoStartupPhase phase) {
    if (_disposed || !mounted) return;
    _startupPhase = phase;
    _startupTrace.begin(phase);
    locationStatusMessage = phase.label;
    setState(() {});
  }

  Future<IncidentSubmissionResult> _submitLiveVideoIncident(
    AppController appController,
    IncidentDraft draft,
  ) {
    return submitLiveVideoIncidentWithRetry(
      submit: () =>
          appController.submitIncident(draft).timeout(kLiveVideoStartTimeout),
    );
  }

  void _returnToActiveEmergency({String? errorMessage}) {
    if (!widget.returnToActiveEmergency || !mounted) return;
    Navigator.of(context)
        .pop(LiveVideoReturnResult(errorMessage: errorMessage));
  }

  void _logStartFlowInterrupt({
    required String reason,
    required String location,
    String? correlationId,
    String? incidentId,
  }) {
    liveVideoController.joinFlow.recordInterrupt(
      reason: reason,
      location: location,
    );
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.joinFlowInterrupted,
      correlationId: correlationId ?? _startupTrace.clientTraceId,
      incidentId: incidentId ?? activeIncidentId,
      internalReason: reason,
      interruptLocation: location,
    );
  }

  Future<void> _startStream(BuildContext context) async {
    logLiveVideoDiagnostic(
      checkpoint: LiveVideoJoinCheckpoint.startStreamBegin,
      correlationId: _startupTrace.clientTraceId,
      incidentId: activeIncidentId,
    );
    if (_streamStartInFlight ||
        streaming ||
        !liveVideoController.canStartSession) {
      _logStartFlowInterrupt(
        reason: _streamStartInFlight
            ? "duplicate_stream_start"
            : "start_blocked_lifecycle_${liveVideoController.lifecyclePhase.name}",
        location: "_startStream:duplicate_guard",
      );
      return;
    }
    _streamStartInFlight = true;
    setState(() {
      startingStream = true;
      permissionDenied = false;
      permissionError = null;
    });
    _setStartupPhase(LiveVideoStartupPhase.checkingPermissions);

    final appController = appOf(context);
    final resumeVideoOnly =
        activeIncidentId != null && activeIncidentId!.isNotEmpty;
    try {
      _setStartupPhase(LiveVideoStartupPhase.validatingSession);
      final accessToken = appController.accessToken;
      if (accessToken == null || accessToken.isEmpty) {
        _setStartupPhase(LiveVideoStartupPhase.failed);
        _logStartFlowInterrupt(
          reason: "missing_access_token",
          location: "_startStream:auth_guard",
        );
        showAppSnackBar(
          context,
          "Sign in required to start live video. Reference: LIVE-VIDEO-AUTH-001",
          isError: true,
        );
        return;
      }

      final alreadyPreviewing = liveVideoController.lifecyclePhase ==
              LiveVideoLifecyclePhase.stopped ||
          liveVideoController.connectionState ==
              LiveVideoConnectionState.previewing;
      final previewFuture = alreadyPreviewing
          ? Future.value(true)
          : liveVideoController
              .startLocalPreview(lowBandwidth: lowBandwidth)
              .timeout(kLiveVideoStartTimeout);
      _setStartupPhase(LiveVideoStartupPhase.acquiringLocation);
      final accessFuture =
          appController.locationCoordinator.resolveImmediateEmergencyAccess();

      final previewOk = await previewFuture;
      if (!mounted || _disposed) {
        _logStartFlowInterrupt(
          reason: _disposed ? "widget_disposed" : "widget_unmounted",
          location: "_startStream:after_preview",
          incidentId: activeIncidentId,
        );
        return;
      }
      if (!previewOk) {
        _setStartupPhase(LiveVideoStartupPhase.failed);
        setState(() {
          permissionDenied = true;
          permissionError = liveVideoController.errorMessage;
        });
        _logStartFlowInterrupt(
          reason: "camera_preview_failed",
          location: "_startStream:preview_guard",
          incidentId: activeIncidentId,
        );
        if (liveVideoController.errorMessage != null) {
          showAppSnackBar(context, liveVideoController.errorMessage!,
              isError: true);
        }
        if (widget.returnToActiveEmergency && activeIncidentId != null) {
          _returnToActiveEmergency(
            errorMessage:
                "Unable to start live video. Your emergency remains active. Retry?",
          );
        }
        return;
      }

      final access = await accessFuture;
      if (!mounted || _disposed) {
        _logStartFlowInterrupt(
          reason: _disposed ? "widget_disposed" : "widget_unmounted",
          location: "_startStream:after_location",
          incidentId: activeIncidentId,
        );
        return;
      }

      if (!resumeVideoOnly) {
        final draft = access.hasFix
            ? buildIncidentDraft(
                type: IncidentType.emergency,
                description: "Live emergency video started with GPS.",
                position: access.position!,
                anonymous: false,
                notifyEmergencyContacts: true,
                title: "Live emergency video",
              )
            : buildEmergencyIncidentDraft(
                access: access,
                type: IncidentType.emergency,
                description:
                    "Live emergency video started while location is pending.",
                anonymous: false,
                notifyEmergencyContacts: true,
                title: "Live emergency video",
              );

        _setStartupPhase(LiveVideoStartupPhase.creatingIncident);
        final submission = await _submitLiveVideoIncident(appController, draft);
        if (!mounted || _disposed) {
          _logStartFlowInterrupt(
            reason: _disposed ? "widget_disposed" : "widget_unmounted",
            location: "_startStream:after_incident_submit",
          );
          return;
        }
        if (!submission.isSuccess || submission.incidentId == null) {
          _setStartupPhase(LiveVideoStartupPhase.failed);
          _logStartFlowInterrupt(
            reason: "incident_submit_failed",
            location: "_startStream:incident_submit",
          );
          showAppSnackBar(context,
              "${_startupPhase.label}: ${submission.userMessage ?? "Unable to create incident for live video."}",
              isError: true);
          return;
        }

        activeIncidentId = submission.incidentId;
        await appController.activateActiveEmergency(activeIncidentId!);
        if (!mounted || _disposed) {
          _logStartFlowInterrupt(
            reason: _disposed ? "widget_disposed" : "widget_unmounted",
            location: "_startStream:after_activate_emergency",
            incidentId: activeIncidentId,
          );
          return;
        }
        if (access.hasFix) {
          latestPosition = access.position;
          lastCapturedAt = access.position!.timestamp;
        }
        setState(() {
          roomName = "eye-incident-$activeIncidentId";
        });
        if (!access.hasFix) {
          showAppSnackBar(context, emergencyLocationRetryMessage(access));
        }
      } else {
        _setStartupPhase(LiveVideoStartupPhase.recovering);
      }

      _setStartupPhase(LiveVideoStartupPhase.requestingLiveKitToken);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.startRequestSent,
        correlationId: _startupTrace.clientTraceId,
        incidentId: activeIncidentId,
      );
      final envelope = await apiClient
          .startLiveVideo(
            incidentId: activeIncidentId!,
            payload: TheEyePayloads.liveVideoStart(
              position: access.position,
              lowBandwidthMode: lowBandwidth,
            ),
            accessToken: accessToken,
            clientTraceId: _startupTrace.clientTraceId,
          )
          .timeout(kLiveVideoStartTimeout);
      _startupTrace.recordRequestId(
        envelope["requestId"] as String? ??
            (envelope["data"] as Map?)?["requestId"] as String?,
      );
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.startResponseReceived,
        correlationId: _startupTrace.clientTraceId,
        incidentId: activeIncidentId,
        internalReason: "http_201_or_success_body",
      );
      final startResult = LiveVideoStartResult.fromResponse(envelope);
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.sessionParsed,
        correlationId: startResult.correlationId,
        incidentId: activeIncidentId,
        sessionId: startResult.sessionId,
        roomName: startResult.roomName,
        participantIdentity: startResult.participantIdentity,
        urlScheme: liveVideoUrlHost(startResult.livekit.url)?.scheme,
        urlHost: liveVideoUrlHost(startResult.livekit.url)?.host,
        serverUrlLength: startResult.livekit.url.length.toString(),
        tokenLength: startResult.livekit.token.length.toString(),
        tokenFingerprint: liveVideoTokenFingerprint(startResult.livekit.token),
      );
      liveSessionId = startResult.sessionId;
      roomName = startResult.roomName;

      _setStartupPhase(LiveVideoStartupPhase.startingForegroundService);
      await appController.startIncidentLocationTracking(
        activeIncidentId!,
        liveVideoSessionId: liveSessionId,
      );
      _locationListener ??= (fix) {
        if (!mounted || _disposed) return;
        setState(() {
          latestPosition = fix.toPosition();
          lastCapturedAt = fix.capturedAt.toLocal();
          locationStatusMessage = fix.isCached
              ? cachedLocationUserMessage(fix.ageSeconds)
              : "Emergency submitted";
        });
      };
      appController.locationCoordinator.addListener(_locationListener!);

      _setStartupPhase(LiveVideoStartupPhase.connectingRoom);
      final connected = await liveVideoController
          .startSession(
            startResult,
            incidentIdOverride: activeIncidentId,
          )
          .timeout(kLiveVideoStartTimeout);
      if (!mounted || _disposed) {
        _logStartFlowInterrupt(
          reason: _disposed ? "widget_disposed" : "widget_unmounted",
          location: "_startStream:after_connectPublisher",
          correlationId: startResult.correlationId,
          incidentId: activeIncidentId,
        );
        return;
      }
      if (!connected) {
        _setStartupPhase(LiveVideoStartupPhase.recovering);
        final joinFlow = liveVideoController.joinFlow;
        final failureCode = liveVideoController.lastConnectFailureReason ==
                LiveVideoErrorCodes.publishTracksFailed
            ? LiveVideoErrorCodes.publishTracksFailed
            : joinFlow.roomConnectBeginLogged
                ? LiveVideoErrorCodes.connectLivekitFailed
                : LiveVideoErrorCodes.joinFlowInterruptedBeforeConnect;
        final connectMessage = joinFlow.roomConnectBeginLogged
            ? (liveVideoController.errorMessage ??
                "Unable to join live video room "
                    "(${liveVideoController.lastConnectExceptionType}: "
                    "${liveVideoController.lastConnectExceptionMessage}). "
                    "Reference: $failureCode.")
            : (liveVideoController.errorMessage ??
                "Live video join flow stopped before Room.connect(). "
                    "Reference: $failureCode.");
        if (!joinFlow.roomConnectBeginLogged) {
          joinFlow.recordInterrupt(
            reason: joinFlow.interruptReason ?? "connect_publisher_false",
            location: joinFlow.interruptLocation ??
                "_startStream:connectPublisher_result",
          );
          logLiveVideoDiagnostic(
            checkpoint: LiveVideoJoinCheckpoint.joinFlowInterrupted,
            correlationId: startResult.correlationId,
            incidentId: activeIncidentId,
            sessionId: startResult.sessionId,
            internalReason: joinFlow.interruptReason,
            interruptLocation: joinFlow.interruptLocation,
          );
        }
        await _reportLiveVideoJoinFailure(
          accessToken: accessToken,
          sessionId: startResult.sessionId,
          reasonCode: failureCode,
          message: connectMessage,
          clientTraceId: startResult.correlationId,
        );
        showAppSnackBar(
            context,
            connectMessage.contains("emergency was still submitted")
                ? connectMessage
                : "$connectMessage Your emergency was still submitted.",
            isError: true);
        if (widget.returnToActiveEmergency && activeIncidentId != null) {
          _returnToActiveEmergency(
            errorMessage:
                "Unable to start live video. Your emergency remains active. Retry?",
          );
        }
        return;
      }

      if (!mounted || _disposed) return;
      _setStartupPhase(LiveVideoStartupPhase.streaming);
      setState(() {
        permissionDenied = false;
        permissionError = null;
        locationStatusMessage = access.hasFix
            ? "Emergency submitted"
            : emergencyLocationRetryMessage(access);
      });
      showAppSnackBar(
        context,
        access.hasFix
            ? "Live stream started. Location updates continue automatically."
            : emergencyLocationRetryMessage(access),
      );
    } on LiveVideoStartValidationException catch (error) {
      if (!mounted || _disposed) return;
      _setStartupPhase(activeIncidentId == null
          ? LiveVideoStartupPhase.failed
          : LiveVideoStartupPhase.recovering);
      final message =
          "${liveVideoStartValidationUserMessage(error.reason)} Reference: ${LiveVideoErrorCodes.startResponseInvalid}.";
      logLiveVideoDiagnostic(
        checkpoint: "start_response_invalid",
        correlationId: _startupTrace.clientTraceId,
        incidentId: activeIncidentId,
        internalReason: error.reason,
        exceptionMessage: error.message,
      );
      showAppSnackBar(context, message, isError: true);
    } on TimeoutException catch (error, stackTrace) {
      if (!mounted || _disposed) return;
      _logStartFlowInterrupt(
        reason: "timeout:${error.message ?? error.toString()}",
        location: "_startStream:timeout",
        incidentId: activeIncidentId,
      );
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.joinFlowInterrupted,
        correlationId: _startupTrace.clientTraceId,
        incidentId: activeIncidentId,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
        stackTraceHead: liveVideoStackTraceHead(stackTrace),
        internalReason: "START_STREAM_TIMEOUT",
        connectionState: liveVideoController.joinFlow.roomConnectBeginLogged
            ? "room_connect_begin_logged"
            : "before_room_connect",
      );
      if (liveSessionId.isNotEmpty) {
        final token = appController.accessToken;
        if (token != null && token.isNotEmpty) {
          await _reportLiveVideoJoinFailure(
            accessToken: token,
            sessionId: liveSessionId,
            reasonCode: LiveVideoErrorCodes.connectLivekitFailed,
            message: "Live video start timed out: $error",
            clientTraceId: _startupTrace.clientTraceId,
          );
        }
      }
      _setStartupPhase(activeIncidentId == null
          ? LiveVideoStartupPhase.failed
          : LiveVideoStartupPhase.recovering);
      showAppSnackBar(context,
          "Live video start timed out ($error). Your emergency was still submitted. Retry live video when ready.",
          isError: true);
      if (widget.returnToActiveEmergency && activeIncidentId != null) {
        _returnToActiveEmergency(
          errorMessage:
              "Unable to start live video. Your emergency remains active. Retry?",
        );
      }
    } on IncidentApiException catch (error) {
      if (!mounted || _disposed) return;
      _startupTrace.recordRequestId(error.requestId);
      final message = error.statusCode == 503
          ? "Live video is temporarily unavailable. Your emergency may still have been submitted."
          : mapLiveVideoApiError(
              error.statusCode,
              error.userMessage,
              apiCode: error.apiCode,
            );
      _setStartupPhase(activeIncidentId == null
          ? LiveVideoStartupPhase.failed
          : LiveVideoStartupPhase.recovering);
      showAppSnackBar(context, "${_startupPhase.label}: $message",
          isError: true);
    } catch (error, stackTrace) {
      if (!mounted || _disposed) return;
      _logStartFlowInterrupt(
        reason: error.runtimeType.toString(),
        location: "_startStream:unexpected",
        incidentId: activeIncidentId,
      );
      logLiveVideoDiagnostic(
        checkpoint: LiveVideoJoinCheckpoint.joinFlowInterrupted,
        correlationId: _startupTrace.clientTraceId,
        incidentId: activeIncidentId,
        exceptionType: error.runtimeType.toString(),
        exceptionMessage: error.toString(),
        stackTraceHead: liveVideoStackTraceHead(stackTrace),
        internalReason: "START_STREAM_UNEXPECTED",
      );
      if (kDebugMode) {
        debugPrintStack(
            stackTrace: stackTrace, label: "live_video_start_stream");
      }
      if (liveSessionId.isNotEmpty) {
        final token = appController.accessToken;
        if (token != null && token.isNotEmpty) {
          await _reportLiveVideoJoinFailure(
            accessToken: token,
            sessionId: liveSessionId,
            reasonCode: LiveVideoErrorCodes.connectLivekitFailed,
            message: "Live video start failed unexpectedly: $error",
            clientTraceId: _startupTrace.clientTraceId,
          );
        }
      }
      _setStartupPhase(activeIncidentId == null
          ? LiveVideoStartupPhase.failed
          : LiveVideoStartupPhase.recovering);
      showAppSnackBar(context,
          "Live video is temporarily unavailable ($error). Your emergency may still have been submitted.",
          isError: true);
      if (widget.returnToActiveEmergency && activeIncidentId != null) {
        _returnToActiveEmergency(
          errorMessage:
              "Unable to start live video. Your emergency remains active. Retry?",
        );
      }
    } finally {
      _streamStartInFlight = false;
      if (mounted && !_disposed) setState(() => startingStream = false);
      logLiveVideoEvent(
          "Live video startup trace ${_startupTrace.toDiagnosticMap()} joinFlow=${liveVideoController.joinFlow.toDiagnosticMap()}");
    }
  }

  Future<void> _reportLiveVideoJoinFailure({
    required String accessToken,
    required String sessionId,
    required String reasonCode,
    required String message,
    String? clientTraceId,
  }) async {
    if (sessionId.isEmpty) return;
    try {
      await apiClient
          .reportLiveVideoClientFailure(
            sessionId: sessionId,
            accessToken: accessToken,
            reasonCode: reasonCode,
            message: message,
            clientTraceId: clientTraceId,
          )
          .timeout(const Duration(seconds: 8));
    } catch (_) {
      try {
        await apiClient
            .stopLiveVideo(sessionId: sessionId, accessToken: accessToken)
            .timeout(const Duration(seconds: 8));
      } catch (_) {
        // Best-effort: AE refresh may still show a stale Active session.
      }
    }
  }

  Future<void> _stopStream(BuildContext context) async {
    if (stoppingStream) return;
    final routingDecision = resolveLiveVideoStopRouting(
      returnToActiveEmergency: widget.returnToActiveEmergency,
      activeIncidentId: activeIncidentId,
    );
    setState(() => stoppingStream = true);
    String? cleanupErrorMessage;
    try {
      final listener = _locationListener;
      if (listener != null) {
        appOf(context).locationCoordinator.removeListener(listener);
        _locationListener = null;
      }
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
      await liveVideoController.stopSession(
        keepPreview: true,
        reason: LiveVideoDisconnectReason.userStop,
        caller: "_stopStream",
      );
    } catch (_) {
      cleanupErrorMessage =
          "Live stream stopped locally. Your emergency is still available.";
    } finally {
      if (!mounted) return;
      setState(() {
        liveSessionId = "";
        if (routingDecision.shouldPreserveIncidentId) {
          activeIncidentId = routingDecision.incidentId;
        } else {
          activeIncidentId = null;
        }
        stoppingStream = false;
      });

      final appController = appOf(context);
      switch (routingDecision.destination) {
        case LiveVideoStopDestination.returnToActiveEmergency:
          _returnToActiveEmergency(errorMessage: cleanupErrorMessage);
          return;
        case LiveVideoStopDestination.openActiveEmergency:
          await ActiveEmergencyNavigation.open(
            context,
            appController,
            incidentId: routingDecision.incidentId,
            replace: true,
          );
          if (cleanupErrorMessage != null && context.mounted) {
            showAppSnackBar(context, cleanupErrorMessage);
          }
          return;
        case LiveVideoStopDestination.stayOnLiveVideo:
          showAppSnackBar(
            context,
            cleanupErrorMessage ?? "Live stream stopped.",
          );
          return;
      }
    }
  }
}

class StolenVehicleBroadcastScreen extends StatefulWidget {
  const StolenVehicleBroadcastScreen({super.key});

  @override
  State<StolenVehicleBroadcastScreen> createState() =>
      _StolenVehicleBroadcastScreenState();
}

enum _StolenVehicleEntryMode { choice, savedVehicle, manualEntry }

class _StolenVehicleBroadcastScreenState
    extends State<StolenVehicleBroadcastScreen> {
  final plateController = TextEditingController();
  final makeController = TextEditingController();
  final modelController = TextEditingController();
  final colorController = TextEditingController();
  final yearController = TextEditingController();
  final vinController = TextEditingController();
  final descriptionController = TextEditingController();
  final theftDescriptionController = TextEditingController();
  final lastKnownLocationController = TextEditingController();
  final _vehiclePhotosSectionKey = GlobalKey<VehiclePhotoSectionState>();
  final _evidenceSectionKey = GlobalKey<ManagedEvidenceSectionState>();
  final _draftStore = StolenVehicleBroadcastDraftStore();
  bool submitting = false;
  bool _restoringDraft = false;
  bool _draftLoaded = false;
  _StolenVehicleEntryMode _entryMode = _StolenVehicleEntryMode.choice;
  bool usedSavedCar = false;
  String? savedCarImagePath;
  String? selectedVehicleId;
  DateTime? _lastSeenDate;
  TimeOfDay? _lastSeenTime;

  DateTime? get _lastSeenAt {
    final date = _lastSeenDate;
    final time = _lastSeenTime;
    if (date == null || time == null) return null;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_draftLoaded) return;
    _draftLoaded = true;
    unawaited(_restoreDraft());
  }

  String get _draftUserScope {
    final controller = appOf(context);
    final profileId = controller.cachedCitizenProfile?.id?.trim();
    if (profileId != null && profileId.isNotEmpty) {
      return profileId;
    }
    return "local-user";
  }

  _StolenVehicleEntryMode _parseEntryMode(String? raw) {
    switch (raw) {
      case "savedVehicle":
        return _StolenVehicleEntryMode.savedVehicle;
      case "manualEntry":
        return _StolenVehicleEntryMode.manualEntry;
      default:
        return _StolenVehicleEntryMode.choice;
    }
  }

  String _entryModeStorageValue(_StolenVehicleEntryMode mode) {
    switch (mode) {
      case _StolenVehicleEntryMode.choice:
        return "choice";
      case _StolenVehicleEntryMode.savedVehicle:
        return "savedVehicle";
      case _StolenVehicleEntryMode.manualEntry:
        return "manualEntry";
    }
  }

  Future<void> _restoreDraft() async {
    setState(() => _restoringDraft = true);
    final draft = await _draftStore.load(userScope: _draftUserScope);
    if (!mounted) return;

    final restoredEntryMode = draft == null
        ? _StolenVehicleEntryMode.choice
        : _parseEntryMode(draft.entryMode);
    final restoredVehicleId = draft?.selectedVehicleId;
    setState(() {
      _entryMode = restoredEntryMode;
      selectedVehicleId = restoredVehicleId;
      usedSavedCar = draft?.usedSavedVehicle ?? false;
      _restoringDraft = false;
    });
    if (draft != null) {
      plateController.text = draft.plateNumber ?? "";
      makeController.text = draft.make ?? "";
      modelController.text = draft.model ?? "";
      yearController.text = draft.year ?? "";
      colorController.text = draft.color ?? "";
      vinController.text = draft.vin ?? "";
      descriptionController.text = draft.description ?? "";
      theftDescriptionController.text = draft.theftDescription ?? "";
      lastKnownLocationController.text = draft.lastKnownLocation ?? "";
      _lastSeenDate = draft.lastSeenAt;
      _lastSeenTime = draft.lastSeenAt == null
          ? null
          : TimeOfDay.fromDateTime(draft.lastSeenAt!);
    }
    if (selectedVehicleId != null && selectedVehicleId!.isNotEmpty) {
      final vehicle = _findGarageVehicleById(selectedVehicleId!);
      if (vehicle != null) {
        _applySavedCarProfile(vehicle, notify: true);
      }
    }
  }

  Future<void> _saveDraft() async {
    await _draftStore.save(
      userScope: _draftUserScope,
      draft: StolenVehicleBroadcastDraft(
        entryMode: _entryModeStorageValue(_entryMode),
        selectedVehicleId: selectedVehicleId,
        usedSavedVehicle: usedSavedCar,
        plateNumber: plateController.text,
        make: makeController.text,
        model: modelController.text,
        year: yearController.text,
        color: colorController.text,
        vin: vinController.text,
        description: descriptionController.text,
        theftDescription: theftDescriptionController.text,
        lastKnownLocation: lastKnownLocationController.text,
        lastSeenAt: _lastSeenAt,
        updatedAt: DateTime.now().toUtc(),
      ),
    );
  }

  CarProfile? _findGarageVehicleById(String id) {
    for (final vehicle in appOf(context).vehicles) {
      if (vehicle.id == id) return vehicle;
    }
    return null;
  }

  void _applySavedCarProfile(CarProfile? profile, {bool notify = true}) {
    if (profile == null || !profile.hasRequiredFields) return;
    selectedVehicleId = profile.id;
    plateController.text = profile.plateNumber;
    makeController.text = profile.make;
    modelController.text = profile.model;
    colorController.text = profile.color ?? "";
    yearController.text = profile.year?.toString() ?? "";
    vinController.text = profile.vin ?? "";
    descriptionController.text = profile.notes ?? "";
    savedCarImagePath = profile.imagePath;
    usedSavedCar = true;
    if (notify && mounted) setState(() {});
  }

  void _switchToManualEntry() {
    setState(() {
      _entryMode = _StolenVehicleEntryMode.manualEntry;
      selectedVehicleId = null;
      usedSavedCar = false;
      savedCarImagePath = null;
    });
  }

  List<String> _extractVehiclePhotoObjectKeys(CarProfile? profile) {
    if (profile == null) return const [];
    return profile.photos
        .map((photo) => photo.objectKey?.trim() ?? "")
        .where((key) => key.isNotEmpty && !key.contains(".."))
        .take(EvidencePolicy.vehiclePhotos.maxPhotos)
        .toList(growable: false);
  }

  Future<void> _openAddVehicleFlow() async {
    await _saveDraft();
    if (!mounted) return;
    await Navigator.of(context).pushNamed(
      "/your-car/detail",
      arguments: const _VehicleEditorArgs(returnToStolenVehicle: true),
    );
    if (!mounted) return;
    await appOf(context).loadVehicleGarage(refresh: true);
    if (!mounted) return;
    await _restoreDraft();
    if (!mounted) return;
    setState(() {
      _entryMode = _StolenVehicleEntryMode.savedVehicle;
    });
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
    theftDescriptionController.dispose();
    lastKnownLocationController.dispose();
    super.dispose();
  }

  void _clearDraft() {
    plateController.clear();
    makeController.clear();
    modelController.clear();
    colorController.clear();
    yearController.clear();
    vinController.clear();
    descriptionController.clear();
    theftDescriptionController.clear();
    lastKnownLocationController.clear();
    _vehiclePhotosSectionKey.currentState?.clearAttachments();
    _evidenceSectionKey.currentState?.clearAttachments();
    _lastSeenDate = null;
    _lastSeenTime = null;
    usedSavedCar = false;
    savedCarImagePath = null;
    selectedVehicleId = null;
    _entryMode = _StolenVehicleEntryMode.choice;
    unawaited(_draftStore.clear(userScope: _draftUserScope));
  }

  Future<void> _pickLastSeenDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _lastSeenDate ?? now,
      firstDate: now.subtract(const Duration(days: 3650)),
      lastDate: now,
    );
    if (picked == null || !mounted) return;
    setState(() => _lastSeenDate = picked);
  }

  Future<void> _pickLastSeenTime() async {
    final picked = await showCitizenTimePicker(
      context,
      initialTime: _lastSeenTime ?? TimeOfDay.now(),
    );
    if (picked == null || !mounted) return;
    setState(() => _lastSeenTime = picked);
  }

  Future<void> _submit() async {
    if (plateController.text.trim().isEmpty ||
        makeController.text.trim().isEmpty ||
        modelController.text.trim().isEmpty) {
      showAppSnackBar(context, "Plate number, make, and model are required.",
          isError: true);
      return;
    }
    if (_lastSeenAt == null) {
      showAppSnackBar(context, "Select the Last Seen date and time.",
          isError: true);
      return;
    }
    if (lastKnownLocationController.text.trim().isEmpty) {
      showAppSnackBar(context, "Enter the last known location.", isError: true);
      return;
    }
    if (theftDescriptionController.text.trim().isEmpty) {
      showAppSnackBar(context, "Describe the circumstances of the theft.",
          isError: true);
      return;
    }

    setState(() => submitting = true);
    final controller = appOf(context);
    if (controller.accessToken == null) {
      setState(() => submitting = false);
      showAppSnackBar(context, "Sign in to publish a broadcast.",
          isError: true);
      return;
    }
    final outcome = await captureLocationOutcome();
    if (!mounted) return;
    if (outcome.result != LocationCaptureResult.granted ||
        outcome.position == null) {
      setState(() => submitting = false);
      showAppSnackBar(context, locationFailureMessage(outcome.result),
          isError: true);
      return;
    }

    final description = descriptionController.text.trim();
    final year = yearController.text.trim();
    final parsedYear = int.tryParse(year);
    final vin = vinController.text.trim();
    final normalizedColor = colorController.text.trim().isEmpty
        ? "Unknown"
        : colorController.text.trim();
    final sourceVehicle =
        selectedVehicleId == null || selectedVehicleId!.isEmpty
            ? null
            : _findGarageVehicleById(selectedVehicleId!);
    final savedVehiclePhotoObjectKeys =
        _extractVehiclePhotoObjectKeys(sourceVehicle);
    try {
      final localVehiclePhotos =
          _vehiclePhotosSectionKey.currentState?.attachments ?? const [];
      final localEvidence =
          _evidenceSectionKey.currentState?.attachments ?? const [];
      var uploadedVehiclePhotos = const <Map<String, Object?>>[];
      var uploadedEvidence = const <Map<String, Object?>>[];
      if (localVehiclePhotos.isNotEmpty) {
        try {
          uploadedVehiclePhotos =
              await controller.broadcastMediaUploadService.uploadAttachments(
            attachments: localVehiclePhotos,
            accessToken: controller.accessToken!,
          );
        } on BroadcastMediaUploadFailure catch (error) {
          if (!mounted) return;
          setState(() => submitting = false);
          showAppSnackBar(context, error.message, isError: true);
          return;
        }
      }
      if (localEvidence.isNotEmpty) {
        try {
          uploadedEvidence =
              await controller.broadcastMediaUploadService.uploadAttachments(
            attachments: localEvidence,
            accessToken: controller.accessToken!,
          );
        } on BroadcastMediaUploadFailure catch (error) {
          if (!mounted) return;
          setState(() => submitting = false);
          showAppSnackBar(context, error.message, isError: true);
          return;
        }
      }
      final result =
          await controller.broadcastSubmissionService.createStolenVehicle(
        accessToken: controller.accessToken!,
        payload: {
          "clientBroadcastId": createClientSubmissionId(),
          "vehicleType": "Car",
          "make": makeController.text.trim(),
          "model": modelController.text.trim(),
          "colour": normalizedColor,
          if (year.isNotEmpty) "year": parsedYear ?? year,
          "registrationNumber": plateController.text.trim(),
          "stolenAt": DateTime.now().toUtc().toIso8601String(),
          "lastSeenAt": _lastSeenAt!.toUtc().toIso8601String(),
          "lastKnownLatitude": outcome.position!.latitude,
          "lastKnownLongitude": outcome.position!.longitude,
          "distinguishingFeatures":
              description.isEmpty ? "See broadcast details" : description,
          "theftDescription": theftDescriptionController.text.trim(),
          "contactMethod": "in_app",
          "lastKnownLocation": lastKnownLocationController.text.trim(),
          if (vin.isNotEmpty) "vin": vin.toUpperCase(),
          if (vin.length >= 4) "vinLastFour": vin.substring(vin.length - 4),
          "metadata": {
            if (selectedVehicleId != null && selectedVehicleId!.isNotEmpty)
              "sourceVehicleId": selectedVehicleId,
            "make": makeController.text.trim(),
            "model": modelController.text.trim(),
            if (year.isNotEmpty) "year": parsedYear ?? year,
            "colour": normalizedColor,
            "registrationNumber": plateController.text.trim(),
            if (vin.isNotEmpty) "vin": vin.toUpperCase(),
            if (vin.length >= 4) "vinLastFour": vin.substring(vin.length - 4),
            if (savedVehiclePhotoObjectKeys.isNotEmpty)
              "vehiclePhotoObjectKeys": savedVehiclePhotoObjectKeys,
            if (uploadedVehiclePhotos.isNotEmpty)
              "vehiclePhotos": uploadedVehiclePhotos,
            if (uploadedEvidence.isNotEmpty) "attachments": uploadedEvidence,
          },
        },
      ).timeout(kSosSubmissionTimeout);
      if (!mounted) return;
      setState(() => submitting = false);
      _clearDraft();
      if (mounted) setState(() {});
      showAppSnackBar(
        context,
        result.duplicate
            ? "This broadcast was already published."
            : "Stolen vehicle broadcast is now live.",
      );
      unawaited(controller.loadBroadcastsFromApi(refresh: true));
      final route = broadcastDetailRoute(result.id);
      if (route != null) {
        await Navigator.of(context).pushReplacementNamed(
          route,
          arguments: const BroadcastDetailNavigationArgs(
            returnToCenterOnBack: true,
          ),
        );
      }
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, error.userMessage, isError: true);
    } on TimeoutException {
      if (!mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, "Broadcast publish timed out (ERR-BRD-408).",
          isError: true);
    } catch (error, stackTrace) {
      debugPrint(
        "Stolen vehicle broadcast publish failed: "
        "${safeBroadcastPublishErrorLog(error, stackTrace)}",
      );
      if (!mounted) return;
      setState(() => submitting = false);
      showAppSnackBar(context, "Unable to publish broadcast (ERR-BRD-500).",
          isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_restoringDraft) {
      return const SafetyScaffold(
        title: "Stolen vehicle",
        body: Center(child: CircularProgressIndicator()),
      );
    }
    final garageVehicles = appOf(context)
        .vehicles
        .where((vehicle) => vehicle.hasRequiredFields)
        .toList(growable: false);
    CarProfile? selectedVehicle;
    for (final vehicle in garageVehicles) {
      if (vehicle.id == selectedVehicleId) {
        selectedVehicle = vehicle;
        break;
      }
    }
    final hasSavedCar = garageVehicles.isNotEmpty;
    final showVehicleForm = _entryMode == _StolenVehicleEntryMode.manualEntry ||
        (_entryMode == _StolenVehicleEntryMode.savedVehicle &&
            selectedVehicle != null);
    final l10n = AppLocalizations.of(context);
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
                if (_entryMode == _StolenVehicleEntryMode.choice) ...[
                  FilledButton(
                    onPressed: () {
                      setState(() {
                        _entryMode = _StolenVehicleEntryMode.savedVehicle;
                        selectedVehicleId = null;
                      });
                    },
                    child: const Text("Use Saved Vehicle"),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _switchToManualEntry,
                    child: const Text("Enter Vehicle Manually"),
                  ),
                ],
                if (_entryMode == _StolenVehicleEntryMode.savedVehicle) ...[
                  if (!hasSavedCar)
                    _buildNoSavedVehicleState()
                  else if (selectedVehicle != null)
                    Semantics(
                      container: true,
                      label:
                          "${l10n.broadcastSelectedVehicle}: ${selectedVehicle.make} ${selectedVehicle.model}",
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ListTile(
                            leading: _buildVehicleThumb(selectedVehicle),
                            title: Text(l10n.broadcastSelectedVehicle),
                            subtitle: Text(
                              "${selectedVehicle.make} ${selectedVehicle.model}"
                                  .trim(),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () {
                                setState(() {
                                  selectedVehicleId = null;
                                  usedSavedCar = false;
                                  savedCarImagePath = null;
                                });
                              },
                              child: Text(l10n.broadcastChangeVehicle),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    _buildSavedVehicleSelector(garageVehicles, selectedVehicle),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _switchToManualEntry,
                    child: const Text("Enter Vehicle Manually"),
                  ),
                ],
                if (_entryMode == _StolenVehicleEntryMode.manualEntry &&
                    hasSavedCar) ...[
                  OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _entryMode = _StolenVehicleEntryMode.savedVehicle;
                        selectedVehicleId = null;
                        usedSavedCar = false;
                        savedCarImagePath = null;
                      });
                    },
                    child: const Text("Use Saved Vehicle"),
                  ),
                  const SizedBox(height: 12),
                ],
                if (showVehicleForm) ...[
                  if (savedCarImagePath != null &&
                      (savedCarImagePath!.startsWith("http://") ||
                          savedCarImagePath!.startsWith("https://") ||
                          File(savedCarImagePath!).existsSync()))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: savedCarImagePath!.startsWith("http://") ||
                                savedCarImagePath!.startsWith("https://")
                            ? Image.network(
                                savedCarImagePath!,
                                height: 140,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              )
                            : Image.file(
                                File(savedCarImagePath!),
                                height: 140,
                                width: double.infinity,
                                fit: BoxFit.cover,
                              ),
                      ),
                    ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text("Vehicle Information",
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
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
                      controller: plateController,
                      decoration:
                          const InputDecoration(labelText: "Plate number")),
                  const SizedBox(height: 12),
                  TextField(
                      controller: vinController,
                      decoration: const InputDecoration(
                          labelText: "VIN / Chassis (optional)")),
                  const SizedBox(height: 20),
                  VehiclePhotoSection(
                    key: _vehiclePhotosSectionKey,
                    lowDataMode: appOf(context).lowDataMode,
                  ),
                  const SizedBox(height: 20),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text("Last Seen",
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                  Material(
                    color: Colors.transparent,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text("Last Seen Date"),
                      subtitle: Text(_lastSeenDate == null
                          ? "Tap to select date"
                          : CitizenDateTimeFormatter.formatDate(
                              _lastSeenDate!)),
                      trailing: const Icon(Icons.event_outlined),
                      onTap: submitting ? null : _pickLastSeenDate,
                    ),
                  ),
                  Material(
                    color: Colors.transparent,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text("Last Seen Time"),
                      subtitle: Text(_lastSeenTime == null
                          ? "Tap to select time"
                          : formatCitizenTimeOfDay(_lastSeenTime!)),
                      trailing: const Icon(Icons.schedule_outlined),
                      onTap: submitting ? null : _pickLastSeenTime,
                    ),
                  ),
                  TextField(
                    controller: lastKnownLocationController,
                    decoration: const InputDecoration(
                      labelText: "Last Known Location",
                      hintText: "Street, area, town/city, state",
                    ),
                  ),
                  const SizedBox(height: 20),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text("Description of Theft",
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                      controller: theftDescriptionController,
                      maxLines: 4,
                      decoration:
                          const InputDecoration(labelText: "What happened?")),
                  const SizedBox(height: 12),
                  TextField(
                      controller: descriptionController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                          labelText: "Distinguishing features")),
                  const SizedBox(height: 20),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text("Incident Evidence",
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                  const SizedBox(height: 8),
                  ManagedEvidenceSection(
                      key: _evidenceSectionKey,
                      lowDataMode: appOf(context).lowDataMode,
                      policy: EvidencePolicy.incident),
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
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoSavedVehicleState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          "NO SAVED VEHICLES",
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        const Text("You haven't added any vehicles yet."),
        const Text(
            "Add your vehicle first, then return here to report it stolen."),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: _openAddVehicleFlow,
                child: const Text("Add Vehicle"),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSavedVehicleSelector(
    List<CarProfile> vehicles,
    CarProfile? selectedVehicle,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: Text(
            "Select Vehicle",
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 8),
        ...vehicles.map((vehicle) {
          final selected = vehicle.id == selectedVehicle?.id;
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: _buildVehicleThumb(vehicle),
              title: Text("${vehicle.make} ${vehicle.model}".trim()),
              subtitle: Text(
                [
                  if ((vehicle.color ?? "").trim().isNotEmpty)
                    vehicle.color!.trim(),
                  vehicle.plateNumber,
                ].join(" • "),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (vehicle.isPrimary)
                    Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: BrandColors.green.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text(
                        "PRIMARY",
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  Icon(
                    selected
                        ? Icons.radio_button_checked
                        : Icons.radio_button_off,
                  ),
                ],
              ),
              onTap: () {
                setState(() => selectedVehicleId = vehicle.id);
                _applySavedCarProfile(vehicle);
                showAppSnackBar(context, "Loaded selected vehicle details.");
              },
            ),
          );
        }),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _openAddVehicleFlow,
          child: const Text("Add Vehicle"),
        ),
      ],
    );
  }

  Widget _buildVehicleThumb(CarProfile vehicle) {
    final imagePath = vehicle.imagePath;
    if (imagePath != null &&
        imagePath.isNotEmpty &&
        File(imagePath).existsSync()) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.file(
          File(imagePath),
          width: 48,
          height: 48,
          fit: BoxFit.cover,
        ),
      );
    }
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: context.eyeSurfaceMuted,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(Icons.directions_car, color: context.eyeMutedText),
    );
  }
}

class BroadcastCenterScreen extends StatefulWidget {
  const BroadcastCenterScreen({super.key});

  @override
  State<BroadcastCenterScreen> createState() => _BroadcastCenterScreenState();
}

class _BroadcastCenterScreenState extends State<BroadcastCenterScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      unawaited(controller.loadBroadcastsFromApi(refresh: true));
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    if (!controller.isAuthenticated) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return SafetyScaffold(
      title: "Safety broadcasts",
      selectedIndex: 3,
      useFigmaShell: true,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: EyePageHeader.root(title: "Safety broadcasts"),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        Navigator.of(context).pushNamed(BroadcastRoutes.create),
                    icon: const Icon(Icons.add),
                    label: const Text("Create"),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        Navigator.of(context).pushNamed(BroadcastRoutes.mine),
                    icon: const Icon(Icons.list_alt),
                    label: const Text("Mine"),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => controller.loadBroadcastsFromApi(refresh: true),
              child: _buildBody(controller),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AppController controller) {
    if (controller.loadingBroadcasts && controller.broadcasts.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: const [
          SizedBox(height: 120),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }

    if (controller.broadcastLoadError != null &&
        controller.broadcasts.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          const SectionCard(
            title: "National safety broadcasts",
            child: Text(
              "Country-wide emergency and public-safety alerts remain available wherever you are.",
            ),
          ),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.cloud_off),
            title: const Text("Broadcasts unavailable"),
            subtitle: Text(controller.broadcastLoadError!),
          ),
          FilledButton(
            onPressed: () =>
                unawaited(controller.loadBroadcastsFromApi(refresh: true)),
            child: const Text("Retry"),
          ),
        ],
      );
    }

    if (controller.broadcasts.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: const [
          SectionCard(
            title: "National safety broadcasts",
            child: Text(
                "There are no active country-wide safety broadcasts right now."),
          ),
        ],
      );
    }

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.metrics.pixels >=
            notification.metrics.maxScrollExtent - 240) {
          unawaited(controller.loadMoreBroadcasts());
        }
        return false;
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Alerts for your location",
            child: Text(
              controller.broadcastUnreadCount > 0
                  ? "${controller.broadcastUnreadCount} unread safety broadcasts near you."
                  : "Verified emergency and government alerts are targeted using your profile jurisdiction and current location.",
            ),
          ),
          const SizedBox(height: 16),
          ...controller.broadcasts.map((item) {
            final presentation = CitizenBroadcastPresenter.present(
              item,
              AppLocalizations.of(context),
            );
            final tone = item.priority.contains("P1")
                ? Colors.red.shade700
                : item.priority.contains("P2")
                    ? Colors.orange.shade800
                    : EyeSemanticColors.of(context).verified;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ListTileCard(
                leading: CircleAvatar(
                  backgroundColor: tone.withValues(alpha: 0.12),
                  foregroundColor: tone,
                  child: Icon(
                    item.type.toLowerCase().contains("missing")
                        ? Icons.person_search
                        : item.type.toLowerCase().contains("vehicle")
                            ? Icons.directions_car
                            : Icons.campaign,
                  ),
                ),
                title: presentation.title,
                subtitle:
                    "${presentation.summary}\n${presentation.metadataLine}",
                trailing: item.read
                    ? const Icon(Icons.chevron_right)
                    : const Icon(Icons.fiber_manual_record, size: 12),
                onTap: () {
                  final route = broadcastDetailRoute(item.id);
                  if (route != null) {
                    Navigator.of(context).pushNamed(route);
                  }
                },
              ),
            );
          }),
          if (controller.loadingMoreBroadcasts)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: CircularProgressIndicator()),
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

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _openingNotification = false;

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

  Future<void> _openNotification(
    AppController controller,
    InboxNotificationItem alert,
  ) async {
    if (_openingNotification) return;
    _openingNotification = true;
    try {
      await controller.markNotificationRead(alert.id);
      final route = resolveInboxNotificationDestination(alert);
      if (!mounted) return;
      if (route == "/notifications") return;
      final navigator = Navigator.of(context);
      if (route == "/incident-detail") {
        final incidentId = alert.incidentId;
        if (incidentId == null || incidentId.isEmpty) return;
        await navigator.pushNamed(
          "/incident-detail",
          arguments: incidentId,
        );
        return;
      }
      if (route == "/active-emergency") {
        final incidentId = alert.incidentId;
        if (incidentId != null && incidentId.isNotEmpty) {
          await controller.activateActiveEmergency(incidentId);
          if (!mounted) return;
          await navigator.pushNamed(
            "/active-emergency/$incidentId",
            arguments: {"incidentId": incidentId},
          );
          return;
        }
      }
      await navigator.pushNamed(route);
    } finally {
      _openingNotification = false;
    }
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
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const EyePageHeader.secondary(title: "Notifications"),
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
            onTap: () => unawaited(_openNotification(controller, alert)),
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
      body: ActivityHistoryScreen(
        accessToken: controller.accessToken,
        controller: controller,
        apiClient: controller.apiClient,
        onRefreshDrafts: controller.refreshComposeDrafts,
        composeDrafts: controller.composeDrafts,
        pendingDrafts: controller.pendingDrafts,
        syncingPending: controller.syncingPending,
        online: controller.online,
        onRetryPending: controller.syncPendingSubmissions,
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
              onPressed: () => Navigator.of(context)
                  .pushNamed("/profile/emergency-contacts"),
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
  TheEyeApiClient get apiClient => appOf(context).apiClient;
  final TextEditingController deviceIdController = TextEditingController();
  final TextEditingController deviceSecretController = TextEditingController();
  final TextEditingController pairingCodeController = TextEditingController();
  bool standaloneCellular = false;
  bool criticalAlerts = true;
  bool failoverEnabled = true;
  String pairingMethod = SmartwatchPairingMethod.pairingCode;
  String emergencyMode = SmartwatchEmergencyMode.normalSos;
  int? batteryLevel;
  int? signalStrength;
  bool locationDenied = false;
  bool sending = false;
  bool loadingDevices = false;
  String? loadError;
  String status = "No paired device loaded yet";
  Position? latestPosition;
  SmartwatchDeviceRecord? selectedDevice;
  final List<String> sosHistory = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => unawaited(_loadDevices()));
  }

  Future<void> _loadDevices() async {
    final token = appOf(context).accessToken;
    if (token == null) return;
    setState(() {
      loadingDevices = true;
      loadError = null;
    });
    try {
      final devices = await apiClient.listSmartwatchDevices(accessToken: token);
      if (!mounted) return;
      SmartwatchDeviceRecord? device;
      if (devices.isNotEmpty) {
        device = devices.firstWhere((item) => item.isActive,
            orElse: () => devices.first);
      }
      setState(() {
        selectedDevice = device;
        loadingDevices = false;
        if (device != null) {
          deviceIdController.text = device.deviceId;
          standaloneCellular = device.connectivityMode == "StandaloneCellular";
          criticalAlerts = device.criticalAlertsEnabled;
          failoverEnabled = device.failoverEnabled;
          batteryLevel = device.batteryLevel;
          signalStrength = device.signalStrength;
          status = device.isOnline
              ? "Device online"
              : "Device paired — awaiting heartbeat";
          if (device.lastLatitude != null && device.lastLongitude != null) {
            latestPosition = Position(
              latitude: device.lastLatitude!,
              longitude: device.lastLongitude!,
              timestamp: device.lastGpsAt ?? DateTime.now(),
              accuracy: device.lastGpsAccuracy ?? 0,
              altitude: 0,
              altitudeAccuracy: 0,
              heading: 0,
              headingAccuracy: 0,
              speed: 0,
              speedAccuracy: 0,
            );
          }
        } else {
          status = "No paired SOS device found. Pair a watch to continue.";
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loadingDevices = false;
        loadError = "Unable to load SOS devices from staging.";
        status = "Device list unavailable";
      });
    }
  }

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
                    standalone: false,
                    onTap: () => setState(() => standaloneCellular = false),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _ModeCard(
                    title: "Standalone",
                    subtitle: "Watch uses LTE/WiFi directly",
                    selected: standaloneCellular,
                    standalone: true,
                    onTap: () => setState(() => standaloneCellular = true),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SmartwatchCompanionPreview(
            standalone: standaloneCellular,
            batteryLevel: batteryLevel ?? 0,
            signalStrength: signalStrength ?? 0,
            sosActive: emergencyMode != SmartwatchEmergencyMode.normalSos,
            hasTelemetry: batteryLevel != null && signalStrength != null,
          ),
          if (loadingDevices)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (loadError != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(loadError!,
                  style: const TextStyle(color: BrandColors.danger)),
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
                ProfileRow("Battery",
                    batteryLevel == null ? "Unavailable" : "$batteryLevel%"),
                ProfileRow(
                    "Signal",
                    signalStrength == null
                        ? "Unavailable"
                        : "$signalStrength%"),
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
                    style: TextButton.styleFrom(
                      foregroundColor:
                          EyeSemanticColors.of(context).interactiveText,
                    ),
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
    await _loadDevices();
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

List<Widget> _neighborhoodWatchHeaderActions(BuildContext context) {
  return [
    NwPrototypeIconButton(
      icon: Icons.notifications_none,
      hasDot: true,
      onPressed: () => Navigator.of(context).pushNamed("/notifications"),
    ),
  ];
}

class MyCommunitiesScreen extends StatefulWidget {
  const MyCommunitiesScreen({super.key});

  @override
  State<MyCommunitiesScreen> createState() => _MyCommunitiesScreenState();
}

class _MyCommunitiesScreenState extends State<MyCommunitiesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      await controller.loadCommunitiesFromApi(refresh: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final memberships = controller.communities
        .where((community) =>
            community.membershipStatus == "Approved" ||
            community.membershipStatus == "Pending")
        .toList();
    return NwPrototypeScaffold(
      title: "Neighborhood Watch",
      actions: _neighborhoodWatchHeaderActions(context),
      body: RefreshIndicator(
        onRefresh: () => controller.loadCommunitiesFromApi(refresh: true),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const NwPrototypeSectionHeading(title: "My Communities"),
            const SizedBox(height: 8),
            if (controller.loadingCommunities && memberships.isEmpty)
              const Center(child: CircularProgressIndicator())
            else if (memberships.isEmpty)
              const NwPrototypeListCard(
                leading: Icon(Icons.groups),
                title: "No communities yet",
                subtitle: "Join a community to appear here.",
              )
            else
              ...memberships.map(
                (community) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: NwPrototypeListCard(
                      leading: const Icon(Icons.groups),
                      title: community.name,
                      subtitle: [
                        "${community.visibility} • ${community.membershipStatus ?? "Unknown"}",
                        if (communityAccessStatus(
                          selectedCommunity: community,
                          currentAreaCommunityId:
                              controller.nwContextCommunityId,
                        ).isOutsideCurrentArea)
                          "You are currently outside this community.",
                      ].join("\n"),
                      onTap: () {
                        controller.selectCommunity(community);
                        Navigator.of(context).pushReplacementNamed(
                          NeighborhoodWatchDestinations.home,
                        );
                      },
                      trailing: community.membershipStatus == "Approved"
                          ? IconButton(
                              icon: const Icon(Icons.logout),
                              tooltip: "Leave community",
                              onPressed: () async {
                                controller.selectCommunity(community);
                                final confirmed = await showDialog<bool>(
                                  context: context,
                                  builder: (context) => AlertDialog(
                                    title: const Text("Leave community"),
                                    content: const Text(
                                      "Leave this community? Owners and moderators must transfer responsibilities first.",
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(context, false),
                                        child: const Text("Cancel"),
                                      ),
                                      FilledButton(
                                        onPressed: () =>
                                            Navigator.pop(context, true),
                                        child: const Text("Leave"),
                                      ),
                                    ],
                                  ),
                                );
                                if (confirmed != true || !context.mounted) {
                                  return;
                                }
                                final error =
                                    await controller.leaveSelectedCommunity();
                                if (!context.mounted) return;
                                if (error != null) {
                                  showAppSnackBar(context, error,
                                      isError: true);
                                } else {
                                  showAppSnackBar(
                                      context, "You left the community");
                                  await controller.loadCommunitiesFromApi(
                                      refresh: true);
                                  setState(() {});
                                }
                              },
                            )
                          : null),
                ),
              ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => Navigator.of(context)
                    .pushNamed(NeighborhoodWatchDestinations.join),
                icon: const Icon(Icons.travel_explore),
                label: const Text("Discover Communities"),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class JoinCommunityScreen extends StatefulWidget {
  const JoinCommunityScreen({super.key});

  @override
  State<JoinCommunityScreen> createState() => _JoinCommunityScreenState();
}

class _JoinCommunityScreenState extends State<JoinCommunityScreen> {
  final _searchController = TextEditingController();
  String? _actionError;
  String? _joiningCommunityId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      await controller.loadCommunitiesFromApi(refresh: true);
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _join(CommunitySummary community) async {
    if (!communityJoinActionEnabled(community) || _joiningCommunityId != null) {
      return;
    }
    setState(() {
      _joiningCommunityId = community.id;
      _actionError = null;
    });
    try {
      final updated =
          await appOf(context).joinCommunityAndRefresh(community.id);
      if (!mounted) return;
      showAppSnackBar(
        context,
        updated.isPending ? "Request pending" : "Community joined",
      );
      setState(() => _joiningCommunityId = null);
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _joiningCommunityId = null;
        _actionError = error.userMessage;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _joiningCommunityId = null;
        _actionError = error is StateError
            ? error.message
            : "Unable to submit join request.";
      });
    }
  }

  void _openPreview(CommunitySummary community) {
    Navigator.of(context).pushNamed(
      NeighborhoodWatchDestinations.previewCommunity,
      arguments: community,
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final currentArea = controller.currentAreaCommunity;
    final items = discoverableCommunitiesForArea(
      communities: controller.communities,
      currentArea: currentArea,
      search: _searchController.text,
    );
    return NwPrototypeScaffold(
      title: "Discover Communities",
      leading: NwPrototypeIconButton(
        icon: Icons.arrow_back,
        onPressed: () => Navigator.of(context).maybePop(),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          NwPrototypeListCard(
            leading: const Icon(Icons.my_location),
            title: currentArea == null
                ? "Current area"
                : "Current area: ${currentArea.name}",
            subtitle: currentArea == null
                ? "Open Neighborhood Watch Home to refresh your live area."
                : communityLocationLabel(currentArea),
          ),
          const SizedBox(height: 12),
          NwPrototypeCard(
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                labelText: "Search community, country, state, or LGA",
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => Navigator.of(context).pushNamed(
                NeighborhoodWatchDestinations.requestCommunity,
              ),
              icon: const Icon(Icons.add_home_work_outlined),
              label: const Text("Request community"),
            ),
          ),
          if (_actionError != null) ...[
            const SizedBox(height: 8),
            NwPrototypeNotice(
              title: "Join unavailable",
              message: _actionError!,
              icon: Icons.error_outline,
              color: BrandColors.danger,
            ),
          ],
          const SizedBox(height: 16),
          if (controller.loadingCommunities && items.isEmpty)
            const NwPrototypeListCard(
              leading: SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              title: "Loading communities...",
              subtitle: "Finding registered communities for this area.",
            )
          else if (controller.communityLoadError != null && items.isEmpty)
            NwPrototypeListCard(
              leading: const Icon(Icons.cloud_off),
              title: "Unable to load nearby communities",
              subtitle: controller.communityLoadError ?? "Try again.",
            )
          else if (items.isEmpty)
            const NwPrototypeListCard(
              leading: Icon(Icons.search_off),
              title: "No registered community in this area yet",
              subtitle: "Start a Community when your area is not listed.",
            )
          else
            ...items.map(
              (community) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: NwPrototypeListCard(
                  leading: Icon(
                    community.visibility == "Private"
                        ? Icons.lock_outline
                        : Icons.public,
                  ),
                  title: community.name,
                  subtitle:
                      "${communityLocationLabel(community)}\n${community.memberCount} members • ${communitySafetyStateLabel(community)}",
                  badge: NwPrototypePill(
                    label: community.visibility,
                    selected: community.visibility == "Private",
                    color: community.visibility == "Private"
                        ? BrandColors.orange
                        : BrandColors.green,
                  ),
                  onTap: () => _openPreview(community),
                  trailing: FilledButton(
                    onPressed: !communityJoinActionEnabled(community) ||
                            _joiningCommunityId != null
                        ? null
                        : () => _join(community),
                    child: Text(
                      _joiningCommunityId == community.id
                          ? "Submitting..."
                          : communityJoinButtonLabel(community),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class CommunityPreviewScreen extends StatefulWidget {
  const CommunityPreviewScreen({this.initialCommunity, super.key});

  final CommunitySummary? initialCommunity;

  @override
  State<CommunityPreviewScreen> createState() => _CommunityPreviewScreenState();
}

class _CommunityPreviewScreenState extends State<CommunityPreviewScreen> {
  CommunitySummary? _community;
  bool _loading = false;
  bool _joining = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _community = widget.initialCommunity;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPreview());
  }

  Future<void> _loadPreview() async {
    final initial = widget.initialCommunity;
    final controller = appOf(context);
    if (!controller.isAuthenticated) {
      Navigator.of(context).pushReplacementNamed("/login");
      return;
    }
    if (initial == null || initial.id.isEmpty) {
      setState(() => _error = "Community unavailable.");
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final community = await controller.getCommunityPreview(initial.id);
      if (!mounted) return;
      setState(() {
        _community = community;
        _loading = false;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.userMessage;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = "Community unavailable.";
      });
    }
  }

  Future<void> _join() async {
    final community = _community;
    if (community == null ||
        !communityJoinActionEnabled(community) ||
        _joining) {
      return;
    }
    setState(() {
      _joining = true;
      _error = null;
    });
    try {
      final updated =
          await appOf(context).joinCommunityAndRefresh(community.id);
      if (!mounted) return;
      setState(() {
        _community = updated;
        _joining = false;
      });
      showAppSnackBar(
        context,
        updated.isPending ? "Request pending" : "Community joined",
      );
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _joining = false;
        _error = error.userMessage;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _joining = false;
        _error = error is StateError
            ? error.message
            : "Unable to submit join request.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final community = _community;
    return NwPrototypeScaffold(
      title: "Community Preview",
      leading: NwPrototypeIconButton(
        icon: Icons.arrow_back,
        onPressed: () => Navigator.of(context).maybePop(),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          if (_loading && community == null)
            const NwPrototypeListCard(
              leading: SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              title: "Loading community...",
              subtitle: "Preparing the public preview.",
            )
          else if (community == null)
            NwPrototypeListCard(
              leading: const Icon(Icons.cloud_off),
              title: "Community unavailable",
              subtitle: _error ?? "Try again later.",
            )
          else ...[
            NwPrototypeCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          community.name,
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      NwPrototypePill(
                        label: communityJoinButtonLabel(community),
                        selected: community.isMember || community.isPending,
                        color: community.isPending
                            ? BrandColors.orange
                            : BrandColors.green,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(communityLocationLabel(community)),
                  const SizedBox(height: 8),
                  Text("${community.memberCount} members"),
                  const SizedBox(height: 8),
                  Text(communitySafetyStateLabel(community)),
                  if ((community.description ?? "").trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(community.description!.trim()),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            NwPrototypeCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  NwPrototypeSectionHeading(title: "Community rules"),
                  SizedBox(height: 10),
                  Text("Share verified local safety information."),
                  SizedBox(height: 6),
                  Text("Do not post private personal or patrol details."),
                  SizedBox(height: 6),
                  Text("Report emergencies through the Emergency workflow."),
                ],
              ),
            ),
            const SizedBox(height: 12),
            NwPrototypeCard(
              child: Text(
                community.latestActivityAt == null
                    ? "No recent public activity is available in preview."
                    : "Latest public activity is available from this community.",
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              NwPrototypeNotice(
                title: "Preview unavailable",
                message: _error!,
                icon: Icons.error_outline,
                color: BrandColors.danger,
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _joining || !communityJoinActionEnabled(community)
                    ? null
                    : _join,
                icon: _joining
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.group_add),
                label: Text(
                  _joining
                      ? "Submitting..."
                      : communityJoinButtonLabel(community),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class RequestCommunityScreen extends StatefulWidget {
  const RequestCommunityScreen({super.key});

  @override
  State<RequestCommunityScreen> createState() => _RequestCommunityScreenState();
}

class _RequestCommunityScreenState extends State<RequestCommunityScreen> {
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _countryController = TextEditingController();
  final _stateController = TextEditingController();
  final _lgaController = TextEditingController();
  final _wardController = TextEditingController();
  final _estateController = TextEditingController();
  final _streetController = TextEditingController();
  String _visibility = "Public";
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      final profile = await controller.loadCitizenProfile();
      if (!mounted) return;
      _prefillFromProfile(profile);
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _countryController.dispose();
    _stateController.dispose();
    _lgaController.dispose();
    _wardController.dispose();
    _estateController.dispose();
    _streetController.dispose();
    super.dispose();
  }

  void _prefillFromProfile(CitizenProfile? profile) {
    final details = profile?.profile;
    setState(() {
      _countryController.text = details?.country?.trim() ?? "";
      _stateController.text = details?.state?.trim() ?? "";
      _lgaController.text = details?.lga?.trim() ?? "";
    });
  }

  String? _required(String value, String label) {
    return value.trim().isEmpty ? "$label is required" : null;
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final country = _countryController.text.trim();
    final nameError = _required(name, "Community name");
    final countryError = _required(country, "Country");
    if (nameError != null || countryError != null) {
      setState(() => _error = nameError ?? countryError);
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    final error = await appOf(context).requestCommunity(
      name: name,
      country: country,
      description: _descriptionController.text.trim(),
      state: _stateController.text.trim(),
      lga: _lgaController.text.trim(),
      ward: _wardController.text.trim(),
      estate: _estateController.text.trim(),
      street: _streetController.text.trim(),
      visibility: _visibility,
    );
    if (!mounted) return;
    setState(() {
      _submitting = false;
      _error = error;
    });
    if (error == null) {
      showAppSnackBar(context, "Community request submitted");
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Request Community",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          const ListTileCard(
            leading: Icon(Icons.verified_user_outlined),
            title: "Reviewed before activation",
            subtitle:
                "Requests use your verified country, state, and LGA so duplicate or out-of-area communities can be checked.",
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: "Community name"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: "Description",
              hintText: "Estate, street cluster, ward, or local safety group",
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _visibility,
            decoration: const InputDecoration(labelText: "Visibility"),
            items: const [
              DropdownMenuItem(value: "Public", child: Text("Public")),
              DropdownMenuItem(value: "Private", child: Text("Private")),
            ],
            onChanged: _submitting
                ? null
                : (value) => setState(() => _visibility = value ?? "Public"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _countryController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: "Country"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _stateController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: "State"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lgaController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: "LGA"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _wardController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: "Ward"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _estateController,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: "Estate"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _streetController,
            decoration: const InputDecoration(labelText: "Street"),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: BrandColors.danger)),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send),
            label: Text(_submitting ? "Submitting..." : "Submit request"),
          ),
        ],
      ),
    );
  }
}

class OutsideCurrentAreaNotice extends StatelessWidget {
  const OutsideCurrentAreaNotice({required this.status, super.key});

  final CommunityAccessStatus status;

  @override
  Widget build(BuildContext context) {
    if (!status.isOutsideCurrentArea) return const SizedBox.shrink();
    final semantics = EyeSemanticColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ListTileCard(
        leading: Icon(Icons.travel_explore, color: semantics.warning),
        title: status.title,
        subtitle: status.message,
      ),
    );
  }
}

class CommunityFeedScreen extends StatefulWidget {
  const CommunityFeedScreen({super.key});

  @override
  State<CommunityFeedScreen> createState() => _CommunityFeedScreenState();
}

class _CommunityFeedScreenState extends State<CommunityFeedScreen> {
  final TextEditingController _messageController = TextEditingController();
  EvidenceCaptureController? _chatEvidenceController;
  Timer? _roomPollTimer;
  bool _showAttachments = false;
  bool _sendingMessage = false;
  String? _pendingMessage;
  String? _sendError;
  String? _pendingClientMessageId;
  CommunityPostItem? _replyTo;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      if (controller.selectedCommunity == null) {
        await controller.loadCommunitiesFromApi(refresh: true);
      }
      await controller.loadCommunityFeed(refresh: true);
      _roomPollTimer = Timer.periodic(const Duration(seconds: 8), (_) {
        if (mounted && !_sendingMessage) {
          unawaited(appOf(context).loadCommunityFeed(refresh: true));
        }
      });
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_chatEvidenceController == null) {
      _chatEvidenceController = createEvidenceCaptureController(context);
      _chatEvidenceController!.addListener(_onChatEvidenceChanged);
    }
  }

  void _onChatEvidenceChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _roomPollTimer?.cancel();
    _messageController.dispose();
    _chatEvidenceController?.removeListener(_onChatEvidenceChanged);
    _chatEvidenceController?.dispose();
    super.dispose();
  }

  Future<void> _sendRoomMessage() async {
    final controller = appOf(context);
    final evidence = _chatEvidenceController;
    final body = _messageController.text.trim();
    final attachments = List<LocalEvidenceAttachment>.from(
      evidence?.attachments ?? const [],
    );
    if (_sendingMessage || (body.isEmpty && attachments.isEmpty)) return;
    final clientMessageId = _pendingClientMessageId ?? const Uuid().v4();
    setState(() {
      _sendingMessage = true;
      _pendingMessage = body;
      _pendingClientMessageId = clientMessageId;
      _sendError = null;
    });
    final error = await controller.createCommunityPost(
      type: "Discussion",
      title: body.isEmpty ? "Neighborhood media" : "Neighborhood conversation",
      body: body,
      attachments: attachments,
      clientMessageId: clientMessageId,
      replyToPostId: _replyTo?.id,
      onMediaProgress: (localId, progress) =>
          evidence?.markUploading(localId, progress),
    );
    if (!mounted) return;
    if (error != null) {
      setState(() {
        _sendingMessage = false;
        _sendError = error;
      });
      return;
    }
    for (final attachment in List<LocalEvidenceAttachment>.from(
      evidence?.attachments ?? const [],
    )) {
      evidence?.remove(attachment.localId);
    }
    _messageController.clear();
    setState(() {
      _sendingMessage = false;
      _pendingMessage = null;
      _pendingClientMessageId = null;
      _sendError = null;
      _showAttachments = false;
      _replyTo = null;
    });
  }

  void _returnToNeighborhoodWatchFeed() {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
      return;
    }
    navigator.pushReplacementNamed(NeighborhoodWatchDestinations.feed);
  }

  Future<void> _showRoomMessageActions(CommunityPostItem post) async {
    final controller = appOf(context);
    final ownMessage = post.authorId == controller.cachedCitizenProfile?.id;
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text("Reply"),
              onTap: () => Navigator.of(context).pop("reply"),
            ),
            if (ownMessage)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text("Edit message"),
                onTap: () => Navigator.of(context).pop("edit"),
              ),
            if (ownMessage)
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: const Text("Delete message"),
                onTap: () => Navigator.of(context).pop("delete"),
              ),
            ListTile(
              leading: const Icon(Icons.open_in_new),
              title: const Text("Open details"),
              onTap: () => Navigator.of(context).pop("open"),
            ),
          ],
        ),
      ),
    );
    if (!mounted || action == null) return;
    if (action == "reply") {
      setState(() => _replyTo = post);
      return;
    }
    if (action == "open") {
      _openDiscussion(controller, post);
      return;
    }
    if (action == "edit") {
      final editor = TextEditingController(text: post.body);
      final body = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text("Edit message"),
          content: TextField(
            controller: editor,
            autofocus: true,
            minLines: 2,
            maxLines: 6,
            decoration: const InputDecoration(hintText: "Message"),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text("Cancel"),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(editor.text.trim()),
              child: const Text("Save"),
            ),
          ],
        ),
      );
      editor.dispose();
      if (!mounted || body == null || body == post.body) return;
      final error = await controller.updateOwnCommunityMessage(post, body);
      if (mounted && error != null) {
        showAppSnackBar(context, error, isError: true);
      }
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Delete message?"),
        content: const Text(
            "This removes the message from the neighborhood conversation."),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text("Cancel"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text("Delete"),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    final error = await controller.deleteOwnCommunityMessage(post);
    if (mounted && error != null) {
      showAppSnackBar(context, error, isError: true);
    }
  }

  void _openDiscussion(AppController controller, CommunityPostItem post) {
    final community = controller.selectedCommunity;
    if (community == null) return;
    Navigator.of(context).pushNamed(
      NeighborhoodWatchDestinations.post(post.id),
      arguments: CommunityPostDetailRouteArgs(
        postId: post.id,
        postTitle: post.title,
        communityId: community.id,
        currentUserId: controller.cachedCitizenProfile?.id,
      ),
    );
  }

  Future<void> _toggleLike(
    AppController controller,
    CommunityPostItem post,
  ) async {
    final error = await controller.toggleCommunityPostLike(post);
    if (!mounted || error == null) return;
    showAppSnackBar(context, error, isError: true);
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final community = controller.selectedCommunity;
    final evidence = _chatEvidenceController;
    return GeoCommunityChatView(
      title: community == null ? "Community Chat" : community.name,
      subtitle: community == null
          ? null
          : [community.lga, community.state]
              .whereType<String>()
              .where((part) => part.trim().isNotEmpty)
              .join(" · "),
      messages: controller.communityFeed,
      canSend: controller.canStartCommunityConversation,
      loading: controller.loadingCommunityFeed,
      error: controller.communityFeedError,
      showAttachments: _showAttachments,
      sending: _sendingMessage,
      attachmentCount: evidence?.attachments.length ?? 0,
      messageController: _messageController,
      evidenceController: evidence,
      pendingMessage: _pendingMessage,
      sendError: _sendError,
      replyTo: _replyTo,
      currentUserId: controller.cachedCitizenProfile?.id,
      headerActions: _neighborhoodWatchHeaderActions(context),
      locationNotice: OutsideCurrentAreaNotice(
        status: controller.selectedCommunityAccessStatus,
      ),
      onRefresh: () => controller.loadCommunityFeed(refresh: true),
      onLoadOlder: controller.loadOlderCommunityMessages,
      hasOlderMessages: controller.communityFeedNextCursor != null,
      loadingOlderMessages: controller.loadingOlderCommunityMessages,
      onToggleAttachments: () =>
          setState(() => _showAttachments = !_showAttachments),
      onSend: _sendRoomMessage,
      onOpenMessage: (post) => _openDiscussion(controller, post),
      onReply: _showRoomMessageActions,
      onLike: (post) => unawaited(_toggleLike(controller, post)),
      onCancelReply: () => setState(() => _replyTo = null),
      onBack: _returnToNeighborhoodWatchFeed,
    );
  }
}

class _SelectedCommunityLocation {
  const _SelectedCommunityLocation({
    required this.latitude,
    required this.longitude,
    required this.label,
  });

  final double latitude;
  final double longitude;
  final String label;
}

class CreateCommunityPostScreen extends StatefulWidget {
  const CreateCommunityPostScreen({super.key});

  @override
  State<CreateCommunityPostScreen> createState() =>
      _CreateCommunityPostScreenState();
}

class _CreateCommunityPostScreenState extends State<CreateCommunityPostScreen> {
  static const _typeMap = {
    "Security Tip": "SafetyTip",
    "Report Activity": "SuspiciousActivity",
    "Road Hazard": "RoadHazard",
  };

  String _selectedType = "Security Tip";
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  final _evidenceSectionKey = GlobalKey<ManagedEvidenceSectionState>();
  final LocationReverseGeocoder _reverseGeocoder =
      const PlatformLocationReverseGeocoder();
  _SelectedCommunityLocation? _selectedLocation;
  bool _submitting = false;
  bool _capturingLocation = false;
  bool _urgent = false;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  String _buildGeneratedTitle(String body) {
    final prefix = _selectedType;
    final normalized = body.replaceAll(RegExp(r"\s+"), " ").trim();
    if (normalized.isEmpty) return prefix;
    final snippet = normalized.length > 48
        ? "${normalized.substring(0, 48).trim()}..."
        : normalized;
    return "$prefix: $snippet";
  }

  Future<void> _attachLocation() async {
    setState(() => _capturingLocation = true);
    try {
      final outcome = await captureLocationOutcome();
      if (!mounted) return;
      if (outcome.result != LocationCaptureResult.granted ||
          outcome.position == null) {
        showAppSnackBar(
          context,
          locationFailureMessage(outcome.result),
          isError: true,
        );
        return;
      }
      final position = outcome.position!;
      final geocode = await _reverseGeocoder.lookup(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      if (!mounted) return;
      final locationPresentation = CitizenLocationPresentation(
        streetAddress: geocode.street,
        subLocality: geocode.subLocality,
        cityTown: geocode.locality,
        lga: geocode.lga,
        state: geocode.state,
        country: geocode.country,
      );
      final label = locationPresentation.lines.isEmpty
          ? "Location acquired (address unavailable)"
          : locationPresentation.lines.join(", ");
      setState(() {
        _selectedLocation = _SelectedCommunityLocation(
          latitude: position.latitude,
          longitude: position.longitude,
          label: label,
        );
      });
    } finally {
      if (mounted) setState(() => _capturingLocation = false);
    }
  }

  Future<void> _submit() async {
    final body = _bodyController.text.trim();
    final attachments =
        _evidenceSectionKey.currentState?.attachments ?? const [];
    if (!hasValidReportNarrative(description: body, localMedia: attachments)) {
      showAppSnackBar(
        context,
        "Add a message, voice note, photo, or video before posting",
        isError: true,
      );
      return;
    }
    final title = _titleController.text.trim().isEmpty
        ? _buildGeneratedTitle(body)
        : _titleController.text.trim();
    setState(() => _submitting = true);
    final error = await appOf(context).createCommunityPost(
      type: _typeMap[_selectedType] ?? "SafetyTip",
      title: title,
      body: body,
      attachments: attachments,
      latitude: _selectedLocation?.latitude,
      longitude: _selectedLocation?.longitude,
      onMediaProgress: (localId, progress) =>
          _evidenceSectionKey.currentState?.markUploading(localId, progress),
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (error != null) {
      showAppSnackBar(context, error, isError: true);
      return;
    }
    showAppSnackBar(context, "Conversation posted for this area");
    Navigator.of(context)
        .pushReplacementNamed(NeighborhoodWatchDestinations.feed);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map) {
      final type = args["type"];
      if (type is String) {
        for (final entry in _typeMap.entries) {
          if (entry.value == type && entry.key != _selectedType) {
            setState(() => _selectedType = entry.key);
            break;
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        top: false,
        child: Align(
          alignment: Alignment.bottomCenter,
          child: FractionallySizedBox(
            heightFactor: 0.9,
            widthFactor: 1,
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(20)),
              child: NwPrototypeScaffold(
                title: "Share With Community",
                leading: NwPrototypeIconButton(
                  icon: Icons.close,
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
                body: ListView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: semantics.divider,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        NwPrototypeActionTile(
                          icon: Icons.tips_and_updates_outlined,
                          label: "Security Tip",
                          primary: _selectedType == "Security Tip",
                          onTap: () =>
                              setState(() => _selectedType = "Security Tip"),
                        ),
                        const SizedBox(width: 8),
                        NwPrototypeActionTile(
                          icon: Icons.report_outlined,
                          label: "Report Activity",
                          color: const Color(0xFF4A9DFF),
                          primary: _selectedType == "Report Activity",
                          onTap: () =>
                              setState(() => _selectedType = "Report Activity"),
                        ),
                        const SizedBox(width: 8),
                        NwPrototypeActionTile(
                          icon: Icons.warning_amber_outlined,
                          label: "Road Hazard",
                          color: semantics.success,
                          primary: _selectedType == "Road Hazard",
                          onTap: () =>
                              setState(() => _selectedType = "Road Hazard"),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    NwPrototypeCard(
                      child: Column(
                        children: [
                          TextField(
                            controller: _titleController,
                            maxLength: 120,
                            decoration:
                                const InputDecoration(labelText: "Title"),
                          ),
                          TextField(
                            controller: _bodyController,
                            minLines: 3,
                            maxLines: 5,
                            decoration:
                                const InputDecoration(labelText: "Details"),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    CheckboxListTile(
                      value: _urgent,
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      title: const Text("This is an immediate danger"),
                      subtitle: const Text(
                        "Switch to Emergency Reporting for urgent help.",
                      ),
                      onChanged: (value) =>
                          setState(() => _urgent = value ?? false),
                    ),
                    if (_urgent) ...[
                      NwPrototypeNotice(
                        title: "Switch to Active Emergency",
                        message:
                            "Use the emergency flow for immediate danger instead of posting into the community feed.",
                        icon: Icons.emergency_outlined,
                        color: BrandColors.danger,
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: semantics.error,
                            foregroundColor: semantics.textOnPrimary,
                          ),
                          onPressed: () => Navigator.of(context)
                              .pushNamed("/report/emergency"),
                          icon: const Icon(Icons.emergency),
                          label: const Text("Report Emergency"),
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    NwPrototypeCard(
                      child: ManagedEvidenceSection(
                        key: _evidenceSectionKey,
                        lowDataMode: appOf(context).lowDataMode,
                      ),
                    ),
                    const SizedBox(height: 12),
                    NwPrototypeListCard(
                      leading: const Icon(Icons.place_outlined),
                      title: _selectedLocation == null
                          ? "Attach location"
                          : "Location attached",
                      subtitle: _selectedLocation == null
                          ? "Optional. Add the relevant place for this post."
                          : _selectedLocation!.label,
                      trailing: _capturingLocation
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : IconButton(
                              icon: Icon(
                                _selectedLocation == null
                                    ? Icons.add_location_alt_outlined
                                    : Icons.close,
                              ),
                              onPressed: _selectedLocation == null
                                  ? _attachLocation
                                  : () =>
                                      setState(() => _selectedLocation = null),
                            ),
                      onTap: _capturingLocation
                          ? null
                          : (_selectedLocation == null
                              ? _attachLocation
                              : () => setState(() => _selectedLocation = null)),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text("Submit post"),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class CommunityMapScreen extends StatefulWidget {
  const CommunityMapScreen({super.key});

  @override
  State<CommunityMapScreen> createState() => _CommunityMapScreenState();
}

class _CommunityMapScreenState extends State<CommunityMapScreen> {
  String? _locationNotice;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      if (controller.selectedCommunity == null) {
        await controller.loadCommunitiesFromApi(refresh: true);
      }
      final permission = await resolveLocationPermission();
      if (!mounted) return;
      if (permission != LocationCaptureResult.granted) {
        setState(() => _locationNotice = nearbyLocationNotice(permission));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final community = controller.selectedCommunity;
    final semantics = EyeSemanticColors.of(context);
    return SafetyScaffold(
      title: "Community Map",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          OutsideCurrentAreaNotice(
            status: controller.selectedCommunityAccessStatus,
          ),
          if (_locationNotice != null) ...[
            LocationDeniedBanner(
              message: _locationNotice!,
              onOpenSettings: () => openAppSettings(),
            ),
            const SizedBox(height: 12),
          ],
          Container(
            height: 360,
            decoration: BoxDecoration(
              color: semantics.cardSurface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: semantics.border),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.map, size: 80, color: semantics.interactiveText),
                  if (community != null)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        "${community.name}\nPosts, incidents, patrol checkpoints, and stations load from the community map API.",
                        textAlign: TextAlign.center,
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const SectionCard(
            title: "Visible layers",
            child: Text(
              "Community posts, incidents, safe points, police stations, hospitals, patrol points, and danger zones.",
            ),
          ),
        ],
      ),
    );
  }
}

class CommunityChatScreen extends StatefulWidget {
  const CommunityChatScreen({super.key});

  @override
  State<CommunityChatScreen> createState() => _CommunityChatScreenState();
}

class _CommunityChatScreenState extends State<CommunityChatScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      if (controller.selectedCommunity == null) {
        await controller.loadCommunitiesFromApi(refresh: true);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final channels = controller.selectedCommunity?.channels ?? const [];
    return SafetyScaffold(
      title: "Community Chat",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          OutsideCurrentAreaNotice(
            status: controller.selectedCommunityAccessStatus,
          ),
          if (channels.isEmpty)
            const ListTileCard(
              leading: Icon(Icons.forum),
              title: "No channels available",
              subtitle: "Join an approved community to access channels.",
            )
          else
            ...channels.map((channel) => ListTileCard(
                  leading: const Icon(Icons.forum),
                  title: channel.name,
                  subtitle: channel.type,
                )),
        ],
      ),
    );
  }
}

class VolunteersScreen extends StatefulWidget {
  const VolunteersScreen({super.key});

  @override
  State<VolunteersScreen> createState() => _VolunteersScreenState();
}

class _VolunteersScreenState extends State<VolunteersScreen> {
  bool _registering = false;
  final VolunteerCategorySelection _selection = VolunteerCategorySelection();

  void _toggleCategory(String apiType) {
    setState(() => _selection.toggle(apiType));
  }

  Future<void> _register() async {
    final controller = appOf(context);
    final community = controller.selectedCommunity;
    if (community == null || !controller.isAuthenticated) return;
    final validationError = _selection.validationError();
    if (validationError != null) {
      showAppSnackBar(context, validationError, isError: true);
      return;
    }
    setState(() => _registering = true);
    try {
      final location = await captureLocationOutcome();
      await NeighborhoodWatchService(apiClient: appOf(context).apiClient)
          .registerVolunteer(
        accessToken: controller.accessToken!,
        communityId: community.id,
        types: _selection.toPayload(),
        latitude: location.position?.latitude,
        longitude: location.position?.longitude,
      );
      if (!mounted) return;
      showAppSnackBar(context, "Volunteer registration submitted");
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showAppSnackBar(context, error.userMessage, isError: true);
    } catch (_) {
      if (!mounted) return;
      showAppSnackBar(context, "Unable to register as volunteer",
          isError: true);
    } finally {
      if (mounted) setState(() => _registering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    return SafetyScaffold(
      title: "Volunteers",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          OutsideCurrentAreaNotice(
            status: controller.selectedCommunityAccessStatus,
          ),
          FilledButton.icon(
            onPressed: _registering ? null : _register,
            icon: const Icon(Icons.volunteer_activism),
            label:
                Text(_registering ? "Registering..." : "Register as volunteer"),
          ),
          const SizedBox(height: 16),
          ...canonicalVolunteerCategories.map(
            (category) => ListTileCard(
              leading: const Icon(Icons.health_and_safety),
              title: category.label,
              subtitle: "Notify nearby volunteers during emergencies",
              trailing: _selection.isSelected(category.apiType)
                  ? Icon(Icons.check_circle,
                      color: EyeSemanticColors.of(context).primaryAction)
                  : null,
              onTap: () => _toggleCategory(category.apiType),
            ),
          ),
        ],
      ),
    );
  }
}

class PatrolsScreen extends StatefulWidget {
  const PatrolsScreen({this.highlightScheduleId, super.key});

  final String? highlightScheduleId;

  @override
  State<PatrolsScreen> createState() => _PatrolsScreenState();
}

class _PatrolsScreenState extends State<PatrolsScreen> {
  List<PatrolScheduleItem> _activePatrols(List<PatrolScheduleItem> patrols) {
    return patrols
        .where((patrol) => patrol.status.toLowerCase() == "active")
        .toList();
  }

  PatrolScheduleItem? _selectCheckpointPatrol(
      List<PatrolScheduleItem> patrols) {
    final active = _activePatrols(patrols);
    if (active.isNotEmpty) return active.first;
    return null;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      if (controller.selectedCommunity == null) {
        await controller.loadCommunitiesFromApi(refresh: true);
      }
      await controller.loadCommunityPatrols();
    });
  }

  Future<void> _logCheckpoint() async {
    final controller = appOf(context);
    final activePatrol = _selectCheckpointPatrol(controller.communityPatrols);
    if (activePatrol == null || controller.accessToken == null) {
      final hasScheduled = controller.communityPatrols.isNotEmpty;
      showAppSnackBar(
        context,
        hasScheduled
            ? "No active patrol is running right now. Check upcoming schedules or ask a coordinator to start one."
            : "No patrol schedules are available for your community yet.",
        isError: true,
      );
      return;
    }
    final schedule = activePatrol;
    try {
      final location = await captureLocationOutcome();
      if (location.position == null) {
        showAppSnackBar(context, "Location permission is required",
            isError: true);
        return;
      }
      await NeighborhoodWatchService(apiClient: appOf(context).apiClient)
          .logCheckpoint(
        accessToken: controller.accessToken!,
        scheduleId: schedule.id,
        label: "Mobile checkpoint",
        latitude: location.position!.latitude,
        longitude: location.position!.longitude,
      );
      if (!mounted) return;
      showAppSnackBar(context, "Checkpoint logged");
      await controller.loadCommunityPatrols();
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showAppSnackBar(context, error.userMessage, isError: true);
    }
  }

  Future<void> _openPatrol(PatrolScheduleItem patrol) async {
    final controller = appOf(context);
    final accessToken = controller.accessToken;
    if (accessToken == null || accessToken.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => PatrolDetailSheet(
        accessToken: accessToken,
        patrol: patrol,
      ),
    );
    if (mounted) await controller.loadCommunityPatrols();
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final activePatrols = _activePatrols(controller.communityPatrols);
    return NwPrototypeScaffold(
      title: "Patrols",
      leading: NwPrototypeIconButton(
        icon: Icons.arrow_back,
        onPressed: () => Navigator.of(context).maybePop(),
      ),
      body: RefreshIndicator(
        onRefresh: () => controller.loadCommunityPatrols(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            OutsideCurrentAreaNotice(
              status: controller.selectedCommunityAccessStatus,
            ),
            if (controller.loadingCommunityPatrols &&
                controller.communityPatrols.isEmpty)
              const Center(child: CircularProgressIndicator())
            else if (controller.communityPatrolError != null &&
                controller.communityPatrols.isEmpty)
              NwPrototypeListCard(
                leading: const Icon(Icons.cloud_off),
                title: "Patrol schedules unavailable",
                subtitle: controller.communityPatrolError ?? "Unknown error",
              )
            else if (controller.communityPatrols.isEmpty)
              const NwPrototypeListCard(
                leading: Icon(Icons.security),
                title: "No patrol schedules",
                subtitle: "Community patrols will appear here when scheduled.",
              )
            else ...[
              if (activePatrols.isEmpty)
                const NwPrototypeListCard(
                  leading: Icon(Icons.info_outline),
                  title: "No active patrol right now",
                  subtitle:
                      "Upcoming patrols are listed below. Checkpoints can only be logged during an active patrol you are authorized for.",
                ),
              ...controller.communityPatrols.map((patrol) {
                final highlighted = widget.highlightScheduleId != null &&
                    widget.highlightScheduleId == patrol.id;
                final isActive = patrol.status.toLowerCase() == "active";
                final tone =
                    isActive ? BrandColors.green : const Color(0xFF4A9DFF);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: NwPrototypeListCard(
                    leading: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: tone.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        isActive ? Icons.play_circle : Icons.route,
                        color: tone,
                      ),
                    ),
                    title: patrol.title,
                    subtitle: highlighted
                        ? "${patrol.status} • ${patrol.startsAt ?? "TBD"} • Deep link match"
                        : "${patrol.status} • ${patrol.startsAt ?? "TBD"}",
                    badge: NwPrototypePill(
                      label: patrol.status,
                      selected: isActive,
                      color: tone,
                    ),
                    trailing: Text(
                      "${patrol.participantCount} members",
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    onTap: () => _openPatrol(patrol),
                  ),
                );
              }),
            ],
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: activePatrols.isEmpty ? null : _logCheckpoint,
                icon: const Icon(Icons.add_location_alt),
                label: const Text("Log patrol checkpoint"),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PatrolDetailSheet extends StatefulWidget {
  const PatrolDetailSheet({
    required this.accessToken,
    required this.patrol,
    super.key,
  });

  final String accessToken;
  final PatrolScheduleItem patrol;

  @override
  State<PatrolDetailSheet> createState() => _PatrolDetailSheetState();
}

class _PatrolDetailSheetState extends State<PatrolDetailSheet> {
  late PatrolScheduleItem _patrol = widget.patrol;
  bool _loading = true;
  bool _joining = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final patrol = await NeighborhoodWatchService(
        apiClient: appOf(context).apiClient,
      ).getPatrol(
        accessToken: widget.accessToken,
        scheduleId: widget.patrol.id,
      );
      if (!mounted) return;
      setState(() {
        _patrol = patrol;
        _loading = false;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Patrol unavailable.";
        _loading = false;
      });
    }
  }

  Future<void> _join() async {
    if (_joining || !_patrol.canJoin || _patrol.isParticipant) return;
    setState(() => _joining = true);
    try {
      await NeighborhoodWatchService(apiClient: appOf(context).apiClient)
          .joinPatrol(
        accessToken: widget.accessToken,
        scheduleId: _patrol.id,
      );
      if (!mounted) return;
      setState(() {
        _joining = false;
        _patrol = PatrolScheduleItem(
          id: _patrol.id,
          title: _patrol.title,
          status: _patrol.status,
          startsAt: _patrol.startsAt,
          endsAt: _patrol.endsAt,
          communityId: _patrol.communityId,
          routeDescription: _patrol.routeDescription,
          participantCount: _patrol.participantCount + 1,
          isParticipant: true,
          canJoin: _patrol.canJoin,
        );
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _joining = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.userMessage)),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _joining = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Unable to join patrol.")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        child: _loading
            ? const SizedBox(
                height: 220,
                child: Center(child: CircularProgressIndicator()),
              )
            : _error != null
                ? SizedBox(
                    height: 220,
                    child: Center(child: Text(_error!)),
                  )
                : NwPrototypeCard(
                    child: ListView(
                      shrinkWrap: true,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _patrol.title,
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineSmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                            ),
                            NwPrototypePill(
                              label: _patrol.status,
                              selected:
                                  _patrol.status.toLowerCase() == "active",
                              color: _patrol.status.toLowerCase() == "active"
                                  ? BrandColors.green
                                  : const Color(0xFF4A9DFF),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text("Starts: ${_patrol.startsAt ?? "TBD"}"),
                        Text("Ends: ${_patrol.endsAt ?? "TBD"}"),
                        Text(
                          "Participating members: ${_patrol.participantCount}",
                        ),
                        const SizedBox(height: 12),
                        Text(_patrol.routeDescription ??
                            "General route information is available to approved community members."),
                        const SizedBox(height: 12),
                        const Text(
                            "Follow community safety instructions. Do not confront suspicious persons. Report immediate danger through THE EYE Emergency."),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context)
                              .pushNamed("/report/emergency"),
                          icon: const Icon(Icons.emergency_outlined),
                          label:
                              const Text("Immediate danger? Report Emergency"),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: _patrol.isParticipant ||
                                  !_patrol.canJoin ||
                                  _joining
                              ? null
                              : _join,
                          child: Text(_patrol.isParticipant
                              ? "Joined"
                              : _joining
                                  ? "Joining..."
                                  : "Join Patrol"),
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class NeighborhoodWatchBroadcastsScreen extends StatefulWidget {
  const NeighborhoodWatchBroadcastsScreen({super.key});

  @override
  State<NeighborhoodWatchBroadcastsScreen> createState() =>
      _NeighborhoodWatchBroadcastsScreenState();
}

class _NeighborhoodWatchBroadcastsScreenState
    extends State<NeighborhoodWatchBroadcastsScreen> {
  List<BroadcastFeedItem> _items = const [];
  String _selectedFilter = "All";
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_load());
    });
  }

  Future<void> _load() async {
    final controller = appOf(context);
    final token = controller.accessToken;
    if (!controller.isAuthenticated || token == null) {
      if (mounted) Navigator.of(context).pushReplacementNamed("/login");
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await controller.broadcastFeedService.listCountryWide(
        accessToken: token,
      );
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _loading = false;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error =
            error is StateError ? error.message : "Unable to load broadcasts.";
        _loading = false;
      });
    }
  }

  bool _matchesBroadcastFilter(BroadcastFeedItem item) {
    return switch (_selectedFilter) {
      "Active" => item.status.toLowerCase() == "active" && !item.expired,
      "Resolved" => item.status.toLowerCase() == "resolved" || item.expired,
      "Official" => item.adminVerified,
      _ => true,
    };
  }

  Widget _buildBroadcastList() {
    final visibleItems = _items.where(_matchesBroadcastFilter).toList();
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      children: [
        NwPrototypeFilterChips(
          labels: const ["All", "Active", "Resolved", "Official"],
          selectedLabel: _selectedFilter,
          onSelected: (value) => setState(() => _selectedFilter = value),
        ),
        const SizedBox(height: 14),
        if (_loading && _items.isEmpty) ...[
          const SizedBox(height: 120),
          const Center(child: CircularProgressIndicator()),
        ] else if (_error != null && _items.isEmpty) ...[
          const NwPrototypeListCard(
            leading: Icon(Icons.cloud_off),
            title: "Unable to load broadcasts.",
            subtitle: "Try again in a moment.",
          ),
          const SizedBox(height: 8),
          Text(_error!),
          const SizedBox(height: 12),
          FilledButton(onPressed: _load, child: const Text("Retry")),
        ] else if (_items.isEmpty) ...[
          const NwPrototypeListCard(
            leading: Icon(Icons.campaign_outlined),
            title: "No active broadcasts in this area",
            subtitle:
                "There are no active safety broadcasts to show right now.",
          ),
        ] else if (visibleItems.isEmpty) ...[
          NwPrototypeListCard(
            leading: const Icon(Icons.filter_alt_off_outlined),
            title: "No $_selectedFilter broadcasts",
            subtitle: "Try another broadcast filter.",
          ),
        ] else
          ...visibleItems.map((item) {
            final presentation = CitizenBroadcastPresenter.present(
              item,
              AppLocalizations.of(context),
            );
            final active =
                item.status.toLowerCase() == "active" && !item.expired;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: NwPrototypeListCard(
                leading: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0x144A9DFF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.campaign_outlined,
                    color: Color(0xFF4A9DFF),
                  ),
                ),
                title: presentation.title,
                subtitle:
                    "${presentation.summary}\n${presentation.metadataLine}",
                badge: NwPrototypePill(
                  label: item.adminVerified
                      ? "Official"
                      : presentation.statusLabel,
                  selected: active || item.adminVerified,
                  color: active
                      ? BrandColors.green
                      : item.adminVerified
                          ? const Color(0xFFFF9933)
                          : const Color(0xFF4A9DFF),
                ),
                onTap: () {
                  final route = broadcastDetailRoute(item.id);
                  if (route != null) Navigator.of(context).pushNamed(route);
                },
              ),
            );
          }),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return NwPrototypeScaffold(
      title: "Neighborhood Watch",
      actions: _neighborhoodWatchHeaderActions(context),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _buildBroadcastList(),
      ),
    );
  }
}

class CommunityAlertsScreen extends StatefulWidget {
  const CommunityAlertsScreen({super.key});

  @override
  State<CommunityAlertsScreen> createState() => _CommunityAlertsScreenState();
}

class _CommunityAlertsScreenState extends State<CommunityAlertsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = appOf(context);
      if (!controller.isAuthenticated) {
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }
      if (controller.selectedCommunity == null) {
        await controller.loadCommunitiesFromApi(refresh: true);
      }
      await controller.loadCommunityAlerts(refresh: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    return SafetyScaffold(
      title: "Community Alerts",
      selectedIndex: 3,
      body: RefreshIndicator(
        onRefresh: () => controller.loadCommunityAlerts(refresh: true),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            OutsideCurrentAreaNotice(
              status: controller.selectedCommunityAccessStatus,
            ),
            if (controller.loadingCommunityAlerts &&
                controller.communityAlerts.isEmpty)
              const Center(child: CircularProgressIndicator())
            else if (controller.communityAlertsError != null &&
                controller.communityAlerts.isEmpty)
              ListTileCard(
                leading: const Icon(Icons.cloud_off),
                title: "Alerts unavailable",
                subtitle: controller.communityAlertsError ?? "Unknown error",
              )
            else if (controller.communityAlerts.isEmpty)
              const ListTileCard(
                leading: Icon(Icons.campaign),
                title: "No active alerts",
                subtitle: "Verified community alerts will appear here.",
              )
            else
              ...controller.communityAlerts.map((alert) => ListTileCard(
                    leading: const Icon(Icons.campaign),
                    title: alert.title,
                    subtitle:
                        "${alert.type} • ${alert.verificationStatus} • ${alert.confidenceScore.round()}%",
                  )),
          ],
        ),
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Profile",
      selectedIndex: 4,
      useFigmaShell: true,
      body: ProfileScreenBody(apiClient: appOf(context).apiClient),
    );
  }
}

class YourCarScreen extends StatefulWidget {
  const YourCarScreen({super.key});

  @override
  State<YourCarScreen> createState() => _YourCarScreenState();
}

class _YourCarScreenState extends State<YourCarScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(appOf(context).loadVehicleGarage(refresh: true));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final vehicles = controller.vehicles;
    return SafetyScaffold(
      title: "My Vehicles",
      useFigmaShell: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "My Vehicles",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (vehicles.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: Text(
                      "No vehicles added yet. Add a vehicle to speed up stolen vehicle broadcasts.",
                    ),
                  ),
                ...vehicles.map((vehicle) {
                  final label = "${vehicle.make} ${vehicle.model}".trim();
                  final subtitle = [
                    if ((vehicle.color ?? "").trim().isNotEmpty)
                      vehicle.color!.trim(),
                    vehicle.plateNumber,
                  ].join(" • ");
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: const Icon(Icons.directions_car),
                      title: Row(
                        children: [
                          Expanded(
                              child: Text(label.isEmpty ? "Vehicle" : label)),
                          if (vehicle.isPrimary)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color:
                                    BrandColors.green.withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: const Text(
                                "PRIMARY",
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                        ],
                      ),
                      subtitle: Text("$subtitle\nView details"),
                      isThreeLine: true,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).pushNamed(
                        "/your-car/detail",
                        arguments: _VehicleEditorArgs(vehicleId: vehicle.id),
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).pushNamed(
                    "/your-car/detail",
                    arguments: const _VehicleEditorArgs(),
                  ),
                  icon: const Icon(Icons.add),
                  label: const Text("Add Vehicle"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VehicleEditorArgs {
  const _VehicleEditorArgs(
      {this.vehicleId, this.returnToStolenVehicle = false});

  final String? vehicleId;
  final bool returnToStolenVehicle;
}

class VehicleDetailScreen extends StatefulWidget {
  const VehicleDetailScreen(
      {super.key, this.args = const _VehicleEditorArgs()});

  final _VehicleEditorArgs args;

  @override
  State<VehicleDetailScreen> createState() => _VehicleDetailScreenState();
}

enum _VehiclePhotoUploadState { local, uploading, uploaded, failed }

class _VehiclePhotoDraft {
  const _VehiclePhotoDraft({
    this.id,
    this.objectKey,
    this.localPath,
    this.previewUrl,
    required this.contentType,
    this.angle = VehiclePhotoAngle.other,
    this.sizeBytes,
    this.sortOrder = 0,
    this.createdAt,
    this.uploadState = _VehiclePhotoUploadState.local,
    this.errorMessage,
  });

  final String? id;
  final String? objectKey;
  final String? localPath;
  final String? previewUrl;
  final String contentType;
  final VehiclePhotoAngle angle;
  final int? sizeBytes;
  final int sortOrder;
  final DateTime? createdAt;
  final _VehiclePhotoUploadState uploadState;
  final String? errorMessage;

  _VehiclePhotoDraft copyWith({
    String? id,
    String? objectKey,
    String? localPath,
    String? previewUrl,
    String? contentType,
    VehiclePhotoAngle? angle,
    int? sizeBytes,
    int? sortOrder,
    DateTime? createdAt,
    _VehiclePhotoUploadState? uploadState,
    String? errorMessage,
  }) {
    return _VehiclePhotoDraft(
      id: id ?? this.id,
      objectKey: objectKey ?? this.objectKey,
      localPath: localPath ?? this.localPath,
      previewUrl: previewUrl ?? this.previewUrl,
      contentType: contentType ?? this.contentType,
      angle: angle ?? this.angle,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
      uploadState: uploadState ?? this.uploadState,
      errorMessage: errorMessage,
    );
  }
}

class _VehicleDetailScreenState extends State<VehicleDetailScreen> {
  static const _vehiclePhotoLimitMessage =
      "You can add up to 8 photos for each vehicle.";

  final makeController = TextEditingController();
  final modelController = TextEditingController();
  final yearController = TextEditingController();
  final colorController = TextEditingController();
  final plateController = TextEditingController();
  final vinController = TextEditingController();
  final notesController = TextEditingController();
  final List<_VehiclePhotoDraft> _photos = [];
  final Set<String> _removedRemotePhotoIds = <String>{};
  String? vehicleId;
  bool isPrimary = false;
  bool saving = false;
  bool initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (initialized) return;
    initialized = true;
    final targetId = widget.args.vehicleId;
    CarProfile? profile;
    for (final candidate in appOf(context).vehicles) {
      if (candidate.id == targetId) {
        profile = candidate;
        break;
      }
    }
    if (profile != null) {
      vehicleId = profile.id;
      makeController.text = profile.make;
      modelController.text = profile.model;
      yearController.text = profile.year?.toString() ?? "";
      colorController.text = profile.color ?? "";
      plateController.text = profile.plateNumber;
      vinController.text = profile.vin ?? "";
      notesController.text = profile.notes ?? "";
      isPrimary = profile.isPrimary;
      _photos.addAll(
        profile.photos.map(
          (photo) => _VehiclePhotoDraft(
            id: photo.id,
            objectKey: photo.objectKey,
            previewUrl: photo.previewUrl,
            contentType: photo.contentType ?? "image/jpeg",
            angle: VehiclePhotoAngle.fromApi(photo.angle),
            sizeBytes: photo.sizeBytes,
            sortOrder: photo.sortOrder,
            createdAt: photo.createdAt,
            uploadState: _VehiclePhotoUploadState.uploaded,
          ),
        ),
      );
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
    return persistPickedVehicleImage(picked);
  }

  Future<void> _addVehiclePhoto() async {
    final angle = await chooseVehiclePhotoAngle(context);
    if (angle == null || !mounted) return;
    final source = await chooseVehiclePhotoSource(context);
    if (source == null || !mounted) return;
    await _pickImage(
      source == ImageSourceChoice.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      angle,
    );
  }

  Future<void> _pickImage(
    ImageSource source,
    VehiclePhotoAngle angle,
  ) async {
    final picker = ImagePicker();
    if (source == ImageSource.gallery) {
      final picked = await picker.pickMultiImage(
        maxWidth: 1920,
        imageQuality: 85,
      );
      if (!mounted || picked.isEmpty) return;
      await _addPickedImages(picked, angle);
      return;
    }
    final picked = await picker.pickImage(
      source: source,
      maxWidth: 1920,
      imageQuality: 85,
    );
    if (!mounted || picked == null) return;
    await _addPickedImages([picked], angle);
  }

  Future<void> _addPickedImages(
    List<XFile> pickedImages,
    VehiclePhotoAngle angle,
  ) async {
    if (_photos.length + pickedImages.length >
        EvidencePolicy.vehiclePhotos.maxPhotos) {
      showAppSnackBar(context, _vehiclePhotoLimitMessage, isError: true);
      return;
    }
    for (final picked in pickedImages) {
      final fileName = p.basename(picked.path);
      final contentType = EvidenceValidation.normalizeMimeType(
        picked.mimeType,
        fileName: fileName,
      );
      if (!EvidencePolicy.vehiclePhotos.supportedMimeTypes
          .contains(contentType)) {
        showAppSnackBar(context, "Vehicle photos must be JPEG, PNG, or WebP.",
            isError: true);
        continue;
      }
      final savedPath = await _persistCarImage(picked);
      if (!mounted) return;
      if (savedPath == null) {
        showAppSnackBar(
          context,
          "Unable to prepare vehicle photo. Try another image.",
          isError: true,
        );
        continue;
      }
      final sizeBytes = await File(savedPath).length();
      if (sizeBytes > EvidencePolicy.vehiclePhotos.maxFileSize) {
        await File(savedPath).delete();
        if (!mounted) return;
        showAppSnackBar(context, "Each vehicle photo must be 5 MB or smaller.",
            isError: true);
        continue;
      }
      setState(() {
        _photos.add(
          _VehiclePhotoDraft(
            localPath: savedPath,
            previewUrl: savedPath,
            contentType: contentType,
            angle: angle,
            sizeBytes: sizeBytes,
            uploadState: _VehiclePhotoUploadState.local,
          ),
        );
      });
    }
  }

  Future<void> _previewPhoto(_VehiclePhotoDraft photo) async {
    final preview = photo.previewUrl ?? photo.localPath;
    if (preview == null) return;
    await showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        child: preview.startsWith("http://") || preview.startsWith("https://")
            ? Image.network(preview, fit: BoxFit.contain)
            : Image.file(File(preview), fit: BoxFit.contain),
      ),
    );
  }

  void _removePhoto(int index) {
    final photo = _photos[index];
    if ((photo.id ?? "").isNotEmpty) {
      _removedRemotePhotoIds.add(photo.id!);
    }
    final localPath = photo.localPath;
    if (localPath != null &&
        localPath.isNotEmpty &&
        File(localPath).existsSync()) {
      unawaited(File(localPath).delete());
    }
    setState(() => _photos.removeAt(index));
  }

  Future<int> _uploadPendingPhotos({
    required String accessToken,
    required String resolvedVehicleId,
  }) async {
    var failedCount = 0;
    final api = appOf(context).apiClient;
    for (var index = 0; index < _photos.length; index++) {
      final photo = _photos[index];
      final localPath = photo.localPath;
      if (photo.uploadState == _VehiclePhotoUploadState.uploaded ||
          localPath == null ||
          localPath.isEmpty) {
        continue;
      }
      setState(() {
        _photos[index] = photo.copyWith(
          uploadState: _VehiclePhotoUploadState.uploading,
          errorMessage: null,
        );
      });
      try {
        final sizeBytes = photo.sizeBytes ?? await File(localPath).length();
        final presigned = await api.presignVehiclePhoto(
          accessToken: accessToken,
          vehicleId: resolvedVehicleId,
          contentType: photo.contentType,
          fileName: p.basename(localPath),
          sizeBytes: sizeBytes,
        );
        await api.uploadPresignedEvidence(
          uploadUrl: presigned.uploadUrl,
          filePath: localPath,
          contentType: photo.contentType,
          requiredHeaders: presigned.requiredHeaders,
        );
        final confirmed = await api.confirmVehiclePhoto(
          accessToken: accessToken,
          vehicleId: resolvedVehicleId,
          objectKey: presigned.objectKey,
          contentType: photo.contentType,
          angle: photo.angle.apiValue,
          sizeBytes: sizeBytes,
          sortOrder: index,
        );
        if (!mounted) return failedCount;
        setState(() {
          _photos[index] = _VehiclePhotoDraft(
            id: confirmed.id,
            objectKey: confirmed.objectKey,
            localPath: localPath,
            previewUrl: confirmed.signedGetUrl ?? localPath,
            contentType: confirmed.contentType,
            angle: VehiclePhotoAngle.fromApi(confirmed.angle),
            sizeBytes: confirmed.sizeBytes,
            sortOrder: confirmed.sortOrder,
            createdAt: confirmed.createdAt,
            uploadState: _VehiclePhotoUploadState.uploaded,
          );
        });
      } catch (error) {
        failedCount += 1;
        if (!mounted) return failedCount;
        setState(() {
          _photos[index] = photo.copyWith(
            uploadState: _VehiclePhotoUploadState.failed,
            errorMessage: error is AuthApiException
                ? error.userMessage
                : "Upload failed.",
          );
        });
      }
    }
    return failedCount;
  }

  Future<void> _retryPhotoAt(int index) async {
    final token = appOf(context).accessToken;
    final resolvedVehicleId = vehicleId;
    if (token == null ||
        token.isEmpty ||
        resolvedVehicleId == null ||
        resolvedVehicleId.isEmpty) {
      showAppSnackBar(context, "Save the vehicle first before retrying.",
          isError: true);
      return;
    }
    if (index < 0 || index >= _photos.length) return;
    final photo = _photos[index];
    final localPath = photo.localPath;
    if (localPath == null || localPath.isEmpty) return;
    final api = appOf(context).apiClient;
    setState(() {
      _photos[index] = photo.copyWith(
        uploadState: _VehiclePhotoUploadState.uploading,
        errorMessage: null,
      );
    });
    try {
      final sizeBytes = photo.sizeBytes ?? await File(localPath).length();
      final presigned = await api.presignVehiclePhoto(
        accessToken: token,
        vehicleId: resolvedVehicleId,
        contentType: photo.contentType,
        fileName: p.basename(localPath),
        sizeBytes: sizeBytes,
      );
      await api.uploadPresignedEvidence(
        uploadUrl: presigned.uploadUrl,
        filePath: localPath,
        contentType: photo.contentType,
        requiredHeaders: presigned.requiredHeaders,
      );
      final confirmed = await api.confirmVehiclePhoto(
        accessToken: token,
        vehicleId: resolvedVehicleId,
        objectKey: presigned.objectKey,
        contentType: photo.contentType,
        angle: photo.angle.apiValue,
        sizeBytes: sizeBytes,
        sortOrder: index,
      );
      if (!mounted) return;
      setState(() {
        _photos[index] = _VehiclePhotoDraft(
          id: confirmed.id,
          objectKey: confirmed.objectKey,
          localPath: localPath,
          previewUrl: confirmed.signedGetUrl ?? localPath,
          contentType: confirmed.contentType,
          angle: VehiclePhotoAngle.fromApi(confirmed.angle),
          sizeBytes: confirmed.sizeBytes,
          sortOrder: confirmed.sortOrder,
          createdAt: confirmed.createdAt,
          uploadState: _VehiclePhotoUploadState.uploaded,
        );
      });
      await appOf(context).loadVehicleGarage(refresh: true);
      if (!mounted) return;
      showAppSnackBar(context, "Photo upload completed.");
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _photos[index] = photo.copyWith(
          uploadState: _VehiclePhotoUploadState.failed,
          errorMessage:
              error is AuthApiException ? error.userMessage : "Upload failed.",
        );
      });
      showAppSnackBar(
        context,
        error is AuthApiException ? error.userMessage : "Upload failed.",
        isError: true,
      );
    }
  }

  Future<void> _retryFailedPhoto() async {
    final token = appOf(context).accessToken;
    final resolvedVehicleId = vehicleId;
    if (token == null ||
        token.isEmpty ||
        resolvedVehicleId == null ||
        resolvedVehicleId.isEmpty) {
      showAppSnackBar(context, "Save the vehicle first before retrying.",
          isError: true);
      return;
    }
    final failedCount = await _uploadPendingPhotos(
      accessToken: token,
      resolvedVehicleId: resolvedVehicleId,
    );
    await appOf(context).loadVehicleGarage(refresh: true);
    if (!mounted) return;
    if (failedCount > 0) {
      showAppSnackBar(context, "Some photos are still failing.", isError: true);
      return;
    }
    showAppSnackBar(context, "Photo uploads completed.");
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
    final uploadedPhotoRefs = _photos
        .where(
            (photo) => photo.uploadState == _VehiclePhotoUploadState.uploaded)
        .map(
          (photo) => CarPhotoRef(
            id: photo.id,
            objectKey: photo.objectKey,
            contentType: photo.contentType,
            angle: photo.angle.apiValue,
            sizeBytes: photo.sizeBytes,
            sortOrder: photo.sortOrder,
            createdAt: photo.createdAt,
            previewUrl: photo.previewUrl ?? photo.localPath,
          ),
        )
        .toList(growable: false);
    final profile = CarProfile(
      id: vehicleId,
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
      imagePath: _photos.isNotEmpty
          ? (_photos.first.previewUrl ?? _photos.first.localPath)
          : null,
      photos: uploadedPhotoRefs,
      isPrimary: isPrimary,
    );

    try {
      final token = appOf(context).accessToken;
      if (token == null || token.isEmpty) {
        throw StateError("Sign in to save vehicles");
      }
      if (vehicleId == null || vehicleId!.isEmpty) {
        final created = await appOf(context).addVehicle(profile);
        vehicleId = created.id;
        isPrimary = created.isPrimary;
      } else {
        final updated = await appOf(context).updateVehicle(profile);
        vehicleId = updated.id;
        isPrimary = updated.isPrimary;
      }
      final resolvedVehicleId = vehicleId;
      if (resolvedVehicleId == null || resolvedVehicleId.isEmpty) {
        throw StateError("Vehicle save did not return an id");
      }
      if (_removedRemotePhotoIds.isNotEmpty) {
        final api = appOf(context).apiClient;
        for (final photoId in _removedRemotePhotoIds.toList(growable: false)) {
          await api.deleteVehiclePhoto(
            accessToken: token,
            vehicleId: resolvedVehicleId,
            photoId: photoId,
          );
          _removedRemotePhotoIds.remove(photoId);
        }
      }
      final failedCount = await _uploadPendingPhotos(
        accessToken: token,
        resolvedVehicleId: resolvedVehicleId,
      );
      await appOf(context).loadVehicleGarage(refresh: true);
      if (!mounted) return;
      setState(() => saving = false);
      if (failedCount > 0) {
        showAppSnackBar(
          context,
          "Vehicle details were saved, but some photos failed to upload. Retry the failed ones.",
          isError: true,
        );
        return;
      }
      showAppSnackBar(context, "Vehicle saved.");
      Navigator.of(context).pop(
        widget.args.returnToStolenVehicle ? vehicleId : null,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => saving = false);
      final message = error is AuthApiException
          ? error.userMessage
          : error is StateError
              ? error.message
              : "Unable to save vehicle details.";
      showAppSnackBar(context, message, isError: true);
    }
  }

  Future<void> _removeCar() async {
    final id = vehicleId;
    if (id == null || id.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Delete this vehicle?"),
        content: const Text(
            "If this is your primary vehicle, the most recently updated remaining vehicle becomes primary automatically."),
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
    await appOf(context).deleteVehicle(id);
    if (!mounted) return;
    showAppSnackBar(context, "Vehicle deleted.");
    Navigator.of(context).pop();
  }

  Future<void> _setPrimary() async {
    final id = vehicleId;
    if (id == null || id.isEmpty) return;
    setState(() => saving = true);
    try {
      await appOf(context).setPrimaryVehicle(id);
      if (!mounted) return;
      setState(() {
        isPrimary = true;
        saving = false;
      });
      showAppSnackBar(context, "Primary vehicle updated.");
    } catch (_) {
      if (!mounted) return;
      setState(() => saving = false);
      showAppSnackBar(context, "Unable to set primary vehicle.", isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editingExisting = vehicleId != null && vehicleId!.isNotEmpty;
    final hasFailed = _photos.any(
      (photo) => photo.uploadState == _VehiclePhotoUploadState.failed,
    );
    return SafetyScaffold(
      title: editingExisting ? "Vehicle details" : "Add vehicle",
      useFigmaShell: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Vehicle details",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_photos.isEmpty)
                  Container(
                    height: 180,
                    decoration: BoxDecoration(
                      color: context.eyeSurfaceMuted,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: context.eyeBorder),
                    ),
                    child: Icon(Icons.directions_car,
                        size: 64, color: context.eyeMutedText),
                  )
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _photos.length,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                    ),
                    itemBuilder: (context, index) {
                      final photo = _photos[index];
                      final preview = photo.previewUrl ?? photo.localPath;
                      final isNetwork = (preview ?? "").startsWith("http://") ||
                          (preview ?? "").startsWith("https://");
                      return Stack(
                        children: [
                          Positioned.fill(
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: preview == null
                                    ? null
                                    : () => _previewPhoto(photo),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: preview == null
                                      ? Container(
                                          color: context.eyeSurfaceMuted)
                                      : isNetwork
                                          ? Image.network(preview,
                                              fit: BoxFit.cover)
                                          : Image.file(File(preview),
                                              fit: BoxFit.cover),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: 4,
                            top: 4,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: Colors.black87,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 3,
                                ),
                                child: Text(
                                  photo.angle.label,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            right: 4,
                            top: 4,
                            child: GestureDetector(
                              onTap: saving ? null : () => _removePhoto(index),
                              child: const CircleAvatar(
                                radius: 12,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.close,
                                    size: 14, color: Colors.white),
                              ),
                            ),
                          ),
                          if (photo.uploadState ==
                                  _VehiclePhotoUploadState.uploading ||
                              photo.uploadState ==
                                  _VehiclePhotoUploadState.failed)
                            Positioned(
                              left: 4,
                              bottom: 4,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: Colors.black54,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  child: Text(
                                    photo.uploadState ==
                                            _VehiclePhotoUploadState.uploading
                                        ? "UPLOADING"
                                        : "FAILED",
                                    style: const TextStyle(
                                        fontSize: 10, color: Colors.white),
                                  ),
                                ),
                              ),
                            ),
                          if (photo.uploadState ==
                              _VehiclePhotoUploadState.failed)
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: IconButton(
                                onPressed:
                                    saving ? null : () => _retryPhotoAt(index),
                                icon: const Icon(Icons.refresh,
                                    color: Colors.white, size: 18),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                const SizedBox(height: 12),
                Text(
                  "${_photos.length}/${EvidencePolicy.vehiclePhotos.maxPhotos}",
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton.icon(
                    onPressed: saving ||
                            _photos.length >=
                                EvidencePolicy.vehiclePhotos.maxPhotos
                        ? null
                        : _addVehiclePhoto,
                    icon: const Icon(Icons.add_a_photo_outlined),
                    label: const Text("Add photo"),
                  ),
                ),
                if (hasFailed) ...[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: saving ? null : _retryFailedPhoto,
                    icon: const Icon(Icons.refresh),
                    label: const Text("Retry failed uploads"),
                  ),
                ],
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
                  decoration:
                      const InputDecoration(labelText: "Vehicle Description"),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: saving ? null : _save,
                  child: saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(editingExisting ? "Save changes" : "Save vehicle"),
                ),
                if (editingExisting && !isPrimary) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: saving ? null : _setPrimary,
                    child: const Text("Set as primary"),
                  ),
                ],
                if (editingExisting) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: saving ? null : _removeCar,
                    child: const Text("Delete vehicle"),
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
    await controller.apiClient.requestAccountDeletion(accessToken: token);
    await controller.clearSession(preserveBiometricUnlock: false);
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

class _BiometricUnlockSettingsTile extends StatefulWidget {
  const _BiometricUnlockSettingsTile();

  @override
  State<_BiometricUnlockSettingsTile> createState() =>
      _BiometricUnlockSettingsTileState();
}

class _BiometricUnlockSettingsTileState
    extends State<_BiometricUnlockSettingsTile> {
  BiometricCapability? _capability;
  bool _busy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_capability == null) unawaited(_loadCapability());
  }

  Future<void> _loadCapability() async {
    final capability = await appOf(context).biometricCapability();
    if (!mounted) return;
    setState(() => _capability = capability);
  }

  Future<void> _setEnabled(bool enabled) async {
    if (_busy) return;
    setState(() => _busy = true);
    final controller = appOf(context);
    if (!enabled) {
      await controller.disableBiometricUnlock();
      if (!mounted) return;
      setState(() => _busy = false);
      showAppSnackBar(context, "Biometric unlock disabled.");
      return;
    }

    final status = await controller.enableBiometricUnlock();
    if (!mounted) return;
    setState(() => _busy = false);
    final message = switch (status) {
      BiometricAuthenticationStatus.success =>
        "Biometric unlock enabled for this account.",
      BiometricAuthenticationStatus.cancelled =>
        "Biometric setup was cancelled.",
      BiometricAuthenticationStatus.lockedOut =>
        "Biometrics are temporarily locked. Unlock your device and try again.",
      BiometricAuthenticationStatus.notEnrolled =>
        "Add a fingerprint or face in your device settings first.",
      BiometricAuthenticationStatus.unavailable =>
        "Biometric unlock is unavailable on this device.",
      _ => "Unable to enable biometric unlock. Try again.",
    };
    showAppSnackBar(
      context,
      message,
      isError: status != BiometricAuthenticationStatus.success,
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final capability = _capability;
    final name = capability?.name ?? "Biometric";
    final enabled = controller.biometricUnlockEnabled;
    final canEnable = capability?.canAuthenticate ?? false;
    final subtitle = enabled
        ? "Use your device $name to unlock your signed-in account."
        : capability == null
            ? "Checking this device..."
            : !capability.available
                ? "Biometric authentication is unavailable on this device."
                : !capability.enrolled
                    ? "Enroll a fingerprint or face in device settings first."
                    : "Unlock your saved session without entering a password.";
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      secondary: Icon(
        capability?.kind == BiometricKind.face
            ? Icons.face_outlined
            : Icons.fingerprint,
        color: Theme.of(context).colorScheme.primary,
      ),
      title: Text("Use $name to unlock"),
      subtitle: Text(subtitle),
      value: enabled,
      onChanged: _busy || (!enabled && !canEnable) ? null : _setEnabled,
    );
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = appOf(context);
    final authenticated = controller.isAuthenticated;
    final l10n = AppLocalizations.of(context);
    return SafetyScaffold(
      title: l10n.settings,
      selectedIndex: 4,
      useFigmaShell: true,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          EyePageHeader.root(title: l10n.settings),
          const SizedBox(height: 8),
          SectionCard(
            title: "Account",
            child: Column(
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.support_agent,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  title: const Text("Help & Support"),
                  subtitle: const Text(
                      "Chat with THE EYE support — not for emergencies"),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).pushNamed("/support"),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.person_outline,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  title: Text(l10n.profile),
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
                      Icons.language,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    title: Text(l10n.languageRegion),
                    subtitle: Text(
                      "${l10n.countryRegion} / ${l10n.preferredLanguage}",
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context)
                        .pushNamed("/settings/language-region"),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.logout,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    title: Text(l10n.signOut),
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
                    title: Text(l10n.signIn),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).pushNamed("/login"),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (authenticated) ...[
            SectionCard(
              title: "Security",
              child: Column(
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    secondary: Icon(
                      Icons.lock_clock_outlined,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    title: const Text("Remain signed in"),
                    subtitle: const Text(
                      "Keep me signed in when I close THE EYE.",
                    ),
                    value: controller.remainSignedIn,
                    onChanged: controller.setRemainSignedIn,
                  ),
                  const _BiometricUnlockSettingsTile(),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          const LocationPermissionSettingsSection(),
          const SizedBox(height: 16),
          SectionCard(
            title: "My Vehicles",
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                Icons.directions_car,
                color: Theme.of(context).colorScheme.primary,
              ),
              title: Text(
                controller.vehicles.isEmpty
                    ? "Add vehicle"
                    : "Manage my vehicles",
              ),
              subtitle: Text(
                controller.vehicles.isEmpty
                    ? "Save vehicles for faster stolen vehicle reports"
                    : "${controller.vehicles.length} saved vehicle${controller.vehicles.length == 1 ? "" : "s"}",
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).pushNamed("/your-car"),
            ),
          ),
          const SizedBox(height: 16),
          if (!AppFlavorConfig.isProduction)
            SectionCard(
              title: "Diagnostics",
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  Icons.bug_report_outlined,
                  color: Theme.of(context).colorScheme.primary,
                ),
                title: const Text("Build & runtime info"),
                subtitle: const Text(
                  "Version, build SHA, API host, Firebase project (no secrets).",
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () =>
                    Navigator.of(context).pushNamed("/settings/diagnostics"),
              ),
            ),
          if (!AppFlavorConfig.isProduction) const SizedBox(height: 16),
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
                        ? EyeSemanticColors.of(context).success
                        : BrandColors.orange,
                  ),
                  title: const Text("Internet connection"),
                  subtitle: Text(controller.connectivityState.statusLabel),
                  trailing: Text(
                    controller.online ? "Online" : "Auto-detected",
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: EyeSemanticColors.statusLabel(
                        context,
                        positive: controller.online,
                      ),
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
      1 => EyeNavRoutes.neighborhoodWatch,
      3 => EyeNavRoutes.broadcast,
      4 => EyeNavRoutes.settings,
      _ => null,
    };
    if (route == null) return;
    if (ModalRoute.of(context)?.settings.name != route) {
      Navigator.of(context).pushReplacementNamed(
        route,
        arguments: tabIndex == 1 ? const {"openFeed": true} : null,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = Localizations.of<AppLocalizations>(
      context,
      AppLocalizations,
    );
    final routeName = ModalRoute.of(context)?.settings.name;
    final navIndex = useFigmaShell
        ? selectedIndex
        : EyeNavRoutes.selectedIndexForRoute(routeName);
    final backLabel = l10n?.back ?? "Back";
    final homeLabel = l10n?.home ?? "Home";
    final profileLabel = l10n?.profile ?? "Profile";
    final settingsLabel = l10n?.settings ?? "Settings";

    return Scaffold(
      backgroundColor: EyeSemanticColors.of(context).background,
      appBar: useFigmaShell
          ? null
          : AppBar(
              leading: Navigator.of(context).canPop()
                  ? IconButton(
                      tooltip: backLabel,
                      icon: const Icon(Icons.arrow_back),
                      onPressed: () => Navigator.of(context).maybePop(),
                    )
                  : null,
              title: Text(title),
              actions: [
                IconButton(
                  tooltip: settingsLabel,
                  icon: const Icon(Icons.settings),
                  onPressed: () => Navigator.of(context).pushNamed("/settings"),
                ),
              ],
            ),
      body: body,
      bottomNavigationBar: useFigmaShell
          ? EyeBottomNav(
              selectedIndex: navIndex,
              homeLabel: homeLabel,
              settingsLabel: settingsLabel,
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
              destinations: [
                NavigationDestination(
                  icon: const Icon(Icons.home),
                  label: homeLabel,
                ),
                NavigationDestination(
                    icon: const Icon(Icons.local_police), label: "Police"),
                NavigationDestination(
                    icon: const Icon(Icons.route), label: "Tracking"),
                NavigationDestination(
                    icon: const Icon(Icons.family_restroom), label: "Family"),
                NavigationDestination(
                  icon: const Icon(Icons.person),
                  label: profileLabel,
                ),
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
    isDismissible: true,
    enableDrag: true,
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

  Future<void> _submitSosDraft({
    required BuildContext parentContext,
    required AppController controller,
    required IncidentDraft draft,
    required LocationAccessResult access,
    required bool silent,
  }) async {
    final result =
        await controller.submitIncident(draft).timeout(kSosSubmissionTimeout);
    if (!parentContext.mounted) return;

    if (result.status == IncidentSubmissionStatus.duplicateInFlight) {
      showAppSnackBar(
        parentContext,
        result.userMessage ?? "SOS is already sending.",
        isError: true,
      );
      return;
    }

    if (result.isSuccess || result.isQueued || result.canRetry) {
      final incidentId = result.incidentId;
      if (incidentId != null && incidentId.isNotEmpty) {
        await controller.activateActiveEmergency(incidentId, silent: silent);
        if (result.isSuccess) {
          await controller.startIncidentLocationTracking(incidentId);
        }
        if (!parentContext.mounted) return;
        showAppSnackBar(
          parentContext,
          sosLocationUserMessage(access, submitted: true),
        );
        await ActiveEmergencyNavigation.open(
          parentContext,
          controller,
          incidentId: incidentId,
          silent: silent,
        );
        return;
      }
      showAppSnackBar(
        parentContext,
        sosLocationUserMessage(access, submitted: true),
      );
      await ActiveEmergencyNavigation.open(parentContext, controller);
      return;
    }

    showAppSnackBar(
      parentContext,
      result.userMessage ?? "Unable to send SOS right now. Try again.",
      isError: true,
    );
  }

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
      final access = await resolveLocationAccess(
        timeout: kEmergencyLocationTimeout,
        allowCachedFallback: true,
      ).timeout(
        kSosSubmissionTimeout,
        onTimeout: () => const LocationAccessResult(
          state: LocationPermissionState.timedOut,
        ),
      );
      if (!parentContext.mounted) return;

      if (!access.allowsEmergencySubmission) {
        showAppSnackBar(
          parentContext,
          sosLocationUserMessage(access, submitted: false),
          isError: true,
        );
        return;
      }

      final draft = buildSosIncidentDraft(
        access: access,
        description: "SOS emergency triggered from mobile app.",
        notifyEmergencyContacts: true,
        title: "SOS emergency",
        emergencyCategory: "Other",
      );

      await _submitSosDraft(
        parentContext: parentContext,
        controller: controller,
        draft: draft,
        access: access,
        silent: false,
      );
    } on TimeoutException {
      if (parentContext.mounted) {
        showAppSnackBar(
          parentContext,
          "SOS timed out while sending. Try again.",
          isError: true,
        );
      }
    } catch (_) {
      if (parentContext.mounted) {
        showAppSnackBar(
          parentContext,
          "Unable to send SOS right now. Try again.",
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => sendingAlert = false);
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
    final semantics = EyeSemanticColors.of(context);
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
              backgroundColor: semantics.primaryAction,
              foregroundColor: semantics.primaryActionForeground,
              minimumSize: const Size.fromHeight(EyeTokens.sosButtonHeight),
            ),
            onPressed: sendingAlert ? null : _startSosLiveVideo,
            icon: const Icon(Icons.videocam),
            label: const Text("Start SOS live video"),
          ),
          const SizedBox(height: 6),
          Text(
            "Live video opens the emergency stream screen. GPS and contact alerts are sent when streaming starts.",
            style: TextStyle(fontSize: 12, color: semantics.secondaryText),
          ),
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
    final semantics = EyeSemanticColors.of(context);
    return Material(
      color: context.eyeSurface,
      borderRadius: BorderRadius.circular(18),
      child: Semantics(
        button: true,
        label: label,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 76),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                border: Border.all(color: context.eyeBorder),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, color: color, size: 26),
                  const Spacer(),
                  Text(
                    label,
                    maxLines: 2,
                    softWrap: true,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                      color: semantics.bodyText,
                    ),
                  ),
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
    final semantics = EyeSemanticColors.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: context.eyeSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.eyeBorder),
      ),
      child: ListTile(
        onTap: onTap,
        minVerticalPadding: 14,
        leading: leading,
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: semantics.bodyText,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(color: semantics.secondaryText),
        ),
        trailing: trailing,
      ),
    );
  }
}

class IncidentStatusTile extends StatelessWidget {
  const IncidentStatusTile({required this.incident, this.onTap, super.key});

  static const _terminalStatuses = {
    "Resolved",
    "Closed",
    "FalseReport",
    "CancelledByReporter",
    "ExpiredAfterReview",
  };

  final IncidentTrackingItem incident;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isTerminal = _terminalStatuses.contains(incident.status);
    return EyeIncidentSummaryCard.fromIncidentFields(
      title: citizenIncidentCategoryLabel(incident.type),
      incidentId: incident.id,
      status: incident.status,
      reportedAt: incident.submittedAt,
      displayStatus: incident.displayStatus,
      apiPublicReference: incident.publicReference,
      onTap: onTap,
      semanticsSuffix: onTap == null
          ? null
          : (isTerminal
              ? "Tap to open incident details"
              : "Tap to open active emergency"),
    );
  }
}

class BroadcastAlertTile extends StatelessWidget {
  const BroadcastAlertTile({required this.alert, this.onTap, super.key});

  final InboxNotificationItem alert;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final presented = CitizenNotificationPresenter.present(
      type: alert.type,
      title: alert.title,
      body: alert.body,
      createdAt: alert.receivedAt,
      isUnread: !alert.read,
      metadata: alert.metadata,
    );
    return Semantics(
      button: true,
      label:
          "${presented.isUnread ? "Unread" : "Read"}. ${presented.category}. ${presented.title}. ${presented.preview}",
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: EyeNotificationCard(
          category: presented.category,
          title: presented.title,
          body: presented.preview,
          read: alert.read,
          timestamp: presented.timestampLabel,
        ),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.standalone,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final bool standalone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final accent = EyeSemanticColors.pairingModeAccent(
      context,
      standalone: standalone,
    );
    final borderColor = selected
        ? accent
        : (context.isDarkTheme ? semantics.divider : BrandColors.lightBorder);
    final fillColor = selected
        ? accent.withValues(alpha: 0.08)
        : (context.isDarkTheme ? semantics.cardSurface : Colors.white);
    final titleColor = selected
        ? accent
        : (context.isDarkTheme ? semantics.bodyText : BrandColors.command);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor, width: selected ? 2 : 1),
          color: fillColor,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style:
                    TextStyle(fontWeight: FontWeight.w800, color: titleColor)),
            const SizedBox(height: 4),
            Text(subtitle,
                style: TextStyle(
                    fontSize: 12,
                    color: context.isDarkTheme
                        ? semantics.secondaryText
                        : BrandColors.lightTextMuted)),
          ],
        ),
      ),
    );
  }
}

class SmartwatchCompanionPreview extends StatelessWidget {
  const SmartwatchCompanionPreview({
    required this.standalone,
    required this.batteryLevel,
    required this.signalStrength,
    required this.sosActive,
    this.hasTelemetry = true,
    super.key,
  });

  final bool standalone;
  final int batteryLevel;
  final int signalStrength;
  final bool sosActive;
  final bool hasTelemetry;

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
                  Text(hasTelemetry ? "Bat $batteryLevel%" : "Bat —",
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 10)),
                  Text(hasTelemetry ? "Sig $signalStrength%" : "Sig —",
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
    final semantics = EyeSemanticColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: semantics.secondaryText),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: semantics.bodyText,
            ),
          ),
        ],
      ),
    );
  }
}
