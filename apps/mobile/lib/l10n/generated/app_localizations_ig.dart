// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Igbo (`ig`).
class AppLocalizationsIg extends AppLocalizations {
  AppLocalizationsIg([String locale = 'ig']) : super(locale);

  @override
  String get home => 'Ulo';

  @override
  String get settings => 'Ntọala';

  @override
  String get profile => 'Profailu';

  @override
  String get languageRegion => 'Asusu & Mpaghara';

  @override
  String get countryRegion => 'Mba / Mpaghara';

  @override
  String get preferredLanguage => 'Asusu achọrọ';

  @override
  String get preferredLanguageSaved => 'Echekwara asusu achọrọ.';

  @override
  String get save => 'Chekwaa';

  @override
  String get cancel => 'Kagbuo';

  @override
  String get back => 'Laghachi';

  @override
  String get continueLabel => 'Gaa n\'ihu';

  @override
  String get signIn => 'Banye';

  @override
  String get signOut => 'Puo';

  @override
  String get select => 'Họrọ';

  @override
  String get selectLanguage => 'Họrọ asusu';

  @override
  String get notSet => 'Edobeghi';

  @override
  String get languageRegionNotice =>
      'A ga-eme mgbanwe mba iche ka e wee nyochaa steeti na LGA nke ọma.';

  @override
  String get pilotEnglishNotice =>
      'Ọtụtụ ihuenyo ka di na Bekee na mwepute a; nke a na-echekwa asusu ị họọrọ.';

  @override
  String get completeYourProfile => 'Mezue profailu gị';

  @override
  String get saveAndContinue => 'Chekwaa ma gaa n\'ihu';

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
