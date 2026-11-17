import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../motion/app_motion.dart';
import '../society_record/record_widgets.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'release_info.dart';

/// Issue #161: the installed release's notes, after an update (once) and
/// from More → What's New. Built from the app's own cards, notes, styles and
/// motion; the notes are plain text, never markup.
class WhatsNewScreen extends StatelessWidget {
  const WhatsNewScreen({
    super.key,
    required this.release,
    this.afterUpdate = false,
  });

  /// Null when this build has no release notes (local and iOS builds).
  final ReleaseInfo? release;

  /// Shown by itself after an update, rather than opened from More.
  final bool afterUpdate;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final release = this.release;
    void close() => Navigator.of(context).pop();
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !afterUpdate,
        title: Text(l.whatsNewTitle),
      ),
      body: release == null
          ? StateMessage(
              icon: Icons.update,
              title: l.whatsNewUnavailableTitle,
              message: l.whatsNewUnavailable,
              primaryLabel: l.commonClose,
              onPrimary: close,
            )
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    key: const ValueKey('whatsNew.list'),
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                    children: motionBlocks('whatsNew', [
                      _Header(release: release, afterUpdate: afterUpdate),
                      const SizedBox(height: 12),
                      _Notes(release: release),
                      if (Localizations.localeOf(context).languageCode !=
                          release.language) ...[
                        const SizedBox(height: 12),
                        // The notes are typed once, in English. Say so
                        // rather than presenting them as translated.
                        RecordNote(
                          key: const ValueKey('whatsNew.englishOnly'),
                          icon: Icons.translate,
                          message: l.whatsNewEnglishOnly,
                        ),
                      ],
                    ]),
                  ),
                ),
                // Outside the scrolling list, so long notes or large text
                // never push Continue off the screen.
                DecoratedBox(
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    border: Border(top: BorderSide(color: AppColors.line)),
                  ),
                  child: SafeArea(
                    top: false,
                    minimum: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    child: SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        key: const ValueKey('whatsNew.continue'),
                        onPressed: close,
                        child: Text(l.commonContinue),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.release, required this.afterUpdate});

  final ReleaseInfo release;
  final bool afterUpdate;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return RecordCard(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: AppColors.navIndicator,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.update,
                color: AppColors.forest,
                size: 21,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.whatsNewVersion(
                      release.versionName,
                      '${release.versionCode}',
                    ),
                    key: const ValueKey('whatsNew.version'),
                    style: RecordStyle.screenTitle,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    afterUpdate ? l.whatsNewUpdated : l.whatsNewInstalled,
                    style: RecordStyle.body.copyWith(color: AppColors.inkBody),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Notes extends StatelessWidget {
  const _Notes({required this.release});

  final ReleaseInfo release;

  @override
  Widget build(BuildContext context) => RecordCard(
    key: const ValueKey('whatsNew.notes'),
    title: context.l10n.whatsNewChanges,
    children: [
      for (final (index, line) in release.lines.indexed) ...[
        if (index > 0) const SizedBox(height: 8),
        // Each line is its own stop for a screen reader, so long notes can
        // be read and navigated line by line.
        Semantics(
          container: true,
          child: line.bullet
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // As tall as the first line at any text size, so the
                    // dot stays level with it.
                    ExcludeSemantics(
                      child: SizedBox(
                        width: 16,
                        height:
                            MediaQuery.textScalerOf(context)
                                .scale(_noteStyle.fontSize!) *
                            _noteStyle.height!,
                        child: const Align(
                          alignment: Alignment.centerLeft,
                          child: Icon(
                            Icons.circle,
                            size: 6,
                            color: AppColors.leaf,
                          ),
                        ),
                      ),
                    ),
                    Expanded(child: Text(line.text, style: _noteStyle)),
                  ],
                )
              : Text(line.text, style: _noteStyle),
        ),
      ],
    ],
  );

  static final _noteStyle = RecordStyle.body.copyWith(fontSize: 13.5);
}

/// Shows What's New over the home screen once after an update, at the first
/// safe point: after sign-in, once the destination has been built, and
/// before any work has started there. Continue (or Back) returns to that
/// same destination and records the acknowledgement.
class WhatsNewGate extends StatefulWidget {
  const WhatsNewGate({super.key, required this.child});

  final Widget child;

  @override
  State<WhatsNewGate> createState() => _WhatsNewGateState();
}

class _WhatsNewGateState extends State<WhatsNewGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _showIfPending());
  }

  Future<void> _showIfPending() async {
    if (!mounted) return;
    final whatsNew = DemoScope.read(context).whatsNew;
    final release = whatsNew.release;
    if (!whatsNew.pending || whatsNew.showing || release == null) return;
    whatsNew.showing = true;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => WhatsNewScreen(release: release, afterUpdate: true),
      ),
    );
    whatsNew.acknowledge();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
