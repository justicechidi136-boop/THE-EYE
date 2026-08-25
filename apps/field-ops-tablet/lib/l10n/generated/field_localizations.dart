import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'field_localizations_en.dart';
import 'field_localizations_ha.dart';
import 'field_localizations_ig.dart';
import 'field_localizations_pcm.dart';
import 'field_localizations_yo.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of FieldLocalizations
/// returned by `FieldLocalizations.of(context)`.
///
/// Applications need to include `FieldLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/field_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: FieldLocalizations.localizationsDelegates,
///   supportedLocales: FieldLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the FieldLocalizations.supportedLocales
/// property.
abstract class FieldLocalizations {
  FieldLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static FieldLocalizations of(BuildContext context) {
    return Localizations.of<FieldLocalizations>(context, FieldLocalizations)!;
  }

  static const LocalizationsDelegate<FieldLocalizations> delegate =
      _FieldLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ha'),
    Locale('ig'),
    Locale('pcm'),
    Locale('yo'),
  ];

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get refresh;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @dashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @fieldOps.
  ///
  /// In en, this message translates to:
  /// **'Field Ops'**
  String get fieldOps;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @lock.
  ///
  /// In en, this message translates to:
  /// **'Lock'**
  String get lock;

  /// No description provided for @languageRegion.
  ///
  /// In en, this message translates to:
  /// **'Language & Region'**
  String get languageRegion;

  /// No description provided for @preferredLanguage.
  ///
  /// In en, this message translates to:
  /// **'Preferred language'**
  String get preferredLanguage;

  /// No description provided for @languageRegionDescription.
  ///
  /// In en, this message translates to:
  /// **'Choose the officer UI language for this tablet. Nigeria remains the active region.'**
  String get languageRegionDescription;

  /// No description provided for @preferredLanguageSaved.
  ///
  /// In en, this message translates to:
  /// **'Preferred language saved'**
  String get preferredLanguageSaved;

  /// No description provided for @languageSyncWarning.
  ///
  /// In en, this message translates to:
  /// **'Language changed on this tablet. Server sync will retry when connected.'**
  String get languageSyncWarning;

  /// No description provided for @nigeria.
  ///
  /// In en, this message translates to:
  /// **'Nigeria'**
  String get nigeria;

  /// No description provided for @officerSignIn.
  ///
  /// In en, this message translates to:
  /// **'Officer sign in'**
  String get officerSignIn;

  /// No description provided for @fieldOperations.
  ///
  /// In en, this message translates to:
  /// **'FIELD OPERATIONS'**
  String get fieldOperations;

  /// No description provided for @device.
  ///
  /// In en, this message translates to:
  /// **'Device'**
  String get device;

  /// No description provided for @signInWithCredentials.
  ///
  /// In en, this message translates to:
  /// **'Sign in with your assigned field credentials.'**
  String get signInWithCredentials;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @emailRequired.
  ///
  /// In en, this message translates to:
  /// **'Email is required'**
  String get emailRequired;

  /// No description provided for @passwordRequired.
  ///
  /// In en, this message translates to:
  /// **'Password is required'**
  String get passwordRequired;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @deviceStatus.
  ///
  /// In en, this message translates to:
  /// **'Device status'**
  String get deviceStatus;

  /// No description provided for @heartbeatSent.
  ///
  /// In en, this message translates to:
  /// **'Heartbeat sent'**
  String get heartbeatSent;

  /// No description provided for @publicDeviceId.
  ///
  /// In en, this message translates to:
  /// **'Public device ID'**
  String get publicDeviceId;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @registrationStatus.
  ///
  /// In en, this message translates to:
  /// **'Registration status'**
  String get registrationStatus;

  /// No description provided for @requiresRepair.
  ///
  /// In en, this message translates to:
  /// **'Requires re-pair'**
  String get requiresRepair;

  /// No description provided for @yes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get yes;

  /// No description provided for @no.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get no;

  /// No description provided for @lastSeen.
  ///
  /// In en, this message translates to:
  /// **'Last seen'**
  String get lastSeen;

  /// No description provided for @unknown.
  ///
  /// In en, this message translates to:
  /// **'Unknown'**
  String get unknown;

  /// No description provided for @sendHeartbeat.
  ///
  /// In en, this message translates to:
  /// **'Send heartbeat'**
  String get sendHeartbeat;

  /// No description provided for @backToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get backToSignIn;

  /// No description provided for @patrol.
  ///
  /// In en, this message translates to:
  /// **'Patrol'**
  String get patrol;

  /// No description provided for @checkpoint.
  ///
  /// In en, this message translates to:
  /// **'Checkpoint'**
  String get checkpoint;

  /// No description provided for @assignments.
  ///
  /// In en, this message translates to:
  /// **'Assignments'**
  String get assignments;

  /// No description provided for @drone.
  ///
  /// In en, this message translates to:
  /// **'Drone'**
  String get drone;

  /// No description provided for @comms.
  ///
  /// In en, this message translates to:
  /// **'Comms'**
  String get comms;

  /// No description provided for @operationalDashboard.
  ///
  /// In en, this message translates to:
  /// **'Operational dashboard'**
  String get operationalDashboard;

  /// No description provided for @noActiveShift.
  ///
  /// In en, this message translates to:
  /// **'No active shift'**
  String get noActiveShift;

  /// No description provided for @active.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get active;

  /// No description provided for @currentLocation.
  ///
  /// In en, this message translates to:
  /// **'Current location'**
  String get currentLocation;

  /// No description provided for @locationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Location unavailable'**
  String get locationUnavailable;

  /// No description provided for @locationDetected.
  ///
  /// In en, this message translates to:
  /// **'Location detected'**
  String get locationDetected;

  /// No description provided for @battery.
  ///
  /// In en, this message translates to:
  /// **'Battery'**
  String get battery;

  /// No description provided for @offlineQueue.
  ///
  /// In en, this message translates to:
  /// **'Offline queue'**
  String get offlineQueue;

  /// No description provided for @pendingCount.
  ///
  /// In en, this message translates to:
  /// **'{count} pending'**
  String pendingCount(int count);

  /// No description provided for @quickActions.
  ///
  /// In en, this message translates to:
  /// **'Quick actions'**
  String get quickActions;

  /// No description provided for @sync.
  ///
  /// In en, this message translates to:
  /// **'Sync'**
  String get sync;

  /// No description provided for @syncAttempted.
  ///
  /// In en, this message translates to:
  /// **'Sync attempted'**
  String get syncAttempted;

  /// No description provided for @emergency.
  ///
  /// In en, this message translates to:
  /// **'Emergency'**
  String get emergency;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @patrolInactive.
  ///
  /// In en, this message translates to:
  /// **'Patrol inactive'**
  String get patrolInactive;

  /// No description provided for @patrolActive.
  ///
  /// In en, this message translates to:
  /// **'Patrol active'**
  String get patrolActive;

  /// No description provided for @locationAcquiring.
  ///
  /// In en, this message translates to:
  /// **'GPS acquiring...'**
  String get locationAcquiring;

  /// No description provided for @startPatrol.
  ///
  /// In en, this message translates to:
  /// **'Start patrol'**
  String get startPatrol;

  /// No description provided for @recordGpsPoint.
  ///
  /// In en, this message translates to:
  /// **'Record GPS point'**
  String get recordGpsPoint;

  /// No description provided for @stopRouteRecording.
  ///
  /// In en, this message translates to:
  /// **'Stop route recording'**
  String get stopRouteRecording;

  /// No description provided for @startRouteRecording.
  ///
  /// In en, this message translates to:
  /// **'Start route recording'**
  String get startRouteRecording;

  /// No description provided for @endPatrol.
  ///
  /// In en, this message translates to:
  /// **'End patrol'**
  String get endPatrol;

  /// No description provided for @requestBackup.
  ///
  /// In en, this message translates to:
  /// **'Request backup'**
  String get requestBackup;

  /// No description provided for @evidence.
  ///
  /// In en, this message translates to:
  /// **'Evidence'**
  String get evidence;

  /// No description provided for @photo.
  ///
  /// In en, this message translates to:
  /// **'Photo'**
  String get photo;

  /// No description provided for @video.
  ///
  /// In en, this message translates to:
  /// **'Video'**
  String get video;

  /// No description provided for @queueUpdated.
  ///
  /// In en, this message translates to:
  /// **'Queue updated'**
  String get queueUpdated;

  /// No description provided for @noActiveCheckpoint.
  ///
  /// In en, this message translates to:
  /// **'No active checkpoint'**
  String get noActiveCheckpoint;

  /// No description provided for @checkpointActive.
  ///
  /// In en, this message translates to:
  /// **'Checkpoint active'**
  String get checkpointActive;

  /// No description provided for @queueCount.
  ///
  /// In en, this message translates to:
  /// **'Queue count'**
  String get queueCount;

  /// No description provided for @vehicleChecks.
  ///
  /// In en, this message translates to:
  /// **'Vehicle checks'**
  String get vehicleChecks;

  /// No description provided for @saveQueueStats.
  ///
  /// In en, this message translates to:
  /// **'Save queue stats'**
  String get saveQueueStats;

  /// No description provided for @startCheckpointSession.
  ///
  /// In en, this message translates to:
  /// **'Start checkpoint session'**
  String get startCheckpointSession;

  /// No description provided for @endCheckpointSession.
  ///
  /// In en, this message translates to:
  /// **'End checkpoint session'**
  String get endCheckpointSession;

  /// No description provided for @search.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get search;

  /// No description provided for @plateIdOrName.
  ///
  /// In en, this message translates to:
  /// **'Plate, ID, or name'**
  String get plateIdOrName;

  /// No description provided for @vehicle.
  ///
  /// In en, this message translates to:
  /// **'Vehicle'**
  String get vehicle;

  /// No description provided for @person.
  ///
  /// In en, this message translates to:
  /// **'Person'**
  String get person;

  /// No description provided for @all.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get all;

  /// No description provided for @searchResultsAppearHere.
  ///
  /// In en, this message translates to:
  /// **'Search results appear here'**
  String get searchResultsAppearHere;

  /// No description provided for @noAssignments.
  ///
  /// In en, this message translates to:
  /// **'No assignments'**
  String get noAssignments;

  /// No description provided for @assignmentId.
  ///
  /// In en, this message translates to:
  /// **'Assignment {id}'**
  String assignmentId(String id);

  /// No description provided for @backupRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Backup request sent'**
  String get backupRequestSent;

  /// No description provided for @incidentWorkspace.
  ///
  /// In en, this message translates to:
  /// **'Incident workspace'**
  String get incidentWorkspace;

  /// No description provided for @noDescription.
  ///
  /// In en, this message translates to:
  /// **'No description'**
  String get noDescription;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @priority.
  ///
  /// In en, this message translates to:
  /// **'Priority'**
  String get priority;

  /// No description provided for @markEnRoute.
  ///
  /// In en, this message translates to:
  /// **'Mark en route'**
  String get markEnRoute;

  /// No description provided for @timeline.
  ///
  /// In en, this message translates to:
  /// **'Timeline'**
  String get timeline;

  /// No description provided for @responses.
  ///
  /// In en, this message translates to:
  /// **'Responses'**
  String get responses;

  /// No description provided for @noTimelineEvents.
  ///
  /// In en, this message translates to:
  /// **'No timeline events'**
  String get noTimelineEvents;

  /// No description provided for @noResponsesRecorded.
  ///
  /// In en, this message translates to:
  /// **'No responses recorded'**
  String get noResponsesRecorded;

  /// No description provided for @boloSearch.
  ///
  /// In en, this message translates to:
  /// **'BOLO search'**
  String get boloSearch;

  /// No description provided for @searchBolo.
  ///
  /// In en, this message translates to:
  /// **'Search BOLO'**
  String get searchBolo;

  /// No description provided for @reportSighting.
  ///
  /// In en, this message translates to:
  /// **'Report sighting'**
  String get reportSighting;

  /// No description provided for @enterQueryToSearchBolo.
  ///
  /// In en, this message translates to:
  /// **'Enter a query to search BOLO'**
  String get enterQueryToSearchBolo;

  /// No description provided for @sightingRecorded.
  ///
  /// In en, this message translates to:
  /// **'Sighting recorded'**
  String get sightingRecorded;

  /// No description provided for @requestDrone.
  ///
  /// In en, this message translates to:
  /// **'Request drone'**
  String get requestDrone;

  /// No description provided for @missionId.
  ///
  /// In en, this message translates to:
  /// **'Mission {id}'**
  String missionId(String id);

  /// No description provided for @selectMissionToMonitor.
  ///
  /// In en, this message translates to:
  /// **'Select a mission to monitor'**
  String get selectMissionToMonitor;

  /// No description provided for @mission.
  ///
  /// In en, this message translates to:
  /// **'Mission'**
  String get mission;

  /// No description provided for @liveFeedPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Live feed placeholder'**
  String get liveFeedPlaceholder;

  /// No description provided for @droneRequestSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Drone request submitted'**
  String get droneRequestSubmitted;

  /// No description provided for @communications.
  ///
  /// In en, this message translates to:
  /// **'Communications'**
  String get communications;

  /// No description provided for @unreadCount.
  ///
  /// In en, this message translates to:
  /// **'{count} unread'**
  String unreadCount(int count);

  /// No description provided for @activeAssignments.
  ///
  /// In en, this message translates to:
  /// **'Active assignments'**
  String get activeAssignments;

  /// No description provided for @selectAssignmentToViewComms.
  ///
  /// In en, this message translates to:
  /// **'Select an assignment to view comms'**
  String get selectAssignmentToViewComms;

  /// No description provided for @quickReply.
  ///
  /// In en, this message translates to:
  /// **'Quick reply...'**
  String get quickReply;

  /// No description provided for @send.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// No description provided for @workspace.
  ///
  /// In en, this message translates to:
  /// **'Workspace'**
  String get workspace;

  /// No description provided for @noMessagesInIncidentScope.
  ///
  /// In en, this message translates to:
  /// **'No messages in incident scope'**
  String get noMessagesInIncidentScope;

  /// No description provided for @safetyAlertSent.
  ///
  /// In en, this message translates to:
  /// **'Safety alert sent'**
  String get safetyAlertSent;

  /// No description provided for @safetyAlertQueued.
  ///
  /// In en, this message translates to:
  /// **'Safety alert queued. It will sync when online.'**
  String get safetyAlertQueued;

  /// No description provided for @officerSafety.
  ///
  /// In en, this message translates to:
  /// **'Officer safety'**
  String get officerSafety;

  /// No description provided for @lastAlert.
  ///
  /// In en, this message translates to:
  /// **'Last alert'**
  String get lastAlert;

  /// No description provided for @panic.
  ///
  /// In en, this message translates to:
  /// **'PANIC'**
  String get panic;

  /// No description provided for @officerDown.
  ///
  /// In en, this message translates to:
  /// **'Officer down'**
  String get officerDown;

  /// No description provided for @manualDistress.
  ///
  /// In en, this message translates to:
  /// **'Manual distress'**
  String get manualDistress;

  /// No description provided for @backupRequested.
  ///
  /// In en, this message translates to:
  /// **'Backup requested'**
  String get backupRequested;

  /// No description provided for @backupQueuedForSync.
  ///
  /// In en, this message translates to:
  /// **'Backup queued for sync'**
  String get backupQueuedForSync;

  /// No description provided for @backupType.
  ///
  /// In en, this message translates to:
  /// **'Backup type'**
  String get backupType;

  /// No description provided for @reason.
  ///
  /// In en, this message translates to:
  /// **'Reason'**
  String get reason;

  /// No description provided for @submitBackupRequest.
  ///
  /// In en, this message translates to:
  /// **'Submit backup request'**
  String get submitBackupRequest;

  /// No description provided for @maintenance.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
  String get maintenance;

  /// No description provided for @approvedApps.
  ///
  /// In en, this message translates to:
  /// **'Approved Apps'**
  String get approvedApps;

  /// No description provided for @incidentLocation.
  ///
  /// In en, this message translates to:
  /// **'Incident Map'**
  String get incidentLocation;

  /// No description provided for @broadcasts.
  ///
  /// In en, this message translates to:
  /// **'Broadcasts'**
  String get broadcasts;
}

class _FieldLocalizationsDelegate
    extends LocalizationsDelegate<FieldLocalizations> {
  const _FieldLocalizationsDelegate();

  @override
  Future<FieldLocalizations> load(Locale locale) {
    return SynchronousFuture<FieldLocalizations>(
      lookupFieldLocalizations(locale),
    );
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ha', 'ig', 'pcm', 'yo'].contains(locale.languageCode);

  @override
  bool shouldReload(_FieldLocalizationsDelegate old) => false;
}

FieldLocalizations lookupFieldLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return FieldLocalizationsEn();
    case 'ha':
      return FieldLocalizationsHa();
    case 'ig':
      return FieldLocalizationsIg();
    case 'pcm':
      return FieldLocalizationsPcm();
    case 'yo':
      return FieldLocalizationsYo();
  }

  throw FlutterError(
    'FieldLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
