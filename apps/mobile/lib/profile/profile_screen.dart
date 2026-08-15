import "dart:async";

import "package:flutter/material.dart";
import "package:image_picker/image_picker.dart";

import "../app/app_scope.dart";
import "../brand.dart";
import "../config/the_eye_api_config.dart";
import "../contracts/the_eye_api_client.dart";
import "../design_system/eye_input_theme.dart";
import "../settings/language_region_preference_store.dart";
import "../settings/language_region_registry.dart";
import "../settings/language_region_selector.dart";
import "../widgets/section_card.dart";
import "avatar_upload_service.dart";
import "profile_widgets.dart";

class ProfileScreenBody extends StatefulWidget {
  const ProfileScreenBody({super.key});

  @override
  State<ProfileScreenBody> createState() => _ProfileScreenBodyState();
}

class _ProfileScreenBodyState extends State<ProfileScreenBody> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _countryController = TextEditingController();
  final _stateController = TextEditingController();
  final _lgaController = TextEditingController();
  final _avatarUploadService = AvatarUploadService(
    apiClient: TheEyeApiClient(baseUrl: TheEyeApiConfig.resolveBaseUrl()),
  );

  CitizenProfile? _profile;
  String? _error;
  String? _completionError;
  String? _firstNameError;
  String? _lastNameError;
  String? _countryError;
  String? _languageError;
  String? _stateError;
  String? _lgaError;
  CountryRegionOption? _selectedCountry;
  PreferredLanguageOption? _selectedLanguage;
  LanguageRegionPreferenceStore? _languageRegionStore;
  bool _loading = true;
  bool _submittingCompletion = false;
  bool _uploadingAvatar = false;
  bool _loadStarted = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _countryController.dispose();
    _stateController.dispose();
    _lgaController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loadStarted) {
      _loadStarted = true;
      unawaited(_loadProfile());
    }
  }

  void _seedCompletionFields(CitizenProfile profile) {
    _firstNameController.text = profile.profile.firstName ?? "";
    _lastNameController.text = profile.profile.lastName ?? "";
    _selectedCountry =
        LanguageRegionRegistry.countryByCode(profile.profile.countryCode) ??
            LanguageRegionRegistry.countryFromLegacyName(
              profile.profile.country,
            ) ??
            _selectedCountry ??
            LanguageRegionRegistry.defaultCountry();
    _countryController.text = _selectedCountry?.displayName ?? "";
    _selectedLanguage = LanguageRegionRegistry.suggestedLanguage(
      deviceLocales: WidgetsBinding.instance.platformDispatcher.locales,
      countryCode: _selectedCountry?.code,
      cachedLocale: _languageRegionStore?.preferredLocale,
      serverLocale:
          profile.effectivePreferredLocale ?? profile.profile.preferredLocale,
    );
    _stateController.text = profile.profile.state ?? "";
    _lgaController.text = profile.profile.lga ?? "";
  }

  Future<void> _loadProfile({bool forceRefresh = false}) async {
    final session = AppScope.of(context);
    if (!session.isAuthenticated || session.accessToken == null) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _profile = null;
        _error = null;
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      _languageRegionStore ??= await LanguageRegionPreferenceStore.create();
      final profile =
          await session.loadCitizenProfile(forceRefresh: forceRefresh);
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _loading = false;
      });
      if (profile != null && !profile.profileComplete) {
        _seedCompletionFields(profile);
        await _languageRegionStore?.save(
          countryCode: _selectedCountry?.code,
          preferredLocale: _selectedLanguage?.locale,
        );
      }
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load your profile right now.";
        _loading = false;
      });
    }
  }

  Future<void> _submitCompletion() async {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final country = _selectedCountry;
    final language = _selectedLanguage;
    final state = _stateController.text.trim();
    final lga = _lgaController.text.trim();

    setState(() {
      _submittingCompletion = true;
      _completionError = null;
      _firstNameError = firstName.isEmpty ? "Enter your first name." : null;
      _lastNameError = lastName.isEmpty ? "Enter your last name." : null;
      _countryError = country == null ? "Select your country." : null;
      _languageError =
          language == null ? "Select your preferred language." : null;
      _stateError = state.isEmpty ? "Enter your state." : null;
      _lgaError = lga.isEmpty ? "Enter your LGA." : null;
    });

    if (_firstNameError != null ||
        _lastNameError != null ||
        _countryError != null ||
        _languageError != null ||
        _stateError != null ||
        _lgaError != null) {
      setState(() => _submittingCompletion = false);
      return;
    }

    final session = AppScope.of(context);
    try {
      final updated = await session.updateCitizenProfile({
        "firstName": firstName,
        "lastName": lastName,
        "country": country!.displayName,
        "countryCode": country.code,
        "preferredLocale": language!.locale,
        "state": state,
        "lga": lga,
      });
      await (_languageRegionStore ??
              await LanguageRegionPreferenceStore.create())
          .saveFromProfile(updated);
      if (!mounted) return;
      setState(() {
        _profile = updated;
        _submittingCompletion = false;
      });
      if (updated.profileComplete) {
        Navigator.of(context).pushReplacementNamed("/home");
      }
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _completionError = error.userMessage;
        _submittingCompletion = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _completionError = "Unable to save your profile right now.";
        _submittingCompletion = false;
      });
    }
  }

  Future<void> _pickAvatar(ImageSource source) async {
    final session = AppScope.of(context);
    final token = session.accessToken;
    if (token == null) return;

    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: source,
      maxWidth: 1920,
      imageQuality: 85,
    );
    if (!mounted || picked == null) return;

    setState(() {
      _uploadingAvatar = true;
      _error = null;
    });

    try {
      final updated = await _avatarUploadService.uploadAvatar(
        accessToken: token,
        sourcePath: picked.path,
        lowDataMode: session.lowDataMode,
      );
      session.clearCitizenProfileCache();
      await session.loadCitizenProfile(forceRefresh: true);
      if (!mounted) return;
      setState(() {
        _profile = updated;
        _uploadingAvatar = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = avatarUploadErrorMessage(error);
        _uploadingAvatar = false;
      });
    }
  }

  Future<void> _signOut() async {
    await AppScope.of(context).clearSession();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil("/login", (_) => false);
  }

  Widget _buildGuestGate() {
    return SectionCard(
      title: "Sign in required",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            "Create an account or sign in to view your citizen profile, KYC status, and emergency contacts.",
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.of(context).pushNamed("/login"),
            child: const Text("Sign in"),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => Navigator.of(context).pushNamed("/register"),
            child: const Text("Create an account"),
          ),
        ],
      ),
    );
  }

  Widget _buildCompletionForm() {
    return SectionCard(
      title: "Complete your profile",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            "Add your name and location so responders can verify your reports.",
          ),
          const SizedBox(height: 16),
          profileLabeledField(
            context: context,
            label: "First name",
            field: TextField(
              controller: _firstNameController,
              textInputAction: TextInputAction.next,
              style: EyeInputTheme.textStyle(context),
              cursorColor: EyeInputTheme.focusBorderColor(context),
              decoration: profileFieldDecoration(
                context: context,
                hintText: "Ada",
                errorText: _firstNameError,
              ),
            ),
          ),
          profileLabeledField(
            context: context,
            label: "Last name",
            field: TextField(
              controller: _lastNameController,
              textInputAction: TextInputAction.next,
              style: EyeInputTheme.textStyle(context),
              cursorColor: EyeInputTheme.focusBorderColor(context),
              decoration: profileFieldDecoration(
                context: context,
                hintText: "Okeke",
                errorText: _lastNameError,
              ),
            ),
          ),
          profileLabeledField(
            context: context,
            label: "Country / Region",
            field: LanguageRegionSelectorField<CountryRegionOption>(
              label: "Country / Region",
              valueLabel: _selectedCountry?.selectorLabel ?? "Select country",
              options: LanguageRegionRegistry.enabledCountries,
              optionLabel: (country) => country.selectorLabel,
              optionSearchText: (country) =>
                  "${country.code} ${country.englishName} ${country.nativeName}",
              errorText: _countryError,
              onChanged: (country) {
                setState(() {
                  _selectedCountry = country;
                  _countryController.text = country.displayName;
                  _countryError = null;
                });
              },
            ),
          ),
          profileLabeledField(
            context: context,
            label: "Preferred Language",
            field: LanguageRegionSelectorField<PreferredLanguageOption>(
              label: "Preferred Language",
              valueLabel: _selectedLanguage?.displayName ?? "Select language",
              options: LanguageRegionRegistry.enabledLanguages,
              optionLabel: (language) => language.displayName,
              optionSearchText: (language) =>
                  "${language.locale} ${language.englishName} ${language.nativeName}",
              errorText: _languageError,
              onChanged: (language) {
                setState(() {
                  _selectedLanguage = language;
                  _languageError = null;
                });
              },
            ),
          ),
          profileLabeledField(
            context: context,
            label: "State",
            field: TextField(
              controller: _stateController,
              textInputAction: TextInputAction.next,
              style: EyeInputTheme.textStyle(context),
              cursorColor: EyeInputTheme.focusBorderColor(context),
              decoration: profileFieldDecoration(
                context: context,
                hintText: "Lagos",
                errorText: _stateError,
              ),
            ),
          ),
          profileLabeledField(
            context: context,
            label: "LGA",
            field: TextField(
              controller: _lgaController,
              textInputAction: TextInputAction.done,
              style: EyeInputTheme.textStyle(context),
              cursorColor: EyeInputTheme.focusBorderColor(context),
              decoration: profileFieldDecoration(
                context: context,
                hintText: "Ikeja",
                errorText: _lgaError,
              ),
            ),
          ),
          if (_completionError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                _completionError!,
                style: const TextStyle(color: BrandColors.danger),
              ),
            ),
          FilledButton(
            onPressed: _submittingCompletion ? null : _submitCompletion,
            child: _submittingCompletion
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text("Save and continue"),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(CitizenProfile profile) {
    final avatarUrl = profile.profile.avatarUrl;
    return Stack(
      alignment: Alignment.bottomRight,
      children: [
        CircleAvatar(
          radius: 42,
          backgroundImage: avatarUrl != null && avatarUrl.isNotEmpty
              ? NetworkImage(avatarUrl)
              : null,
          child: avatarUrl == null || avatarUrl.isEmpty
              ? const Icon(Icons.person, size: 44)
              : null,
        ),
        if (_uploadingAvatar)
          const Positioned.fill(
            child: ColoredBox(
              color: Colors.black45,
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          )
        else
          IconButton.filled(
            tooltip: "Change photo",
            onPressed: () => _showAvatarPicker(),
            icon: const Icon(Icons.camera_alt, size: 18),
          ),
      ],
    );
  }

  Future<void> _showAvatarPicker() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text("Choose from gallery"),
              onTap: () {
                Navigator.pop(context);
                unawaited(_pickAvatar(ImageSource.gallery));
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text("Take photo"),
              onTap: () {
                Navigator.pop(context);
                unawaited(_pickAvatar(ImageSource.camera));
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileView(CitizenProfile profile) {
    final location = [
      profile.profile.lga,
      profile.profile.state,
      profile.profile.country,
    ].where((part) => part != null && part.trim().isNotEmpty).join(", ");

    return SectionCard(
      title: "Citizen profile",
      child: Column(
        children: [
          _buildAvatar(profile),
          const SizedBox(height: 16),
          ProfileRow("Name", profile.displayName),
          if (profile.email != null && profile.email!.isNotEmpty)
            ProfileRow("Email", profile.email!),
          if (profile.phone != null && profile.phone!.isNotEmpty)
            ProfileRow("Phone", profile.phone!),
          if (location.isNotEmpty) ...[
            ProfileRow("Profile jurisdiction", location),
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                "Saved profile jurisdiction — not your current GPS location.",
                style: TextStyle(fontSize: 12),
              ),
            ),
          ],
          ProfileRow("KYC status", profile.kycStatus),
          ProfileRow(
            "Trust score",
            profile.trustScore != null
                ? profile.trustScore!.toStringAsFixed(0)
                : "Not rated",
          ),
          ProfileRow(
            "Emergency contacts",
            profile.emergencyContacts.isNotEmpty
                ? "${profile.emergencyContacts.length} saved"
                : "None yet",
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () async {
              await Navigator.of(context).pushNamed("/profile/edit");
              if (mounted) unawaited(_loadProfile(forceRefresh: true));
            },
            child: const Text("Edit profile"),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () async {
              await Navigator.of(context)
                  .pushNamed("/profile/emergency-contacts");
              if (mounted) unawaited(_loadProfile(forceRefresh: true));
            },
            child: const Text("Emergency contacts"),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () async {
              await Navigator.of(context).pushNamed("/profile/kyc");
              if (mounted) unawaited(_loadProfile(forceRefresh: true));
            },
            child: const Text("Identity verification (KYC)"),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: _signOut,
            child: const Text("Sign out"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context);
    if (!session.isAuthenticated) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [_buildGuestGate()],
      );
    }

    if (_loading) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: const [
          SectionCard(
            title: "Citizen profile",
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
        ],
      );
    }

    if (_error != null && _profile == null) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Citizen profile",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(_error!,
                    style: const TextStyle(color: BrandColors.danger)),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => _loadProfile(forceRefresh: true),
                  child: const Text("Retry"),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final profile = _profile;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
      children: [
        if (profile != null && !profile.profileComplete)
          _buildCompletionForm()
        else if (profile != null)
          _buildProfileView(profile),
        if (_error != null && profile != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(_error!,
                style: const TextStyle(color: BrandColors.danger)),
          ),
      ],
    );
  }
}
