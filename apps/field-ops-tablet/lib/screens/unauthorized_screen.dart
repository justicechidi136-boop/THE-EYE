import 'package:flutter/material.dart';

import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class UnauthorizedScreen extends StatelessWidget {
  const UnauthorizedScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  Widget build(BuildContext context) {
    final message =
        ModalRoute.of(context)?.settings.arguments as String? ??
            'This tablet is not authorized for field operations.';

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.block, size: 80, color: FieldColors.danger),
                const SizedBox(height: 24),
                Text(
                  'Unauthorized',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: () => Navigator.of(context)
                      .pushReplacementNamed(FieldRoutes.deviceStatus),
                  child: const Text('View device status'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () async {
                    await services.auth.logout();
                    if (!context.mounted) return;
                    Navigator.of(context)
                        .pushReplacementNamed(FieldRoutes.deviceRegistration);
                  },
                  child: const Text('Re-register device'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
