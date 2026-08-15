// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get home => 'Home';

  @override
  String get settings => 'Settings';

  @override
  String get profile => 'Profile';

  @override
  String get languageRegion => 'Language & Region';

  @override
  String get countryRegion => 'Country / Region';

  @override
  String get preferredLanguage => 'Preferred Language';

  @override
  String get preferredLanguageSaved => 'Preferred language saved.';

  @override
  String get save => 'Save';

  @override
  String get cancel => 'Cancel';

  @override
  String get back => 'Back';

  @override
  String get continueLabel => 'Continue';

  @override
  String get signIn => 'Sign in';

  @override
  String get signOut => 'Sign out';

  @override
  String get select => 'Select';

  @override
  String get selectLanguage => 'Select language';

  @override
  String get notSet => 'Not set';

  @override
  String get languageRegionNotice =>
      'Country changes are handled separately so state and LGA can be revalidated safely.';

  @override
  String get pilotEnglishNotice =>
      'Most screens remain English in this release; this saves your preference for upcoming language support.';

  @override
  String get completeYourProfile => 'Complete your profile';

  @override
  String get saveAndContinue => 'Save and continue';
}
