import "package:permission_handler/permission_handler.dart";

import "evidence_permission_state.dart";

typedef PermissionRequester = Future<PermissionStatus> Function(
    Permission permission);
typedef PermissionChecker = Future<PermissionStatus> Function(
    Permission permission);

class EvidencePermissionService {
  EvidencePermissionService({
    PermissionRequester? requestPermission,
    PermissionChecker? checkPermission,
  })  : _requestPermission =
            requestPermission ?? ((permission) => permission.request()),
        _checkPermission =
            checkPermission ?? ((permission) => permission.status);

  final PermissionRequester _requestPermission;
  final PermissionChecker _checkPermission;
  final Set<Permission> _requested = {};

  Future<EvidencePermissionState> cameraState() =>
      _mapPermission(Permission.camera);
  Future<EvidencePermissionState> microphoneState() =>
      _mapPermission(Permission.microphone);
  Future<EvidencePermissionState> photosState() =>
      _mapPermission(Permission.photos);

  Future<EvidencePermissionState> requestCamera() =>
      _requestAndMap(Permission.camera);
  Future<EvidencePermissionState> requestMicrophone() =>
      _requestAndMap(Permission.microphone);
  Future<EvidencePermissionState> requestPhotos() =>
      _requestAndMap(Permission.photos);

  Future<bool> openDeviceSettings() => openAppSettings();

  Future<EvidencePermissionState> _requestAndMap(Permission permission) async {
    _requested.add(permission);
    final status = await _requestPermission(permission);
    return _statusToState(status, permission);
  }

  Future<EvidencePermissionState> _mapPermission(Permission permission) async {
    final status = await _checkPermission(permission);
    return _statusToState(status, permission);
  }

  EvidencePermissionState _statusToState(
      PermissionStatus status, Permission permission) {
    if (status.isGranted || status.isLimited)
      return EvidencePermissionState.granted;
    if (status.isRestricted) return EvidencePermissionState.restricted;
    if (status.isPermanentlyDenied)
      return EvidencePermissionState.permanentlyDenied;
    if (status.isDenied) {
      return _requested.contains(permission)
          ? EvidencePermissionState.denied
          : EvidencePermissionState.notRequested;
    }
    return EvidencePermissionState.denied;
  }
}
