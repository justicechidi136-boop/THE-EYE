import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "incident_draft.dart";

abstract class PendingSubmissionStore {
  Future<List<IncidentDraft>> loadPending();
  Future<void> savePending(List<IncidentDraft> drafts);
  Future<void> clear();
}

class SharedPreferencesPendingSubmissionStore
    implements PendingSubmissionStore {
  SharedPreferencesPendingSubmissionStore(this._preferences);

  static const storageKey = "the_eye_pending_incident_submissions";
  final SharedPreferences _preferences;

  static Future<SharedPreferencesPendingSubmissionStore> create() async {
    return SharedPreferencesPendingSubmissionStore(
        await SharedPreferences.getInstance());
  }

  @override
  Future<List<IncidentDraft>> loadPending() async {
    final raw = _preferences.getString(storageKey);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .map((item) =>
            IncidentDraft.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  @override
  Future<void> savePending(List<IncidentDraft> drafts) async {
    final encoded = jsonEncode(drafts.map((draft) => draft.toJson()).toList());
    await _preferences.setString(storageKey, encoded);
  }

  @override
  Future<void> clear() async {
    await _preferences.remove(storageKey);
  }
}

class InMemoryPendingSubmissionStore implements PendingSubmissionStore {
  List<IncidentDraft> drafts = [];

  @override
  Future<List<IncidentDraft>> loadPending() async =>
      List<IncidentDraft>.from(drafts);

  @override
  Future<void> savePending(List<IncidentDraft> value) async {
    drafts = List<IncidentDraft>.from(value);
  }

  @override
  Future<void> clear() async {
    drafts = [];
  }
}
