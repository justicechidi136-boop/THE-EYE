import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';

import '../../api/field_api_client.dart';
import '../../l10n/generated/field_localizations.dart';
import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

class FieldBroadcastItem {
  const FieldBroadcastItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.priority,
    required this.status,
    this.publishedAt,
    this.state,
    this.country,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String priority;
  final String status;
  final DateTime? publishedAt;
  final String? state;
  final String? country;

  factory FieldBroadcastItem.fromJson(Map<String, dynamic> json) {
    return FieldBroadcastItem(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'SafetyAlert',
      title: json['title']?.toString().trim() ?? '',
      body: json['body']?.toString().trim() ?? '',
      priority: json['priority']?.toString() ?? 'P4GeneralSafety',
      status: json['status']?.toString() ?? 'Published',
      publishedAt: DateTime.tryParse(json['publishedAt']?.toString() ?? ''),
      state: _optionalText(json['state']),
      country: _optionalText(json['country']),
    );
  }

  static String? _optionalText(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}

class BroadcastsScreen extends StatefulWidget {
  const BroadcastsScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<BroadcastsScreen> createState() => _BroadcastsScreenState();
}

class _BroadcastsScreenState extends State<BroadcastsScreen> {
  List<FieldBroadcastItem> _items = const [];
  String? _error;
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final rows = await widget.services.workflows.listCountryBroadcasts();
      if (!mounted) return;
      setState(() {
        _items = rows.map(FieldBroadcastItem.fromJson).toList(growable: false);
        _loading = false;
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  void _showDetail(FieldBroadcastItem item) {
    showDialog<void>(
      context: context,
      builder: (context) => _BroadcastDetailDialog(item: item),
    );
  }

  Future<void> _openCreateBroadcast() async {
    final draft = await showDialog<_FieldBroadcastDraft>(
      context: context,
      builder: (context) => const _CreateBroadcastDialog(),
    );
    if (draft == null || !mounted) return;

    setState(() => _submitting = true);
    try {
      final permission = await Geolocator.checkPermission();
      final granted =
          permission == LocationPermission.denied
              ? await Geolocator.requestPermission()
              : permission;
      if (granted == LocationPermission.denied ||
          granted == LocationPermission.deniedForever) {
        throw const _BroadcastSubmissionException(
          'Location permission is required to target this broadcast safely.',
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      await widget.services.restoreSession();
      await widget.services.workflows.createFieldBroadcast({
        'type': draft.type,
        'title': draft.title,
        'body': draft.body,
        'priority': draft.priority,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'radiusMeters': 5000,
        'requiresApproval': true,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Broadcast submitted for authorized review.'),
        ),
      );
    } on FieldApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } on _BroadcastSubmissionException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to submit broadcast. Please try again.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.broadcasts),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _submitting ? null : _openCreateBroadcast,
        icon:
            _submitting
                ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
                : const Icon(Icons.add_alert_outlined),
        label: const Text('Create broadcast'),
      ),
      body:
          _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
              ? _BroadcastError(message: _error!, onRetry: _load)
              : RefreshIndicator(
                onRefresh: _load,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(24, 24, 24, 12),
                      sliver: SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.nationwideBroadcasts,
                              style: Theme.of(context).textTheme.headlineLarge,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              l10n.broadcastFeedEmptyHint,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (_items.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: _BroadcastEmpty(onRefresh: _load),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                        sliver: SliverList.separated(
                          itemCount: _items.length,
                          separatorBuilder:
                              (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final item = _items[index];
                            return _BroadcastTile(
                              item: item,
                              onTap: () => _showDetail(item),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
    );
  }
}

class _FieldBroadcastDraft {
  const _FieldBroadcastDraft({
    required this.type,
    required this.title,
    required this.body,
    required this.priority,
  });

  final String type;
  final String title;
  final String body;
  final String priority;
}

class _BroadcastSubmissionException implements Exception {
  const _BroadcastSubmissionException(this.message);

  final String message;
}

class _CreateBroadcastDialog extends StatefulWidget {
  const _CreateBroadcastDialog();

  @override
  State<_CreateBroadcastDialog> createState() => _CreateBroadcastDialogState();
}

class _CreateBroadcastDialogState extends State<_CreateBroadcastDialog> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  String _type = 'CommunityWarning';
  String _priority = 'P4GeneralSafety';

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(
      _FieldBroadcastDraft(
        type: _type,
        title: _titleController.text.trim(),
        body: _bodyController.text.trim(),
        priority: _priority,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Create safety broadcast'),
      content: SizedBox(
        width: 620,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _type,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: const [
                    DropdownMenuItem(
                      value: 'Emergency',
                      child: Text('Emergency'),
                    ),
                    DropdownMenuItem(value: 'Crime', child: Text('Crime')),
                    DropdownMenuItem(
                      value: 'Accident',
                      child: Text('Accident'),
                    ),
                    DropdownMenuItem(
                      value: 'CommunityWarning',
                      child: Text('Community warning'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _type = value);
                  },
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: _priority,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  items: const [
                    DropdownMenuItem(
                      value: 'P1LifeThreatening',
                      child: Text('P1 - Life threatening'),
                    ),
                    DropdownMenuItem(
                      value: 'P2ActiveCrimeAccident',
                      child: Text('P2 - Active crime or accident'),
                    ),
                    DropdownMenuItem(
                      value: 'P3SuspiciousActivity',
                      child: Text('P3 - Suspicious activity'),
                    ),
                    DropdownMenuItem(
                      value: 'P4GeneralSafety',
                      child: Text('P4 - General safety'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _priority = value);
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _titleController,
                  decoration: const InputDecoration(
                    labelText: 'Broadcast title',
                  ),
                  maxLength: 120,
                  validator: (value) {
                    if ((value ?? '').trim().length < 5) {
                      return 'Enter a title of at least 5 characters.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _bodyController,
                  decoration: const InputDecoration(
                    labelText: 'Safety message',
                    alignLabelWithHint: true,
                  ),
                  minLines: 4,
                  maxLines: 7,
                  maxLength: 1000,
                  validator: (value) {
                    if ((value ?? '').trim().length < 10) {
                      return 'Enter a message of at least 10 characters.';
                    }
                    return null;
                  },
                ),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Your current GPS location and a 5 km safety area will be attached. An authorized administrator must approve the broadcast before publication.',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.send_outlined),
          label: const Text('Submit for review'),
        ),
      ],
    );
  }
}

class _BroadcastTile extends StatelessWidget {
  const _BroadcastTile({required this.item, required this.onTap});

  final FieldBroadcastItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    final date =
        item.publishedAt == null
            ? null
            : DateFormat('d MMM y, HH:mm').format(item.publishedAt!.toLocal());
    final location = [item.state, item.country].whereType<String>().join(', ');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: _priorityColor(
                  item.priority,
                ).withValues(alpha: 0.16),
                foregroundColor: _priorityColor(item.priority),
                child: const Icon(Icons.campaign_outlined),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title.isEmpty ? l10n.broadcasts : item.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (item.body.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        item.body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 12,
                      runSpacing: 6,
                      children: [
                        _Meta(icon: Icons.category_outlined, label: item.type),
                        _Meta(icon: Icons.flag_outlined, label: item.priority),
                        if (location.isNotEmpty)
                          _Meta(icon: Icons.public_outlined, label: location),
                        if (date != null)
                          _Meta(
                            icon: Icons.schedule_outlined,
                            label: '${l10n.published}: $date',
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: FieldColors.muted),
        const SizedBox(width: 5),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _BroadcastDetailDialog extends StatelessWidget {
  const _BroadcastDetailDialog({required this.item});

  final FieldBroadcastItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return AlertDialog(
      title: Text(item.title.isEmpty ? l10n.broadcastDetails : item.title),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.body.isEmpty ? l10n.noDescription : item.body),
              const SizedBox(height: 20),
              Text('${l10n.priority}: ${item.priority}'),
              const SizedBox(height: 6),
              Text('${l10n.status}: ${item.status}'),
              if (item.state != null || item.country != null) ...[
                const SizedBox(height: 6),
                Text([item.state, item.country].whereType<String>().join(', ')),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Close'),
        ),
      ],
    );
  }
}

class _BroadcastEmpty extends StatelessWidget {
  const _BroadcastEmpty({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.campaign_outlined, size: 56),
          const SizedBox(height: 12),
          Text(l10n.noBroadcasts),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh),
            label: Text(l10n.retry),
          ),
        ],
      ),
    );
  }
}

class _BroadcastError extends StatelessWidget {
  const _BroadcastError({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 48),
          const SizedBox(height: 12),
          Text(message),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: Text(l10n.retry),
          ),
        ],
      ),
    );
  }
}

Color _priorityColor(String priority) {
  if (priority.startsWith('P1') || priority.startsWith('P2')) {
    return FieldColors.danger;
  }
  if (priority.startsWith('P3')) return FieldColors.orange;
  return FieldColors.muted;
}
