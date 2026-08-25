import '../api/field_api_client.dart';
import '../auth/field_auth_service.dart';
import '../device/field_device_service.dart';
import '../launcher/launcher_policy_service.dart';
import '../pairing/field_pairing_service.dart';
import '../security/device_keystore_service.dart';
import '../security/secure_session_store.dart';
import '../l10n/field_locale_store.dart';
import 'field_account_locale_service.dart';
import 'field_device_context_service.dart';
import 'field_events_service.dart';
import 'field_offline_queue.dart';
import 'field_workflows_service.dart';
import 'field_broadcast_media_service.dart';

class FieldAppServices {
  FieldAppServices({
    FieldApiClient? api,
    SecureSessionStore? session,
    DeviceKeystoreService? keystore,
    FieldDeviceContextService? deviceContext,
  }) : api = api ?? FieldApiClient(),
       session = session ?? SecureSessionStore(),
       keystore = keystore ?? DeviceKeystoreService(),
       deviceContext = deviceContext ?? FieldDeviceContextService() {
    accountLocale = FieldAccountLocaleService(
      api: this.api,
      store: FieldLocaleStore(this.session),
    );
    auth = FieldAuthService(
      api: this.api,
      session: this.session,
      keystore: this.keystore,
      onLocaleResolved: accountLocale.applyServerLocale,
      onLogoutLocaleCleared: accountLocale.resetAfterLogout,
    );
    devices = FieldDeviceService(
      api: this.api,
      session: this.session,
      keystore: this.keystore,
      auth: auth,
    );
    workflows = FieldWorkflowsService(api: this.api);
    broadcastMedia = FieldBroadcastMediaService(api: this.api);
    offlineQueue = FieldOfflineQueue(api: this.api, workflows: workflows);
    events = FieldEventsService(workflows: workflows);
    launcherPolicy = LauncherPolicyService(
      api: this.api,
      session: this.session,
    );
    pairing = FieldPairingService(api: this.api, keystore: this.keystore);
  }

  final FieldApiClient api;
  final SecureSessionStore session;
  final DeviceKeystoreService keystore;
  final FieldDeviceContextService deviceContext;
  late final FieldAccountLocaleService accountLocale;
  late final FieldAuthService auth;
  late final FieldDeviceService devices;
  late final FieldWorkflowsService workflows;
  late final FieldBroadcastMediaService broadcastMedia;
  late final FieldOfflineQueue offlineQueue;
  late final FieldEventsService events;
  late final LauncherPolicyService launcherPolicy;
  late final FieldPairingService pairing;

  Future<void> restoreSession() async {
    await auth.restoreApiToken();
  }

  Future<void> dispose() async {
    events.dispose();
    broadcastMedia.dispose();
    accountLocale.dispose();
    api.dispose();
  }
}
