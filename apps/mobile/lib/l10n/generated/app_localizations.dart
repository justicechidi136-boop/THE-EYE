import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ha.dart';
import 'app_localizations_ig.dart';
import 'app_localizations_pcm.dart';
import 'app_localizations_yo.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
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
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

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
    Locale('yo')
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

  /// No description provided for @languageRegion.
  ///
  /// In en, this message translates to:
  /// **'Language & Region'**
  String get languageRegion;

  /// No description provided for @countryRegion.
  ///
  /// In en, this message translates to:
  /// **'Country / Region'**
  String get countryRegion;

  /// No description provided for @preferredLanguage.
  ///
  /// In en, this message translates to:
  /// **'Preferred Language'**
  String get preferredLanguage;

  /// No description provided for @preferredLanguageSaved.
  ///
  /// In en, this message translates to:
  /// **'Preferred language saved.'**
  String get preferredLanguageSaved;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @select.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get select;

  /// No description provided for @selectLanguage.
  ///
  /// In en, this message translates to:
  /// **'Select language'**
  String get selectLanguage;

  /// No description provided for @notSet.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get notSet;

  /// No description provided for @languageRegionNotice.
  ///
  /// In en, this message translates to:
  /// **'Country changes are handled separately so state and LGA can be revalidated safely.'**
  String get languageRegionNotice;

  /// No description provided for @pilotEnglishNotice.
  ///
  /// In en, this message translates to:
  /// **'Most screens remain English in this release; this saves your preference for upcoming language support.'**
  String get pilotEnglishNotice;

  /// No description provided for @completeYourProfile.
  ///
  /// In en, this message translates to:
  /// **'Complete your profile'**
  String get completeYourProfile;

  /// No description provided for @saveAndContinue.
  ///
  /// In en, this message translates to:
  /// **'Save and continue'**
  String get saveAndContinue;

  /// No description provided for @reportSighting.
  ///
  /// In en, this message translates to:
  /// **'Report Sighting'**
  String get reportSighting;

  /// No description provided for @useCurrentLocation.
  ///
  /// In en, this message translates to:
  /// **'Use current location'**
  String get useCurrentLocation;

  /// No description provided for @enterManually.
  ///
  /// In en, this message translates to:
  /// **'Enter manually'**
  String get enterManually;

  /// No description provided for @stateLabel.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get stateLabel;

  /// No description provided for @cityTown.
  ///
  /// In en, this message translates to:
  /// **'City/Town'**
  String get cityTown;

  /// No description provided for @cityTownName.
  ///
  /// In en, this message translates to:
  /// **'City/Town name'**
  String get cityTownName;

  /// No description provided for @streetRoadAddress.
  ///
  /// In en, this message translates to:
  /// **'Street/Road Address'**
  String get streetRoadAddress;

  /// No description provided for @sightingDetails.
  ///
  /// In en, this message translates to:
  /// **'Sighting Details'**
  String get sightingDetails;

  /// No description provided for @newSightingReported.
  ///
  /// In en, this message translates to:
  /// **'New sighting reported'**
  String get newSightingReported;

  /// No description provided for @reportedLabel.
  ///
  /// In en, this message translates to:
  /// **'Reported'**
  String get reportedLabel;

  /// No description provided for @observedLabel.
  ///
  /// In en, this message translates to:
  /// **'Observed'**
  String get observedLabel;

  /// No description provided for @locationLabel.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get locationLabel;

  /// No description provided for @whatWasObserved.
  ///
  /// In en, this message translates to:
  /// **'What was observed'**
  String get whatWasObserved;

  /// No description provided for @evidenceLabel.
  ///
  /// In en, this message translates to:
  /// **'Evidence'**
  String get evidenceLabel;

  /// No description provided for @noEvidenceAttached.
  ///
  /// In en, this message translates to:
  /// **'No evidence attached.'**
  String get noEvidenceAttached;

  /// No description provided for @viewOriginalBroadcast.
  ///
  /// In en, this message translates to:
  /// **'View original Broadcast'**
  String get viewOriginalBroadcast;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @capturedLabel.
  ///
  /// In en, this message translates to:
  /// **'Captured'**
  String get capturedLabel;

  /// No description provided for @incidentArchive.
  ///
  /// In en, this message translates to:
  /// **'Incident archive'**
  String get incidentArchive;

  /// No description provided for @completedEmergency.
  ///
  /// In en, this message translates to:
  /// **'Completed emergency'**
  String get completedEmergency;

  /// No description provided for @incidentResolved.
  ///
  /// In en, this message translates to:
  /// **'Incident resolved'**
  String get incidentResolved;

  /// No description provided for @incidentCancelled.
  ///
  /// In en, this message translates to:
  /// **'Incident cancelled'**
  String get incidentCancelled;

  /// No description provided for @incidentClosed.
  ///
  /// In en, this message translates to:
  /// **'Incident closed'**
  String get incidentClosed;

  /// No description provided for @incidentOverview.
  ///
  /// In en, this message translates to:
  /// **'Incident overview'**
  String get incidentOverview;

  /// No description provided for @completedResponseProgress.
  ///
  /// In en, this message translates to:
  /// **'Completed response progress'**
  String get completedResponseProgress;

  /// No description provided for @finalStatus.
  ///
  /// In en, this message translates to:
  /// **'Final status'**
  String get finalStatus;

  /// No description provided for @resolutionReason.
  ///
  /// In en, this message translates to:
  /// **'Resolution reason'**
  String get resolutionReason;

  /// No description provided for @cancellationReason.
  ///
  /// In en, this message translates to:
  /// **'Cancellation reason'**
  String get cancellationReason;

  /// No description provided for @communicationHistory.
  ///
  /// In en, this message translates to:
  /// **'Communication history'**
  String get communicationHistory;

  /// No description provided for @readOnly.
  ///
  /// In en, this message translates to:
  /// **'Read only'**
  String get readOnly;

  /// No description provided for @noEvidenceSubmitted.
  ///
  /// In en, this message translates to:
  /// **'No evidence submitted.'**
  String get noEvidenceSubmitted;

  /// No description provided for @noDispatchActivityRecorded.
  ///
  /// In en, this message translates to:
  /// **'No dispatch activity recorded.'**
  String get noDispatchActivityRecorded;

  /// No description provided for @viewCommunicationHistory.
  ///
  /// In en, this message translates to:
  /// **'View communication history'**
  String get viewCommunicationHistory;

  /// No description provided for @broadcastSelectedVehicle.
  ///
  /// In en, this message translates to:
  /// **'Selected vehicle'**
  String get broadcastSelectedVehicle;

  /// No description provided for @broadcastChangeVehicle.
  ///
  /// In en, this message translates to:
  /// **'Change vehicle'**
  String get broadcastChangeVehicle;

  /// No description provided for @broadcastShare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get broadcastShare;

  /// No description provided for @broadcastComments.
  ///
  /// In en, this message translates to:
  /// **'Comments'**
  String get broadcastComments;

  /// No description provided for @broadcastResolve.
  ///
  /// In en, this message translates to:
  /// **'Resolve'**
  String get broadcastResolve;

  /// No description provided for @broadcastWithdraw.
  ///
  /// In en, this message translates to:
  /// **'Withdraw'**
  String get broadcastWithdraw;

  /// No description provided for @broadcastReport.
  ///
  /// In en, this message translates to:
  /// **'Report Broadcast'**
  String get broadcastReport;

  /// No description provided for @broadcastMissingPersonLabel.
  ///
  /// In en, this message translates to:
  /// **'Missing person'**
  String get broadcastMissingPersonLabel;

  /// No description provided for @broadcastStolenVehicleLabel.
  ///
  /// In en, this message translates to:
  /// **'Stolen vehicle'**
  String get broadcastStolenVehicleLabel;

  /// No description provided for @broadcastSafetyUpdateLabel.
  ///
  /// In en, this message translates to:
  /// **'Safety update'**
  String get broadcastSafetyUpdateLabel;

  /// No description provided for @broadcastSafetyUpdateSummary.
  ///
  /// In en, this message translates to:
  /// **'Open this safety update for more information.'**
  String get broadcastSafetyUpdateSummary;

  /// No description provided for @broadcastVehicleFallback.
  ///
  /// In en, this message translates to:
  /// **'Vehicle'**
  String get broadcastVehicleFallback;

  /// No description provided for @broadcastPersonFallback.
  ///
  /// In en, this message translates to:
  /// **'Person'**
  String get broadcastPersonFallback;

  /// No description provided for @broadcastStolenVehicleFallbackSummary.
  ///
  /// In en, this message translates to:
  /// **'A vehicle was reported stolen.'**
  String get broadcastStolenVehicleFallbackSummary;

  /// No description provided for @broadcastMissingPersonFallbackSummary.
  ///
  /// In en, this message translates to:
  /// **'Open this missing person alert for more information.'**
  String get broadcastMissingPersonFallbackSummary;

  /// No description provided for @broadcastStatusActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get broadcastStatusActive;

  /// No description provided for @broadcastStatusUpdated.
  ///
  /// In en, this message translates to:
  /// **'Updated'**
  String get broadcastStatusUpdated;

  /// No description provided for @broadcastStatusResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get broadcastStatusResolved;

  /// No description provided for @broadcastStatusWithdrawn.
  ///
  /// In en, this message translates to:
  /// **'Withdrawn'**
  String get broadcastStatusWithdrawn;

  /// No description provided for @broadcastStatusSuspended.
  ///
  /// In en, this message translates to:
  /// **'Unavailable'**
  String get broadcastStatusSuspended;

  /// No description provided for @broadcastStatusExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get broadcastStatusExpired;

  /// No description provided for @broadcastStatusUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Update available'**
  String get broadcastStatusUnavailable;

  /// No description provided for @broadcastMissingPersonTitle.
  ///
  /// In en, this message translates to:
  /// **'Missing person: {name}'**
  String broadcastMissingPersonTitle(Object name);

  /// No description provided for @broadcastStolenVehicleTitle.
  ///
  /// In en, this message translates to:
  /// **'Stolen vehicle: {subject}'**
  String broadcastStolenVehicleTitle(Object subject);

  /// No description provided for @broadcastStolenVehicleTitleWithPlate.
  ///
  /// In en, this message translates to:
  /// **'Stolen vehicle: {subject} ({plate})'**
  String broadcastStolenVehicleTitleWithPlate(Object plate, Object subject);

  /// No description provided for @broadcastStolenVehicleSummary.
  ///
  /// In en, this message translates to:
  /// **'{subject} reported stolen on {date}.'**
  String broadcastStolenVehicleSummary(Object date, Object subject);

  /// No description provided for @broadcastMissingPersonExactSummary.
  ///
  /// In en, this message translates to:
  /// **'{age}-year-old {name} was last seen on {date}.'**
  String broadcastMissingPersonExactSummary(
      Object age, Object date, Object name);

  /// No description provided for @broadcastMissingPersonRangeSummary.
  ///
  /// In en, this message translates to:
  /// **'{name}, approximately {age} years old, was last seen on {date}.'**
  String broadcastMissingPersonRangeSummary(
      Object age, Object date, Object name);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ha', 'ig', 'pcm', 'yo'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ha':
      return AppLocalizationsHa();
    case 'ig':
      return AppLocalizationsIg();
    case 'pcm':
      return AppLocalizationsPcm();
    case 'yo':
      return AppLocalizationsYo();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
