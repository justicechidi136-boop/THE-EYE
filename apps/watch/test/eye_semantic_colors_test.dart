import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_eye_watch/design_system/eye_tokens.dart';
import 'package:the_eye_watch/theme/eye_semantic_colors.dart';
import 'package:the_eye_watch/theme/eye_theme.dart';
import 'package:the_eye_watch/widgets/watch_ui.dart';

void main() {
  group('Watch EyeSemanticColors', () {
    test('watch tokens use orange for interactive text', () {
      const semantics = EyeSemanticColors.watch;
      expect(semantics.interactiveText, EyeTokens.orange);
      expect(semantics.linkText, EyeTokens.orange);
      expect(semantics.success, isNot(equals(semantics.interactiveText)));
    });

    testWidgets('watch theme registers semantic extension', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildEyeWatchTheme(),
          home: const SizedBox.shrink(),
        ),
      );
      final context = tester.element(find.byType(SizedBox));
      expect(
        Theme.of(context).extension<EyeSemanticColors>(),
        EyeSemanticColors.watch,
      );
    });

    testWidgets('watch metric column uses orange interactive value text',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildEyeWatchTheme(),
          home: const Scaffold(
            body: WatchMetricColumn(value: '3', label: 'Alerts'),
          ),
        ),
      );

      final valueText = tester.widget<Text>(find.text('3'));
      expect(valueText.style?.color, EyeTokens.orange);
    });
  });
}
