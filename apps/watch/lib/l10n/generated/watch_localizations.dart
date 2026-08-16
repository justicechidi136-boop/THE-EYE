import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'watch_localizations_en.dart';
import 'watch_localizations_ha.dart';
import 'watch_localizations_ig.dart';
import 'watch_localizations_pcm.dart';
import 'watch_localizations_yo.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of WatchLocalizations
/// returned by `WatchLocalizations.of(context)`.
///
/// Applications need to include `WatchLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/watch_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: WatchLocalizations.localizationsDelegates,
///   supportedLocales: WatchLocalizations.supportedLocales,
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
/// be consistent with the languages listed in the WatchLocalizations.supportedLocales
/// property.
abstract class WatchLocalizations {
  WatchLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static WatchLocalizations of(BuildContext context) {
    return Localizations.of<WatchLocalizations>(context, WatchLocalizations)!;
  }

  static const LocalizationsDelegate<WatchLocalizations> delegate =
      _WatchLocalizationsDelegate();

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

  /// No description provided for @sos.
  ///
  /// In en, this message translates to:
  /// **'SOS'**
  String get sos;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @alerts.
  ///
  /// In en, this message translates to:
  /// **'Alerts'**
  String get alerts;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @silentAlert.
  ///
  /// In en, this message translates to:
  /// **'Silent alert'**
  String get silentAlert;

  /// No description provided for @radius.
  ///
  /// In en, this message translates to:
  /// **'Radius'**
  String get radius;

  /// No description provided for @apps.
  ///
  /// In en, this message translates to:
  /// **'Apps'**
  String get apps;

  /// No description provided for @selectLanguage.
  ///
  /// In en, this message translates to:
  /// **'Select language'**
  String get selectLanguage;

  /// No description provided for @preferredLanguageSaved.
  ///
  /// In en, this message translates to:
  /// **'Language saved'**
  String get preferredLanguageSaved;

  /// No description provided for @areaSafe.
  ///
  /// In en, this message translates to:
  /// **'Area safe'**
  String get areaSafe;

  /// No description provided for @stayAlertSuspiciousActivity.
  ///
  /// In en, this message translates to:
  /// **'Stay alert for suspicious activity.'**
  String get stayAlertSuspiciousActivity;

  /// No description provided for @highAlert.
  ///
  /// In en, this message translates to:
  /// **'High alert'**
  String get highAlert;

  /// No description provided for @beCarefulStayAlert.
  ///
  /// In en, this message translates to:
  /// **'Be careful and stay alert.'**
  String get beCarefulStayAlert;

  /// No description provided for @danger.
  ///
  /// In en, this message translates to:
  /// **'Danger'**
  String get danger;

  /// No description provided for @nearby.
  ///
  /// In en, this message translates to:
  /// **'Nearby'**
  String get nearby;

  /// No description provided for @areaCleared.
  ///
  /// In en, this message translates to:
  /// **'Area cleared'**
  String get areaCleared;

  /// No description provided for @dangerAlert.
  ///
  /// In en, this message translates to:
  /// **'Danger alert'**
  String get dangerAlert;

  /// No description provided for @iUnderstand.
  ///
  /// In en, this message translates to:
  /// **'I understand'**
  String get iUnderstand;

  /// No description provided for @hearAgain.
  ///
  /// In en, this message translates to:
  /// **'Hear again'**
  String get hearAgain;

  /// No description provided for @muteAlert.
  ///
  /// In en, this message translates to:
  /// **'Mute alert'**
  String get muteAlert;

  /// No description provided for @voiceUnavailableShowingText.
  ///
  /// In en, this message translates to:
  /// **'Voice unavailable - showing text'**
  String get voiceUnavailableShowingText;

  /// No description provided for @dangerAlertReceived.
  ///
  /// In en, this message translates to:
  /// **'Danger alert received'**
  String get dangerAlertReceived;

  /// No description provided for @dangerWarning.
  ///
  /// In en, this message translates to:
  /// **'Danger warning'**
  String get dangerWarning;

  /// No description provided for @alertAcknowledged.
  ///
  /// In en, this message translates to:
  /// **'Alert acknowledged'**
  String get alertAcknowledged;

  /// No description provided for @dangerTypeArmedRobbery.
  ///
  /// In en, this message translates to:
  /// **'Armed robbery'**
  String get dangerTypeArmedRobbery;

  /// No description provided for @dangerTypeKidnapping.
  ///
  /// In en, this message translates to:
  /// **'Kidnapping'**
  String get dangerTypeKidnapping;

  /// No description provided for @dangerTypeViolentAttack.
  ///
  /// In en, this message translates to:
  /// **'Violent attack'**
  String get dangerTypeViolentAttack;

  /// No description provided for @dangerTypeActiveShooter.
  ///
  /// In en, this message translates to:
  /// **'Active shooter'**
  String get dangerTypeActiveShooter;

  /// No description provided for @dangerTypeCommunalViolence.
  ///
  /// In en, this message translates to:
  /// **'Communal violence'**
  String get dangerTypeCommunalViolence;

  /// No description provided for @dangerTypeTerroristThreat.
  ///
  /// In en, this message translates to:
  /// **'Terrorist threat'**
  String get dangerTypeTerroristThreat;

  /// No description provided for @dangerTypeFire.
  ///
  /// In en, this message translates to:
  /// **'Fire'**
  String get dangerTypeFire;

  /// No description provided for @dangerTypeFlood.
  ///
  /// In en, this message translates to:
  /// **'Flood'**
  String get dangerTypeFlood;

  /// No description provided for @dangerTypeGasLeak.
  ///
  /// In en, this message translates to:
  /// **'Gas leak'**
  String get dangerTypeGasLeak;

  /// No description provided for @dangerTypeHazardousArea.
  ///
  /// In en, this message translates to:
  /// **'Hazardous area'**
  String get dangerTypeHazardousArea;

  /// No description provided for @dangerTypeRoadDanger.
  ///
  /// In en, this message translates to:
  /// **'Road danger'**
  String get dangerTypeRoadDanger;

  /// No description provided for @dangerTypeBuildingCollapse.
  ///
  /// In en, this message translates to:
  /// **'Building collapse'**
  String get dangerTypeBuildingCollapse;

  /// No description provided for @dangerTypeCivilDisturbance.
  ///
  /// In en, this message translates to:
  /// **'Civil disturbance'**
  String get dangerTypeCivilDisturbance;

  /// No description provided for @dangerTypePoliceAdvisory.
  ///
  /// In en, this message translates to:
  /// **'Police advisory'**
  String get dangerTypePoliceAdvisory;

  /// No description provided for @dangerTypeMissingChild.
  ///
  /// In en, this message translates to:
  /// **'Missing child'**
  String get dangerTypeMissingChild;

  /// No description provided for @dangerTypeEvacuation.
  ///
  /// In en, this message translates to:
  /// **'Evacuation'**
  String get dangerTypeEvacuation;
}

class _WatchLocalizationsDelegate
    extends LocalizationsDelegate<WatchLocalizations> {
  const _WatchLocalizationsDelegate();

  @override
  Future<WatchLocalizations> load(Locale locale) {
    return SynchronousFuture<WatchLocalizations>(
        lookupWatchLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ha', 'ig', 'pcm', 'yo'].contains(locale.languageCode);

  @override
  bool shouldReload(_WatchLocalizationsDelegate old) => false;
}

WatchLocalizations lookupWatchLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return WatchLocalizationsEn();
    case 'ha':
      return WatchLocalizationsHa();
    case 'ig':
      return WatchLocalizationsIg();
    case 'pcm':
      return WatchLocalizationsPcm();
    case 'yo':
      return WatchLocalizationsYo();
  }

  throw FlutterError(
      'WatchLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
