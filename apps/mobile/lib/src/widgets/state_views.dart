import 'package:flutter/material.dart';

import '../format.dart';
import '../l10n/l10n.dart';
import '../theme/app_theme.dart';

/// Grey placeholder rows shown while a screen loads. Announced once to screen readers.
class LoadingSkeleton extends StatelessWidget {
  const LoadingSkeleton({super.key, this.cards = 3, this.label});

  final int cards;

  /// What is loading. Defaults to "Loading" in the chosen language.
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${label ?? context.l10n.stateLoading}…',
      liveRegion: true,
      child: ExcludeSemantics(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          physics: const NeverScrollableScrollPhysics(),
          itemCount: cards,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) => Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _bar(width: 140, height: 14),
                  const SizedBox(height: 14),
                  for (var line = 0; line < 3; line++) ...[
                    Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: const BoxDecoration(
                            color: Color(0xFFE6E9E3),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _bar(width: 180, height: 10),
                              const SizedBox(height: 6),
                              _bar(width: 110, height: 8),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _bar({required double width, required double height}) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: const Color(0xFFE6E9E3),
      borderRadius: BorderRadius.circular(6),
    ),
  );
}

/// Centred icon, title, message and actions. Used for empty, error, offline and success states.
class StateMessage extends StatelessWidget {
  const StateMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.primaryLabel,
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    this.tone = StateTone.neutral,
    this.isAlert = false,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final StateTone tone;

  /// Announces the message immediately, for errors.
  final bool isAlert;

  @override
  Widget build(BuildContext context) {
    final (foreground, background) = switch (tone) {
      StateTone.neutral => (AppColors.forest, AppColors.navIndicator),
      StateTone.error => (AppColors.danger, AppColors.dangerSoft),
      StateTone.offline => (AppColors.inkSoft, AppColors.stateGrey),
      StateTone.success => (AppColors.forest, AppColors.navIndicator),
      StateTone.noAccess => (AppColors.inkSoft, AppColors.stateGrey),
    };
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Semantics(
          liveRegion: isAlert,
          container: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: background,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: foreground, size: 24),
              ),
              const SizedBox(height: 14),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.inkBody,
                  fontSize: 12.5,
                  height: 1.4,
                ),
              ),
              if (primaryLabel != null) ...[
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: onPrimary,
                  style: _compact,
                  child: Text(primaryLabel!),
                ),
              ],
              if (secondaryLabel != null) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: onSecondary,
                  style: _compact,
                  child: Text(secondaryLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

final _compact = ButtonStyle(
  minimumSize: const WidgetStatePropertyAll(Size(48, 40)),
  padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16)),
  textStyle: const WidgetStatePropertyAll(
    TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
  ),
  shape: WidgetStatePropertyAll(
    RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
  ),
);

enum StateTone { neutral, error, offline, success, noAccess }

/// V5 M26 No access. It never names the society, incident or person that was
/// refused, so a stale link or notification reveals nothing. The API refuses
/// the data as well; this is only what the user sees.
class NoAccessView extends StatelessWidget {
  const NoAccessView({
    super.key,
    this.title,
    this.message,
    this.backLabel,
    this.onBack,
  });

  /// The defaults, in the chosen language, never name what was refused.
  final String? title;
  final String? message;
  final String? backLabel;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return StateMessage(
      icon: Icons.lock_outline,
      title: title ?? l.stateNoAccessTitle,
      message: message ?? l.stateNoAccessMessage,
      tone: StateTone.noAccess,
      primaryLabel: onBack == null ? null : backLabel ?? l.stateNoAccessBack,
      onPrimary: onBack,
    );
  }
}

/// What the viewer may do here, for example "Your access: 12 assigned
/// societies · view and edit" or a temporary district-wide view (V5 SP01,
/// DD02, DM03). It only describes access; the API decides each request.
enum AccessBannerTone { edit, viewOnly, temporary, incident }

class AccessBanner extends StatelessWidget {
  const AccessBanner({super.key, required this.tone, required this.child});

  final AccessBannerTone tone;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final (background, border, foreground, icon) = switch (tone) {
      AccessBannerTone.edit => (
        AppColors.bannerEditBg,
        AppColors.bannerEditLine,
        AppColors.bannerEditText,
        Icons.shield_outlined,
      ),
      AccessBannerTone.viewOnly => (
        AppColors.bannerViewBg,
        AppColors.bannerViewLine,
        AppColors.bannerViewText,
        Icons.lock_outline,
      ),
      AccessBannerTone.temporary => (
        AppColors.bannerTemporaryBg,
        AppColors.bannerTemporaryLine,
        AppColors.bannerTemporaryText,
        Icons.schedule,
      ),
      AccessBannerTone.incident => (
        AppColors.bannerIncidentBg,
        AppColors.bannerIncidentLine,
        AppColors.bannerIncidentText,
        Icons.warning_amber_rounded,
      ),
    };
    return Semantics(
      container: true,
      liveRegion: tone == AccessBannerTone.incident,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: background,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: foreground),
            const SizedBox(width: 8),
            Expanded(
              child: DefaultTextStyle.merge(
                style: TextStyle(color: foreground, fontSize: 12, height: 1.35),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dark strip shown at the top of a screen while the demo is offline.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, this.message});

  /// Defaults to "your draft is saved" in the chosen language.
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        color: AppColors.forest,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.wifi_off, size: 16, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message ?? context.l10n.stateOfflineDraft,
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Inline notice with an icon, used for info, warnings, locked records and errors.
class NoticeBanner extends StatelessWidget {
  const NoticeBanner({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.tone = NoticeTone.info,
    this.action,
  });

  NoticeBanner.locked({
    Key? key,
    required String reviewer,
    required DateTime since,
  }) : this(
         key: key,
         icon: Icons.lock_outline,
         title: 'Locked During Review',
         message:
             '$reviewer started reviewing on ${formatDateTime(since)}. You can view it but not edit it.',
         tone: NoticeTone.warning,
       );

  final IconData icon;
  final String title;
  final String? message;
  final NoticeTone tone;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final (foreground, background) = switch (tone) {
      NoticeTone.info => (const Color(0xFF2D5C88), const Color(0xFFE9F1FA)),
      NoticeTone.warning => (AppColors.warning, AppColors.warningSoft),
      NoticeTone.error => (AppColors.danger, AppColors.dangerSoft),
      NoticeTone.success => (AppColors.leaf, AppColors.mint),
    };
    return Semantics(
      container: true,
      liveRegion: tone == NoticeTone.error,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: foreground.withValues(alpha: 0.3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: foreground, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: foreground,
                    ),
                  ),
                  if (message != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      message!,
                      style: const TextStyle(
                        color: AppColors.inkSoft,
                        height: 1.35,
                      ),
                    ),
                  ],
                  if (action != null) ...[const SizedBox(height: 8), action!],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum NoticeTone { info, warning, error, success }

/// Buttons pinned to the bottom of a form or step, above the system navigation area.
class BottomActionBar extends StatelessWidget {
  const BottomActionBar({super.key, required this.primary, this.secondary});

  final Widget primary;
  final Widget? secondary;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      child: SafeArea(
        top: false,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              if (secondary != null) ...[
                Expanded(child: secondary!),
                const SizedBox(width: 12),
              ],
              Expanded(flex: secondary == null ? 1 : 2, child: primary),
            ],
          ),
        ),
      ),
    );
  }
}
