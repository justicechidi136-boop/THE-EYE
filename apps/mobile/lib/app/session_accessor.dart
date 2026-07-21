import "package:flutter/foundation.dart";

import "../contracts/the_eye_api_client.dart";

/// Shared session/profile surface for feature modules without importing [main.dart].
abstract class SessionAccessor extends ChangeNotifier {
  bool get isAuthenticated;
  String? get accessToken;
  bool get lowDataMode;

  CitizenProfile? get cachedCitizenProfile;

  Future<void> clearSession();
  Future<CitizenProfile?> loadCitizenProfile({bool forceRefresh = false});
  void clearCitizenProfileCache();
  Future<CitizenProfile> updateCitizenProfile(
    Map<String, Object?> payload,
  );
}
