import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../motion/app_motion.dart';
import '../society_record/record_widgets.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'release_notes.dart';

/// Issue #161: the installed release's notes, after an update (once) and from
/// More → What's new (any time). Built from the app's own cards, type and
/// bottom action bar.
class WhatsNewScreen extends StatelessWidget {
  const WhatsNewScreen({
    super.key,
    required this.release,
    this.afterUpdate = false,
  });

  /// Null when this build has no release notes.
  final ReleaseInfo? release;

  /// Shown on its own after an update: no back arrow, only Continue.
  final bool afterUpdate;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final installed = release;
    // The notes are written once, in English, for Google Play as well.
    final englishOnly = Localizations.localeOf(context).languageCode != 'en';
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !afterUpdate,
        title: Text(l.whatsNewTitle),
      ),
      body: installed == null
          ? StateMessage(
              icon: Icons.update,
              title: l.whatsNewNoneTitle,
              message: l.whatsNewNoneBody,
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                MotionEntrance(
                  id: 'whatsNew.${installed.id}',
                  child: RecordCard(
                    children: [
                      if (afterUpdate) ...[
                        Text(l.whatsNewUpdated, style: RecordStyle.cardTitle),
                        const SizedBox(height: 2),
                      ],
                      Text(
                        l.whatsNewVersion(
                          installed.version,
                          '${installed.build}',
                        ),
                        style: RecordStyle.caption,
                      ),
                      const SizedBox(height: 14),
                      Semantics(
                        header: true,
                        child: Text(
                          l.whatsNewChanges,
                          style: RecordStyle.cardTitle,
                        ),
                      ),
                      const SizedBox(height: 6),
                      // Plain text as written in the release workflow: line
                      // breaks are kept and nothing is read as markup.
                      Text(
                        installed.notes,
                        locale: const Locale('en'),
                        style: RecordStyle.body.copyWith(height: 1.45),
                      ),
                      if (englishOnly) ...[
                        const SizedBox(height: 12),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.translate,
                              size: 16,
                              color: AppColors.muted,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                l.whatsNewEnglishOnly,
                                style: RecordStyle.caption,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: BottomActionBar(
        primary: MotionPress(
          child: FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l.whatsNewContinue),
          ),
        ),
      ),
    );
  }
}

/// Shows What's new once, over the screen just reached after sign-in, then
/// returns there. It waits for the first frame, so sign-in and start-up are
/// never interrupted, and any way of leaving it (Continue or back) counts as
/// seen.
class WhatsNewGate extends StatefulWidget {
  const WhatsNewGate({
    super.key,
    required this.pending,
    required this.release,
    required this.onSeen,
    required this.child,
  });

  final bool pending;
  final ReleaseInfo? release;
  final VoidCallback onSeen;
  final Widget child;

  @override
  State<WhatsNewGate> createState() => _WhatsNewGateState();
}

class _WhatsNewGateState extends State<WhatsNewGate> {
  bool _opened = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
  }

  @override
  void didUpdateWidget(WhatsNewGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pending && !oldWidget.pending) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
    }
  }

  Future<void> _maybeShow() async {
    if (!mounted || _opened || !widget.pending || widget.release == null) {
      return;
    }
    _opened = true;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) =>
            WhatsNewScreen(release: widget.release, afterUpdate: true),
      ),
    );
    widget.onSeen();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
