import "package:flutter/material.dart";

import "session_accessor.dart";

class AppScope extends InheritedNotifier<SessionAccessor> {
  const AppScope({
    required SessionAccessor controller,
    required super.child,
    super.key,
  }) : super(notifier: controller);

  static SessionAccessor of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, "AppScope not found");
    return scope!.notifier!;
  }
}
