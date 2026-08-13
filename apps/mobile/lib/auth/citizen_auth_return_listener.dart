import "dart:async";

import "package:app_links/app_links.dart";
import "package:flutter/foundation.dart";
import "package:flutter/widgets.dart";

import "citizen_auth_return_link.dart";

typedef CitizenAuthReturnHandler = void Function(String message);

/// Shared navigation for cold / background / foreground AUTH-007 returns.
@visibleForTesting
void navigateCitizenAuthReturn({
  required NavigatorState nav,
  required String message,
  required bool isAuthenticated,
}) {
  if (isAuthenticated) {
    nav.pushNamedAndRemoveUntil("/home", (_) => false);
    return;
  }
  nav.pushNamedAndRemoveUntil(
    CitizenAuthReturnLink.signInRoute,
    (_) => false,
    arguments: {"authReturnMessage": message},
  );
}

/// Listens for AUTH-007 custom-scheme returns and routes to citizen /login.
class CitizenAuthReturnListener {
  CitizenAuthReturnListener({
    AppLinks? appLinks,
    required this.onReturnToSignIn,
  }) : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;
  final CitizenAuthReturnHandler onReturnToSignIn;
  StreamSubscription<Uri>? _sub;
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        handleUri(initial);
      }
    } catch (_) {
      // Invalid initial link — ignore safely.
    }
    _sub = _appLinks.uriLinkStream.listen(handleUri, onError: (_) {});
  }

  @visibleForTesting
  void handleUri(Uri uri) {
    if (CitizenAuthReturnLink.isForbiddenAdminDestination(uri)) {
      return;
    }
    final message = CitizenAuthReturnLink.resolveSignInMessage(uri);
    if (message == null) return;
    onReturnToSignIn(message);
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
    _started = false;
  }
}

/// Widget wrapper that starts the listener once under [navigatorKey].
class CitizenAuthReturnHost extends StatefulWidget {
  const CitizenAuthReturnHost({
    super.key,
    required this.navigatorKey,
    required this.child,
    this.isAuthenticated,
    this.enableListener = true,
  });

  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;
  final bool Function()? isAuthenticated;
  final bool enableListener;

  @override
  State<CitizenAuthReturnHost> createState() => _CitizenAuthReturnHostState();
}

class _CitizenAuthReturnHostState extends State<CitizenAuthReturnHost> {
  CitizenAuthReturnListener? _listener;
  String? _pendingMessage;

  @override
  void initState() {
    super.initState();
    if (widget.enableListener) {
      _listener = CitizenAuthReturnListener(onReturnToSignIn: _onReturn);
      unawaited(_listener!.start());
    }
  }

  void _onReturn(String message) {
    final nav = widget.navigatorKey.currentState;
    if (nav == null) {
      _pendingMessage = message;
      return;
    }
    navigateCitizenAuthReturn(
      nav: nav,
      message: message,
      isAuthenticated: widget.isAuthenticated?.call() == true,
    );
  }

  @override
  void dispose() {
    final listener = _listener;
    if (listener != null) {
      unawaited(listener.dispose());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_pendingMessage != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final message = _pendingMessage;
        if (message == null) return;
        final nav = widget.navigatorKey.currentState;
        if (nav == null) return;
        _pendingMessage = null;
        navigateCitizenAuthReturn(
          nav: nav,
          message: message,
          isAuthenticated: widget.isAuthenticated?.call() == true,
        );
      });
    }
    return widget.child;
  }
}
