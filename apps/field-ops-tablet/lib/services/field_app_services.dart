import '../api/field_api_client.dart';
import '../auth/field_auth_service.dart';
import '../device/field_device_service.dart';
import '../security/device_keystore_service.dart';
import '../security/secure_session_store.dart';

class FieldAppServices {
  FieldAppServices({
    FieldApiClient? api,
    SecureSessionStore? session,
    DeviceKeystoreService? keystore,
  })  : api = api ?? FieldApiClient(),
        session = session ?? SecureSessionStore(),
        keystore = keystore ?? DeviceKeystoreService() {
    auth = FieldAuthService(
      api: this.api,
      session: this.session,
      keystore: this.keystore,
    );
    devices = FieldDeviceService(
      api: this.api,
      session: this.session,
      keystore: this.keystore,
      auth: auth,
    );
  }

  final FieldApiClient api;
  final SecureSessionStore session;
  final DeviceKeystoreService keystore;
  late final FieldAuthService auth;
  late final FieldDeviceService devices;

  Future<void> dispose() async {
    api.dispose();
  }
}
