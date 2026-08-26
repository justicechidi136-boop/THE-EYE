import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/location/location_permission_settings_section.dart";
import "package:the_eye_mobile/location/location_types.dart";

void main() {
  test("retry requests permission for recoverable states", () {
    for (final state in <LocationPermissionState?>[
      null,
      LocationPermissionState.notRequested,
      LocationPermissionState.denied,
      LocationPermissionState.timedOut,
      LocationPermissionState.error,
    ]) {
      expect(
        locationPermissionRecoveryAction(state),
        LocationPermissionRecoveryAction.requestPermission,
      );
    }
  });

  test("blocked permission opens Android app settings", () {
    expect(
      locationPermissionRecoveryAction(
        LocationPermissionState.deniedPermanently,
      ),
      LocationPermissionRecoveryAction.openAppSettings,
    );
    expect(
      locationPermissionRecoveryAction(LocationPermissionState.restricted),
      LocationPermissionRecoveryAction.openAppSettings,
    );
  });

  test("disabled location service opens device location settings", () {
    expect(
      locationPermissionRecoveryAction(LocationPermissionState.serviceDisabled),
      LocationPermissionRecoveryAction.openLocationSettings,
    );
  });
}
