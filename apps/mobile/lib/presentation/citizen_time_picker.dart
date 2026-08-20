import "package:flutter/material.dart";

import "citizen_date_time.dart";

/// Citizen Last Seen / sighting time picker: 12-hour AM/PM, hardened input mode.
Future<TimeOfDay?> showCitizenTimePicker(
  BuildContext context, {
  required TimeOfDay initialTime,
}) {
  return showTimePicker(
    context: context,
    initialTime: initialTime,
    initialEntryMode: TimePickerEntryMode.dialOnly,
    builder: (context, child) {
      if (child == null) return const SizedBox.shrink();
      final media = MediaQuery.of(context);
      return MediaQuery(
        data: media.copyWith(alwaysUse24HourFormat: false),
        child: Theme(
          data: Theme.of(context).copyWith(
            // Avoid non-normalized height constraints in keyboard entry mode
            // (FUNC-020) by keeping dialog material defaults for the picker.
            materialTapTargetSize: MaterialTapTargetSize.padded,
            timePickerTheme: TimePickerTheme.of(context).copyWith(
              hourMinuteTextStyle: Theme.of(context).textTheme.headlineMedium,
              dayPeriodTextStyle: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          child: child,
        ),
      );
    },
  );
}

/// Display TimeOfDay as `5:35 PM` regardless of device 24h setting.
String formatCitizenTimeOfDay(TimeOfDay time) {
  final now = DateTime.now();
  final dt = DateTime(now.year, now.month, now.day, time.hour, time.minute);
  return CitizenDateTimeFormatter.formatTime(dt);
}
