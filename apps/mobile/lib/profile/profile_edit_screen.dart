import "dart:async";

import "package:flutter/material.dart";

import "../app/app_scope.dart";
import "../brand.dart";
import "../contracts/the_eye_api_client.dart";
import "../widgets/section_card.dart";
import "profile_widgets.dart";

class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _countryController = TextEditingController();
  final _stateController = TextEditingController();
  final _lgaController = TextEditingController();
  String? _gender;
  String? _dateOfBirth;
  String? _formError;
  bool _loading = true;
  bool _saving = false;

  bool _loadStarted = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
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

  Future<void> _loadProfile() async {
    final session = AppScope.of(context);
    try {
      final profile = await session.loadCitizenProfile(forceRefresh: true);
      if (!mounted || profile == null) return;
      setState(() {
        _firstNameController.text = profile.profile.firstName ?? "";
        _lastNameController.text = profile.profile.lastName ?? "";
        _phoneController.text = profile.phone ?? "";
        _addressController.text = profile.profile.address ?? "";
        _countryController.text = profile.profile.country ?? "";
        _stateController.text = profile.profile.state ?? "";
        _lgaController.text = profile.profile.lga ?? "";
        _gender = profile.profile.gender;
        _dateOfBirth = profile.profile.dateOfBirth;
        _loading = false;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _formError = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _formError = "Unable to load profile.";
        _loading = false;
      });
    }
  }

  Future<void> _pickDateOfBirth() async {
    final initial = _dateOfBirth != null
        ? DateTime.tryParse(_dateOfBirth!) ?? DateTime(1990)
        : DateTime(1990);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() {
      _dateOfBirth =
          "${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _formError = null;
    });

    final session = AppScope.of(context);
    try {
      await session.updateCitizenProfile({
        "firstName": _firstNameController.text.trim(),
        "lastName": _lastNameController.text.trim(),
        "phone": _phoneController.text.trim().isEmpty
            ? null
            : _phoneController.text.trim(),
        "address": _addressController.text.trim().isEmpty
            ? null
            : _addressController.text.trim(),
        "country": _countryController.text.trim(),
        "state": _stateController.text.trim(),
        "lga": _lgaController.text.trim(),
        "gender": _gender,
        "dateOfBirth": _dateOfBirth,
      });
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _formError = error.userMessage;
        _saving = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _formError = "Unable to save profile.";
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Edit profile")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionCard(
                  title: "Personal details",
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      profileLabeledField(
                        label: "First name",
                        field: TextField(
                          controller: _firstNameController,
                          decoration:
                              profileFieldDecoration(hintText: "First name"),
                        ),
                      ),
                      profileLabeledField(
                        label: "Last name",
                        field: TextField(
                          controller: _lastNameController,
                          decoration:
                              profileFieldDecoration(hintText: "Last name"),
                        ),
                      ),
                      profileLabeledField(
                        label: "Phone",
                        field: TextField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          decoration: profileFieldDecoration(hintText: "+234..."),
                        ),
                      ),
                      profileLabeledField(
                        label: "Address",
                        field: TextField(
                          controller: _addressController,
                          decoration:
                              profileFieldDecoration(hintText: "Street address"),
                        ),
                      ),
                      profileLabeledField(
                        label: "Country",
                        field: TextField(
                          controller: _countryController,
                          decoration: profileFieldDecoration(hintText: "Country"),
                        ),
                      ),
                      profileLabeledField(
                        label: "State",
                        field: TextField(
                          controller: _stateController,
                          decoration: profileFieldDecoration(hintText: "State"),
                        ),
                      ),
                      profileLabeledField(
                        label: "LGA",
                        field: TextField(
                          controller: _lgaController,
                          decoration: profileFieldDecoration(hintText: "LGA"),
                        ),
                      ),
                      profileLabeledField(
                        label: "Gender",
                        field: DropdownButtonFormField<String>(
                          value: _gender,
                          decoration: profileFieldDecoration(hintText: "Select"),
                          items: const [
                            DropdownMenuItem(value: "Female", child: Text("Female")),
                            DropdownMenuItem(value: "Male", child: Text("Male")),
                            DropdownMenuItem(value: "Other", child: Text("Other")),
                          ],
                          onChanged: (value) => setState(() => _gender = value),
                        ),
                      ),
                      profileLabeledField(
                        label: "Date of birth",
                        field: OutlinedButton(
                          onPressed: _pickDateOfBirth,
                          child: Text(_dateOfBirth ?? "Select date"),
                        ),
                      ),
                      if (_formError != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            _formError!,
                            style: const TextStyle(color: BrandColors.danger),
                          ),
                        ),
                      FilledButton(
                        onPressed: _saving ? null : _save,
                        child: _saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text("Save changes"),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
