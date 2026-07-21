import "dart:async";

import "package:flutter/material.dart";

import "../app/app_scope.dart";
import "../brand.dart";
import "../config/the_eye_api_config.dart";
import "../contracts/the_eye_api_client.dart";
import "../widgets/section_card.dart";
import "profile_widgets.dart";

class EmergencyContactsScreen extends StatefulWidget {
  const EmergencyContactsScreen({super.key});

  @override
  State<EmergencyContactsScreen> createState() =>
      _EmergencyContactsScreenState();
}

class _EmergencyContactsScreenState extends State<EmergencyContactsScreen> {
  final TheEyeApiClient _apiClient =
      TheEyeApiClient(baseUrl: TheEyeApiConfig.resolveBaseUrl());

  List<EmergencyContact> _contacts = const [];
  String? _error;
  bool _loading = true;
  bool _saving = false;

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _relationshipController = TextEditingController();
  String? _editingContactId;

  bool _loadStarted = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _relationshipController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loadStarted) {
      _loadStarted = true;
      unawaited(_loadContacts());
    }
  }

  Future<void> _loadContacts() async {
    final token = AppScope.of(context).accessToken;
    if (token == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final contacts =
          await _apiClient.listEmergencyContacts(accessToken: token);
      if (!mounted) return;
      setState(() {
        _contacts = contacts;
        _loading = false;
      });
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load emergency contacts.";
        _loading = false;
      });
    }
  }

  void _startEdit(EmergencyContact contact) {
    setState(() {
      _editingContactId = contact.id;
      _nameController.text = contact.name;
      _phoneController.text = contact.phone;
      _relationshipController.text = contact.relationship;
    });
  }

  void _clearForm() {
    setState(() {
      _editingContactId = null;
      _nameController.clear();
      _phoneController.clear();
      _relationshipController.clear();
    });
  }

  Future<void> _saveContact() async {
    final token = AppScope.of(context).accessToken;
    if (token == null) return;

    final payload = {
      "name": _nameController.text.trim(),
      "phone": _phoneController.text.trim(),
      "relationship": _relationshipController.text.trim(),
    };

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      if (_editingContactId != null) {
        await _apiClient.updateEmergencyContact(
          accessToken: token,
          contactId: _editingContactId!,
          payload: payload,
        );
      } else {
        await _apiClient.createEmergencyContact(
          accessToken: token,
          payload: payload,
        );
      }
      AppScope.of(context).clearCitizenProfileCache();
      _clearForm();
      await _loadContacts();
      if (!mounted) return;
      setState(() => _saving = false);
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _saving = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to save contact.";
        _saving = false;
      });
    }
  }

  Future<void> _deleteContact(EmergencyContact contact) async {
    final token = AppScope.of(context).accessToken;
    if (token == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Remove contact?"),
        content: Text("Remove ${contact.name} from your emergency contacts?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text("Cancel"),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text("Remove"),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await _apiClient.deleteEmergencyContact(
        accessToken: token,
        contactId: contact.id,
      );
      AppScope.of(context).clearCitizenProfileCache();
      if (_editingContactId == contact.id) _clearForm();
      await _loadContacts();
    } on AuthApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.userMessage);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Emergency contacts")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: _editingContactId == null ? "Add contact" : "Edit contact",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                profileLabeledField(
                  label: "Name",
                  field: TextField(
                    controller: _nameController,
                    decoration: profileFieldDecoration(hintText: "Full name"),
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
                  label: "Relationship",
                  field: TextField(
                    controller: _relationshipController,
                    decoration: profileFieldDecoration(hintText: "Spouse"),
                  ),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: BrandColors.danger),
                    ),
                  ),
                FilledButton(
                  onPressed: _saving ? null : _saveContact,
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(_editingContactId == null ? "Add contact" : "Save"),
                ),
                if (_editingContactId != null) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: _saving ? null : _clearForm,
                    child: const Text("Cancel edit"),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Saved contacts",
            child: _loading
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                : _contacts.isEmpty
                    ? const Text("No emergency contacts yet.")
                    : Column(
                        children: _contacts
                            .map(
                              (contact) => ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(contact.name),
                                subtitle: Text(
                                  "${contact.relationship} · ${contact.phone}",
                                ),
                                trailing: PopupMenuButton<String>(
                                  onSelected: (value) {
                                    if (value == "edit") {
                                      _startEdit(contact);
                                    } else if (value == "delete") {
                                      unawaited(_deleteContact(contact));
                                    }
                                  },
                                  itemBuilder: (context) => const [
                                    PopupMenuItem(
                                      value: "edit",
                                      child: Text("Edit"),
                                    ),
                                    PopupMenuItem(
                                      value: "delete",
                                      child: Text("Remove"),
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .toList(),
                      ),
          ),
        ],
      ),
    );
  }
}
