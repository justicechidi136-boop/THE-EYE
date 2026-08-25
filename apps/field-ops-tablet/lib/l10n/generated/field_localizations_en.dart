// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'field_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class FieldLocalizationsEn extends FieldLocalizations {
  FieldLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get home => 'Home';

  @override
  String get settings => 'Settings';

  @override
  String get profile => 'Profile';

  @override
  String get back => 'Back';

  @override
  String get refresh => 'Refresh';

  @override
  String get language => 'Language';

  @override
  String get dashboard => 'Dashboard';

  @override
  String get fieldOps => 'Field Ops';

  @override
  String get signOut => 'Sign out';

  @override
  String get lock => 'Lock';

  @override
  String get languageRegion => 'Language & Region';

  @override
  String get preferredLanguage => 'Preferred language';

  @override
  String get languageRegionDescription =>
      'Choose the officer UI language for this tablet. Nigeria remains the active region.';

  @override
  String get preferredLanguageSaved => 'Preferred language saved';

  @override
  String get languageSyncWarning =>
      'Language changed on this tablet. Server sync will retry when connected.';

  @override
  String get nigeria => 'Nigeria';

  @override
  String get officerSignIn => 'Officer sign in';

  @override
  String get fieldOperations => 'FIELD OPERATIONS';

  @override
  String get device => 'Device';

  @override
  String get signInWithCredentials =>
      'Sign in with your assigned field credentials.';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get emailRequired => 'Email is required';

  @override
  String get passwordRequired => 'Password is required';

  @override
  String get signIn => 'Sign in';

  @override
  String get deviceStatus => 'Device status';

  @override
  String get heartbeatSent => 'Heartbeat sent';

  @override
  String get publicDeviceId => 'Public device ID';

  @override
  String get name => 'Name';

  @override
  String get registrationStatus => 'Registration status';

  @override
  String get requiresRepair => 'Requires re-pair';

  @override
  String get yes => 'Yes';

  @override
  String get no => 'No';

  @override
  String get lastSeen => 'Last seen';

  @override
  String get unknown => 'Unknown';

  @override
  String get sendHeartbeat => 'Send heartbeat';

  @override
  String get backToSignIn => 'Back to sign in';

  @override
  String get patrol => 'Patrol';

  @override
  String get checkpoint => 'Checkpoint';

  @override
  String get assignments => 'Assignments';

  @override
  String get drone => 'Drone';

  @override
  String get comms => 'Comms';

  @override
  String get operationalDashboard => 'Operational dashboard';

  @override
  String get noActiveShift => 'No active shift';

  @override
  String get active => 'Active';

  @override
  String get currentLocation => 'Current location';

  @override
  String get locationUnavailable => 'Location unavailable';

  @override
  String get locationDetected => 'Location detected';

  @override
  String get battery => 'Battery';

  @override
  String get offlineQueue => 'Offline queue';

  @override
  String pendingCount(int count) {
    return '$count pending';
  }

  @override
  String get quickActions => 'Quick actions';

  @override
  String get sync => 'Sync';

  @override
  String get syncAttempted => 'Sync attempted';

  @override
  String get emergency => 'Emergency';

  @override
  String get retry => 'Retry';

  @override
  String get patrolInactive => 'Patrol inactive';

  @override
  String get patrolActive => 'Patrol active';

  @override
  String get locationAcquiring => 'GPS acquiring...';

  @override
  String get startPatrol => 'Start patrol';

  @override
  String get recordGpsPoint => 'Record GPS point';

  @override
  String get stopRouteRecording => 'Stop route recording';

  @override
  String get startRouteRecording => 'Start route recording';

  @override
  String get endPatrol => 'End patrol';

  @override
  String get requestBackup => 'Request backup';

  @override
  String get evidence => 'Evidence';

  @override
  String get photo => 'Photo';

  @override
  String get video => 'Video';

  @override
  String get queueUpdated => 'Queue updated';

  @override
  String get noActiveCheckpoint => 'No active checkpoint';

  @override
  String get checkpointActive => 'Checkpoint active';

  @override
  String get queueCount => 'Queue count';

  @override
  String get vehicleChecks => 'Vehicle checks';

  @override
  String get saveQueueStats => 'Save queue stats';

  @override
  String get startCheckpointSession => 'Start checkpoint session';

  @override
  String get endCheckpointSession => 'End checkpoint session';

  @override
  String get search => 'Search';

  @override
  String get plateIdOrName => 'Plate, ID, or name';

  @override
  String get vehicle => 'Vehicle';

  @override
  String get person => 'Person';

  @override
  String get all => 'All';

  @override
  String get searchResultsAppearHere => 'Search results appear here';

  @override
  String get noAssignments => 'No assignments';

  @override
  String assignmentId(String id) {
    return 'Assignment $id';
  }

  @override
  String get backupRequestSent => 'Backup request sent';

  @override
  String get incidentWorkspace => 'Incident workspace';

  @override
  String get noDescription => 'No description';

  @override
  String get status => 'Status';

  @override
  String get priority => 'Priority';

  @override
  String get markEnRoute => 'Mark en route';

  @override
  String get timeline => 'Timeline';

  @override
  String get responses => 'Responses';

  @override
  String get noTimelineEvents => 'No timeline events';

  @override
  String get noResponsesRecorded => 'No responses recorded';

  @override
  String get boloSearch => 'BOLO search';

  @override
  String get searchBolo => 'Search BOLO';

  @override
  String get reportSighting => 'Report sighting';

  @override
  String get enterQueryToSearchBolo => 'Enter a query to search BOLO';

  @override
  String get sightingRecorded => 'Sighting recorded';

  @override
  String get requestDrone => 'Request drone';

  @override
  String missionId(String id) {
    return 'Mission $id';
  }

  @override
  String get selectMissionToMonitor => 'Select a mission to monitor';

  @override
  String get mission => 'Mission';

  @override
  String get liveFeedPlaceholder => 'Live feed placeholder';

  @override
  String get droneRequestSubmitted => 'Drone request submitted';

  @override
  String get communications => 'Communications';

  @override
  String unreadCount(int count) {
    return '$count unread';
  }

  @override
  String get activeAssignments => 'Active assignments';

  @override
  String get selectAssignmentToViewComms =>
      'Select an assignment to view comms';

  @override
  String get quickReply => 'Quick reply...';

  @override
  String get send => 'Send';

  @override
  String get workspace => 'Workspace';

  @override
  String get noMessagesInIncidentScope => 'No messages in incident scope';

  @override
  String get safetyAlertSent => 'Safety alert sent';

  @override
  String get safetyAlertQueued =>
      'Safety alert queued. It will sync when online.';

  @override
  String get officerSafety => 'Officer safety';

  @override
  String get lastAlert => 'Last alert';

  @override
  String get panic => 'PANIC';

  @override
  String get officerDown => 'Officer down';

  @override
  String get manualDistress => 'Manual distress';

  @override
  String get backupRequested => 'Backup requested';

  @override
  String get backupQueuedForSync => 'Backup queued for sync';

  @override
  String get backupType => 'Backup type';

  @override
  String get reason => 'Reason';

  @override
  String get submitBackupRequest => 'Submit backup request';

  @override
  String get maintenance => 'Maintenance';

  @override
  String get approvedApps => 'Approved Apps';

  @override
  String get incidentLocation => 'Incident Map';

  @override
  String get broadcasts => 'Broadcasts';
}
