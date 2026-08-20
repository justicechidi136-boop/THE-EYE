// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Yoruba (`yo`).
class AppLocalizationsYo extends AppLocalizations {
  AppLocalizationsYo([String locale = 'yo']) : super(locale);

  @override
  String get home => 'Ile';

  @override
  String get settings => 'Eto';

  @override
  String get profile => 'Profaili';

  @override
  String get languageRegion => 'Ede & Agbegbe';

  @override
  String get countryRegion => 'Orile-ede / Agbegbe';

  @override
  String get preferredLanguage => 'Ede ti o fe';

  @override
  String get preferredLanguageSaved => 'A ti fi ede ti o fe pamole.';

  @override
  String get save => 'Fi pamole';

  @override
  String get cancel => 'Fagilee';

  @override
  String get back => 'Pada';

  @override
  String get continueLabel => 'Tesiwaju';

  @override
  String get signIn => 'Wole';

  @override
  String get signOut => 'Jade';

  @override
  String get select => 'Yan';

  @override
  String get selectLanguage => 'Yan ede';

  @override
  String get notSet => 'Ko ti seto';

  @override
  String get languageRegionNotice =>
      'Ayipada orile-ede yoo waye lọtọ ki ipinle ati LGA le tun jerisi.';

  @override
  String get pilotEnglishNotice =>
      'Pupo awon oju-iwe ṣi wa ni Gẹẹsi ninu itusile yii; eyi n fi ayanfẹ ede rẹ pamole.';

  @override
  String get completeYourProfile => 'Pari profaili re';

  @override
  String get saveAndContinue => 'Fi pamole ki o tesiwaju';

  @override
  String get reportSighting => 'Report Sighting';

  @override
  String get useCurrentLocation => 'Use current location';

  @override
  String get enterManually => 'Enter manually';

  @override
  String get stateLabel => 'State';

  @override
  String get cityTown => 'City/Town';

  @override
  String get cityTownName => 'City/Town name';

  @override
  String get streetRoadAddress => 'Street/Road Address';

  @override
  String get sightingDetails => 'Sighting Details';

  @override
  String get newSightingReported => 'New sighting reported';

  @override
  String get reportedLabel => 'Reported';

  @override
  String get observedLabel => 'Observed';

  @override
  String get locationLabel => 'Location';

  @override
  String get whatWasObserved => 'What was observed';

  @override
  String get evidenceLabel => 'Evidence';

  @override
  String get noEvidenceAttached => 'No evidence attached.';

  @override
  String get viewOriginalBroadcast => 'View original Broadcast';

  @override
  String get retry => 'Retry';

  @override
  String get capturedLabel => 'Captured';

  @override
  String get incidentArchive => 'Incident archive';

  @override
  String get completedEmergency => 'Completed emergency';

  @override
  String get incidentResolved => 'Incident resolved';

  @override
  String get incidentCancelled => 'Incident cancelled';

  @override
  String get incidentClosed => 'Incident closed';

  @override
  String get incidentOverview => 'Incident overview';

  @override
  String get completedResponseProgress => 'Completed response progress';

  @override
  String get finalStatus => 'Final status';

  @override
  String get resolutionReason => 'Resolution reason';

  @override
  String get cancellationReason => 'Cancellation reason';

  @override
  String get communicationHistory => 'Communication history';

  @override
  String get readOnly => 'Read only';

  @override
  String get noEvidenceSubmitted => 'No evidence submitted.';

  @override
  String get noDispatchActivityRecorded => 'No dispatch activity recorded.';

  @override
  String get viewCommunicationHistory => 'View communication history';

  @override
  String get broadcastSelectedVehicle => 'Selected vehicle';

  @override
  String get broadcastChangeVehicle => 'Change vehicle';

  @override
  String get broadcastShare => 'Share';

  @override
  String get broadcastComments => 'Comments';

  @override
  String get broadcastResolve => 'Resolve';

  @override
  String get broadcastWithdraw => 'Withdraw';

  @override
  String get broadcastReport => 'Report Broadcast';

  @override
  String get broadcastMissingPersonLabel => 'Missing person';

  @override
  String get broadcastStolenVehicleLabel => 'Stolen vehicle';

  @override
  String get broadcastSafetyUpdateLabel => 'Safety update';

  @override
  String get broadcastSafetyUpdateSummary =>
      'Open this safety update for more information.';

  @override
  String get broadcastVehicleFallback => 'Vehicle';

  @override
  String get broadcastPersonFallback => 'Person';

  @override
  String get broadcastStolenVehicleFallbackSummary =>
      'A vehicle was reported stolen.';

  @override
  String get broadcastMissingPersonFallbackSummary =>
      'Open this missing person alert for more information.';

  @override
  String get broadcastStatusActive => 'Active';

  @override
  String get broadcastStatusUpdated => 'Updated';

  @override
  String get broadcastStatusResolved => 'Resolved';

  @override
  String get broadcastStatusWithdrawn => 'Withdrawn';

  @override
  String get broadcastStatusSuspended => 'Unavailable';

  @override
  String get broadcastStatusExpired => 'Expired';

  @override
  String get broadcastStatusUnavailable => 'Update available';

  @override
  String broadcastMissingPersonTitle(Object name) {
    return 'Missing person: $name';
  }

  @override
  String broadcastStolenVehicleTitle(Object subject) {
    return 'Stolen vehicle: $subject';
  }

  @override
  String broadcastStolenVehicleTitleWithPlate(Object plate, Object subject) {
    return 'Stolen vehicle: $subject ($plate)';
  }

  @override
  String broadcastStolenVehicleSummary(Object date, Object subject) {
    return '$subject reported stolen on $date.';
  }

  @override
  String broadcastMissingPersonExactSummary(
      Object age, Object date, Object name) {
    return '$age-year-old $name was last seen on $date.';
  }

  @override
  String broadcastMissingPersonRangeSummary(
      Object age, Object date, Object name) {
    return '$name, approximately $age years old, was last seen on $date.';
  }
}
