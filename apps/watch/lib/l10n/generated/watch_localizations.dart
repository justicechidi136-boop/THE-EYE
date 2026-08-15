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
