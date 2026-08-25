import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/services/field_device_context_service.dart';

void main() {
  test('formats a concise human-readable location without duplicates', () {
    expect(
      FieldDeviceContextService.formatLocation(
        street: 'Allen Avenue',
        subLocality: 'Ikeja',
        locality: 'Ikeja',
        administrativeArea: 'Lagos',
        country: 'Nigeria',
      ),
      'Allen Avenue, Ikeja, Lagos',
    );
  });

  test('returns null when no readable location fields are available', () {
    expect(FieldDeviceContextService.formatLocation(), isNull);
  });
}
