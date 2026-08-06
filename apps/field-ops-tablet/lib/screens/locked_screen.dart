import 'package:flutter/material.dart';

import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class LockedScreen extends StatefulWidget {
  const LockedScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<LockedScreen> createState() => _LockedScreenState();
}

class _LockedScreenState extends State<LockedScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _unlock() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.auth.unlockSession();
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed(FieldRoutes.home);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signOut() async {
    await widget.services.auth.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(FieldRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lock_outline, size: 80, color: FieldColors.orange),
                const SizedBox(height: 24),
                Text(
                  'Session locked',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 12),
                Text(
                  'Unlock to continue field operations on this tablet.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: const TextStyle(color: FieldColors.danger)),
                ],
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: _busy ? null : _unlock,
                  child: _busy
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Unlock'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _busy ? null : _signOut,
                  child: const Text('Sign out'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
