import "package:flutter/material.dart";

import "../auth/auth_service.dart";
import "../auth/auth_session_store.dart";
import "../auth/auth_validation.dart";
import "../auth/social_auth_service.dart";

typedef RecoverySessionHandler = Future<void> Function(
  AuthSession session, {
  required bool profileComplete,
});

class AccountRecoveryRequestScreen extends StatefulWidget {
  const AccountRecoveryRequestScreen({
    required this.authService,
    super.key,
  });

  final AuthService authService;

  @override
  State<AccountRecoveryRequestScreen> createState() =>
      _AccountRecoveryRequestScreenState();
}

class _AccountRecoveryRequestScreenState
    extends State<AccountRecoveryRequestScreen> {
  final _emailController = TextEditingController();
  bool submitting = false;
  bool sent = false;
  String? errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (!isValidEmail(email)) {
      setState(() =>
          errorMessage = "Enter the email linked to your Google account.");
      return;
    }
    setState(() {
      submitting = true;
      errorMessage = null;
    });
    final result = await widget.authService.requestAccountRecovery(email);
    if (!mounted) return;
    setState(() {
      submitting = false;
      sent = result.isSuccess;
      errorMessage = result.isSuccess ? null : result.userMessage;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Recover account")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            "Recover your Google-linked THE EYE account using your verified email. "
            "We will send recovery instructions and notify your trusted devices.",
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: "Email used with Google Sign-In",
            ),
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(errorMessage!, style: const TextStyle(color: Colors.red)),
          ],
          if (sent) ...[
            const SizedBox(height: 12),
            const Text(
              "If an eligible account exists, recovery instructions have been sent.",
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: submitting ? null : _submit,
            child: submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text("Send recovery instructions"),
          ),
        ],
      ),
    );
  }
}

class AccountRecoveryCompleteScreen extends StatefulWidget {
  const AccountRecoveryCompleteScreen({
    required this.token,
    required this.authService,
    required this.socialAuthService,
    required this.onRecoveryComplete,
    super.key,
  });

  final String token;
  final AuthService authService;
  final SocialAuthService socialAuthService;
  final RecoverySessionHandler onRecoveryComplete;

  @override
  State<AccountRecoveryCompleteScreen> createState() =>
      _AccountRecoveryCompleteScreenState();
}

class _AccountRecoveryCompleteScreenState
    extends State<AccountRecoveryCompleteScreen> {
  bool loading = true;
  bool completing = false;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    _verify();
  }

  Future<void> _verify() async {
    final result = await widget.authService.verifyAccountRecovery(widget.token);
    if (!mounted) return;
    setState(() {
      loading = false;
      if (!result.isSuccess) {
        errorMessage =
            result.userMessage ?? "This recovery link is invalid or expired.";
      }
    });
  }

  Future<void> _completeWithGoogle() async {
    setState(() {
      completing = true;
      errorMessage = null;
    });
    final google = await widget.socialAuthService.obtainGoogleIdToken();
    if (!mounted) return;
    if (!google.isSuccess || google.idToken == null) {
      setState(() {
        completing = false;
        errorMessage =
            google.userMessage ?? "Google sign-in was not completed.";
      });
      return;
    }
    final result = await widget.authService.completeAccountRecovery(
      token: widget.token,
      idToken: google.idToken!,
      provider: "google.com",
    );
    if (!mounted) return;
    if (!result.isSuccess || result.session == null) {
      setState(() {
        completing = false;
        errorMessage = result.userMessage ?? "Recovery could not be completed.";
      });
      return;
    }
    await widget.onRecoveryComplete(
      result.session!,
      profileComplete: result.profileComplete,
    );
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil("/home", (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text("Complete recovery")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            "Confirm your identity with Google to restore access to your THE EYE account.",
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(errorMessage!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: completing ? null : _completeWithGoogle,
            child: completing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text("Continue with Google"),
          ),
        ],
      ),
    );
  }
}
