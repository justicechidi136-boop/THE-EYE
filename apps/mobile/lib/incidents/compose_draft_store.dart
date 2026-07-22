import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "incident_draft.dart";

class ComposeDraftStore {
  ComposeDraftStore({SharedPreferences? preferences})
      : _preferences = preferences;

  static const storageKey = "the_eye_compose_incident_drafts";

  SharedPreferences? _preferences;

  Future<SharedPreferences> _prefs() async {
    return _preferences ??= await SharedPreferences.getInstance();
  }

  Future<List<IncidentDraft>> loadDrafts() async {
    final prefs = await _prefs();
    final raw = prefs.getStringList(storageKey) ?? const [];
    return raw
        .map((entry) =>
            IncidentDraft.fromJson(jsonDecode(entry) as Map<String, dynamic>))
        .toList();
  }

  Future<void> saveDrafts(List<IncidentDraft> drafts) async {
    final prefs = await _prefs();
    await prefs.setStringList(
      storageKey,
      drafts.map((draft) => jsonEncode(draft.toJson())).toList(),
    );
  }

  Future<void> upsertDraft(IncidentDraft draft) async {
    final drafts = await loadDrafts();
    final next = [
      draft,
      ...drafts
          .where((item) => item.clientSubmissionId != draft.clientSubmissionId),
    ];
    await saveDrafts(next);
  }

  Future<void> deleteDraft(String clientSubmissionId) async {
    final drafts = await loadDrafts();
    await saveDrafts(
      drafts
          .where((item) => item.clientSubmissionId != clientSubmissionId)
          .toList(),
    );
  }
}
