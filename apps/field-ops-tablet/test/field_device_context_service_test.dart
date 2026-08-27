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

  test('prefers a street name and rejects a plus code', () {
    expect(
      FieldDeviceContextService.formatLocation(
        name: 'VX96+Q39',
        street: 'VX96+Q39',
        thoroughfare: 'Stadium Road',
        subLocality: 'Rumuola',
        locality: 'Port Harcourt',
        administrativeArea: 'Rivers',
      ),
      'Stadium Road, Rumuola, Port Harcourt, Rivers',
    );
  });

  test('shows measured GPS accuracy without claiming a fixed accuracy', () {
    expect(
      FieldDeviceContextService.withMeasuredAccuracy('Stadium Road', 7.6),
      'Stadium Road · GPS accuracy: 8 m',
    );
  });
}
