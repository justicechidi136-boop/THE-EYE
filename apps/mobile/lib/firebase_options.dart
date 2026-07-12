import "package:firebase_core/firebase_core.dart" show FirebaseOptions;

import "config/app_flavor.dart";
import "config/firebase_bootstrap.dart";

/// Flavor-aware Firebase options. Prefer [firebaseOptionsForFlavor] directly.
@Deprecated("Use firebaseOptionsForFlavor(AppFlavorConfig.current) instead")
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform =>
      firebaseOptionsForFlavor(AppFlavorConfig.current);
}
