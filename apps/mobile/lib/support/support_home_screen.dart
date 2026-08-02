import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";
import "../widgets/eye_scaffold.dart";
import "../widgets/section_card.dart";
import "support_models.dart";
import "support_service.dart";

class SupportHomeScreen extends StatelessWidget {
  const SupportHomeScreen({required this.accessToken, super.key});

  final String accessToken;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return EyeScaffold(
      title: "Help & Support",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.warning),
            ),
            child: Text(
              "This support chat does not replace emergency services. "
              "For immediate danger, use Send SOS or Live Emergency Video.",
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colors.warningText,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Quick actions",
            child: Column(
              children: [
                _ActionTile(
                  icon: Icons.sos,
                  label: "Send SOS",
                  onTap: () => Navigator.of(context).pushNamed("/report/emergency"),
                ),
                _ActionTile(
                  icon: Icons.videocam,
                  label: "Start Live Emergency Video",
                  onTap: () => Navigator.of(context).pushNamed("/live-video"),
                ),
                _ActionTile(
                  icon: Icons.report,
                  label: "Report a Crime",
                  onTap: () => Navigator.of(context).pushNamed("/report/crime"),
                ),
                _ActionTile(
                  icon: Icons.emergency,
                  label: "Open Active Emergency",
                  onTap: () => Navigator.of(context).pushNamed("/active-emergency"),
                ),
                _ActionTile(
                  icon: Icons.support_agent,
                  label: "Start Support Chat",
                  onTap: () => Navigator.of(context).pushNamed("/support/new"),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Your support",
            child: Column(
              children: [
                _ActionTile(
                  icon: Icons.chat_bubble_outline,
                  label: "Existing conversations",
                  onTap: () => Navigator.of(context).pushNamed("/support/chats"),
                ),
                _ActionTile(
                  icon: Icons.help_outline,
                  label: "FAQ & self-help",
                  onTap: () => Navigator.of(context).pushNamed("/support/faq"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        minVerticalPadding: 12,
        leading: Icon(icon, size: 28),
        title: Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class SupportFaqScreen extends StatelessWidget {
  const SupportFaqScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return EyeScaffold(
      title: "Support FAQ",
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          _FaqTile(
            question: "Can support chat dispatch emergency services?",
            answer:
                "No. Support chat is for account and technical help. Use SOS or Live Emergency Video for immediate danger.",
          ),
          _FaqTile(
            question: "Is my conversation private?",
            answer:
                "Only you and authorized THE EYE support staff can see your messages. Internal admin notes are never shown to you.",
          ),
          _FaqTile(
            question: "Can I use voice instead of typing?",
            answer: "Yes. You can send voice messages when starting or replying to a support chat.",
          ),
        ],
      ),
    );
  }
}

class _FaqTile extends StatelessWidget {
  const _FaqTile({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        title: Text(question, style: const TextStyle(fontWeight: FontWeight.w600)),
        children: [Padding(padding: const EdgeInsets.all(16), child: Text(answer))],
      ),
    );
  }
}

class SupportChatListScreen extends StatefulWidget {
  const SupportChatListScreen({required this.accessToken, super.key});

  final String accessToken;

  @override
  State<SupportChatListScreen> createState() => _SupportChatListScreenState();
}

class _SupportChatListScreenState extends State<SupportChatListScreen> {
  final _service = SupportService();
  List<SupportConversationSummary> _items = [];
  String? _error;
  bool _loading = true;

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
      final items = await _service.listConversations(accessToken: widget.accessToken);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load support conversations.";
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return EyeScaffold(
      title: "Support chats",
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).pushNamed("/support/new"),
        icon: const Icon(Icons.add),
        label: const Text("New chat"),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _items.isEmpty
                  ? const Center(child: Text("No support conversations yet."))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        itemCount: _items.length,
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          return ListTile(
                            title: Text(item.subject),
                            subtitle: Text(item.lastMessagePreview ?? item.reference),
                            trailing: item.unreadCount > 0
                                ? CircleAvatar(
                                    radius: 12,
                                    child: Text("${item.unreadCount}"),
                                  )
                                : null,
                            onTap: () => Navigator.of(context).pushNamed(
                              "/support/conversation",
                              arguments: SupportConversationRouteArgs(conversationId: item.id),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
