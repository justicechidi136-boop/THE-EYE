import "dart:async";

import "package:app_links/app_links.dart";
import "package:flutter/widgets.dart";

import "citizen_auth_return_link.dart";

typedef CitizenAuthReturnHandler = void Function(String message);
typedef BroadcastLinkHandler = void Function(String route);

@visibleForTesting
String? broadcastRouteForPublicUri(Uri uri) {
  const allowedHosts = {
    "staging-dashboard8jps.theeye.com.ng",
    "dashboard.theeye.com.ng",
    "localhost",
  };
  if (uri.scheme != "https" && uri.scheme != "http") return null;
  if (!allowedHosts.contains(uri.host.toLowerCase())) return null;
  if (uri.pathSegments.length != 3 ||
      uri.pathSegments[0] != "share" ||
      uri.pathSegments[1] != "broadcasts") {
    return null;
  }
  final id = uri.pathSegments[2].trim();
  return id.isEmpty ? null : "/broadcasts/$id";
}

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
    this.onBroadcastLink,
    this.expectedScheme,
  }) : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;
  final CitizenAuthReturnHandler onReturnToSignIn;
  final BroadcastLinkHandler? onBroadcastLink;
  final String? expectedScheme;
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
    final broadcastRoute = broadcastRouteForPublicUri(uri);
    if (broadcastRoute != null) {
      onBroadcastLink?.call(broadcastRoute);
      return;
    }
    if (CitizenAuthReturnLink.isForbiddenAdminDestination(uri)) {
      return;
    }
    final message = CitizenAuthReturnLink.resolveSignInMessage(
      uri,
      expectedScheme: expectedScheme,
    );
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
      _listener = CitizenAuthReturnListener(
        onReturnToSignIn: _onReturn,
        onBroadcastLink: _onBroadcastLink,
      );
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

  void _onBroadcastLink(String route) {
    final nav = widget.navigatorKey.currentState;
    if (nav == null) return;
    nav.pushNamed(route);
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
