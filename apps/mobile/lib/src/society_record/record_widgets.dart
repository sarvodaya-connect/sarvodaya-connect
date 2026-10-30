import 'package:flutter/material.dart';

import '../format.dart';
import '../models/user.dart';
import '../theme/app_theme.dart';
import 'society_record_models.dart';

/// Shared pieces of the SC-65 society record screens (Prototype v4, M06–M13).
/// The prototype uses a compact phone scale: 13 pt titles, 12 pt body text
/// and 10–11 pt labels. These styles keep every SC-65 screen on that scale
/// without changing the app-wide theme.

abstract final class RecordStyle {
  static const screenTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );
  static const screenSubtitle = TextStyle(
    fontSize: 11,
    color: AppColors.muted,
    fontWeight: FontWeight.w400,
  );
  static const cardTitle = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );
  static const body = TextStyle(
    fontSize: 12,
    color: AppColors.ink,
    height: 1.4,
  );
  static const label = TextStyle(fontSize: 10.5, color: AppColors.muted);
  static const value = TextStyle(
    fontSize: 12.5,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );
  static const caption = TextStyle(
    fontSize: 10.5,
    color: AppColors.muted,
    height: 1.4,
  );
  static const sectionLabel = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w800,
    color: AppColors.muted,
    letterSpacing: 0.9,
  );
  static const link = TextStyle(
    fontSize: 11.5,
    fontWeight: FontWeight.w700,
    color: AppColors.leaf,
  );
}

/// Small pill buttons used inside cards and in the app bar.
final compactFilledStyle = FilledButton.styleFrom(
  minimumSize: const Size(0, 36),
  padding: const EdgeInsets.symmetric(horizontal: 12),
  tapTargetSize: MaterialTapTargetSize.padded,
  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
);

final compactOutlinedStyle = OutlinedButton.styleFrom(
  minimumSize: const Size(0, 36),
  padding: const EdgeInsets.symmetric(horizontal: 12),
  foregroundColor: AppColors.ink,
  side: const BorderSide(color: Color(0xFFCCD4CC)),
  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
);

final compactTextStyle = TextButton.styleFrom(
  minimumSize: const Size(0, 30),
  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  visualDensity: VisualDensity.compact,
  padding: const EdgeInsets.symmetric(horizontal: 6),
  foregroundColor: AppColors.leaf,
  textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
);

/// 1286000.5 → "1,286,000.5"
String formatAmount(double value) {
  final negative = value < 0;
  final fixed = value.abs().toStringAsFixed(2);
  final whole = fixed.split('.').first;
  var cents = fixed.split('.').last;
  final grouped = whole.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => ',',
  );
  cents = cents.replaceFirst(RegExp(r'0+$'), '');
  return '${negative ? '-' : ''}$grouped${cents.isEmpty ? '' : '.$cents'}';
}

String formatLkr(double value) => 'LKR ${formatAmount(value)}';

/// "6:00 p.m.", as the prototype writes times.
String formatClock(DateTime when) {
  final hour = when.hour % 12 == 0 ? 12 : when.hour % 12;
  return '$hour:${when.minute.toString().padLeft(2, '0')} ${when.hour < 12 ? 'a.m.' : 'p.m.'}';
}

String _dayMonth(DateTime when) {
  final date = formatDate(when);
  return date.substring(0, date.length - 5);
}

/// "today 10:02", "22 Oct" or "12 Mar 2025".
String formatWhen(DateTime when, DateTime now) {
  final sameDay =
      when.year == now.year && when.month == now.month && when.day == now.day;
  if (sameDay) {
    return 'today ${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}';
  }
  return when.year == now.year ? _dayMonth(when) : formatDate(when);
}

/// "31 Oct, 6:00 p.m."
String formatEnds(DateTime when) => '${_dayMonth(when)}, ${formatClock(when)}';

const gradeColors = {
  'A': Color(0xFF2E7D4F),
  'B': Color(0xFFD9A21B),
  'C': Color(0xFFE07B2F),
};

class GradeBadge extends StatelessWidget {
  const GradeBadge(this.grade, {super.key, this.size = 26});

  final String? grade;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    label: grade == null ? 'Grade not set' : 'Grade $grade',
    child: Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: gradeColors[grade] ?? const Color(0xFFE6E9E3),
        borderRadius: BorderRadius.circular(6),
      ),
      child: ExcludeSemantics(
        child: Text(
          grade ?? '–',
          style: TextStyle(
            color: grade == null ? AppColors.muted : Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: size * 0.48,
          ),
        ),
      ),
    ),
  );
}

/// White card with the prototype's 12 px radius and hairline border.
class RecordCard extends StatelessWidget {
  const RecordCard({
    super.key,
    required this.children,
    this.title,
    this.trailing,
    this.padding = const EdgeInsets.all(14),
    this.color = AppColors.surface,
    this.borderColor = AppColors.line,
  });

  final List<Widget> children;
  final String? title;
  final Widget? trailing;
  final EdgeInsets padding;
  final Color color;
  final Color borderColor;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: borderColor),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(title!, style: RecordStyle.cardTitle),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 10),
        ],
        ...children,
      ],
    ),
  );
}

/// "🔒 Set by HQ" style note at the right of a card title.
class LockedNote extends StatelessWidget {
  const LockedNote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      const Icon(Icons.lock_outline, size: 12, color: AppColors.muted),
      const SizedBox(width: 3),
      Text(text, style: RecordStyle.caption),
    ],
  );
}

/// Small label above a bold value, used in the two-column record grids.
class KeyValue extends StatelessWidget {
  const KeyValue(
    this.label,
    this.value, {
    super.key,
    this.trailing,
    this.missing = false,
  });

  final String label;
  final String value;
  final Widget? trailing;
  final bool missing;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: RecordStyle.label),
      const SizedBox(height: 2),
      Row(
        children: [
          Flexible(
            child: Text(
              value,
              style: missing
                  ? RecordStyle.value.copyWith(
                      color: AppColors.muted,
                      fontWeight: FontWeight.w500,
                    )
                  : RecordStyle.value,
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 4), trailing!],
        ],
      ),
    ],
  );
}

/// Two cells per row, as in the prototype's detail cards.
class KeyValueGrid extends StatelessWidget {
  const KeyValueGrid(this.cells, {super.key});

  final List<Widget> cells;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var row = 0; row < cells.length; row += 2)
        Padding(
          padding: EdgeInsets.only(bottom: row + 2 < cells.length ? 12 : 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: cells[row]),
              const SizedBox(width: 12),
              Expanded(
                child: row + 1 < cells.length
                    ? cells[row + 1]
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
    ],
  );
}

enum NoteTone { info, warning, success, error }

/// Tinted note with an icon, as in the prototype's coloured boxes.
class RecordNote extends StatelessWidget {
  const RecordNote({
    super.key,
    required this.icon,
    required this.message,
    this.title,
    this.tone = NoteTone.info,
    this.dashed = false,
  });

  final IconData icon;
  final String? title;
  final String message;
  final NoteTone tone;

  /// "To confirm" notes in the prototype use a dashed amber border.
  final bool dashed;

  @override
  Widget build(BuildContext context) {
    final (foreground, background, border) = switch (tone) {
      NoteTone.info => (
        const Color(0xFF2D5C88),
        const Color(0xFFE9F1FA),
        const Color(0xFFC8D9EA),
      ),
      NoteTone.warning => (
        AppColors.warning,
        const Color(0xFFFFF8E1),
        const Color(0xFFEFD98F),
      ),
      NoteTone.success => (
        AppColors.pine,
        const Color(0xFFEAF4EB),
        const Color(0xFFC6E2CD),
      ),
      NoteTone.error => (
        AppColors.danger,
        AppColors.dangerSoft,
        const Color(0xFFEFC4BD),
      ),
    };
    return Semantics(
      container: true,
      liveRegion: tone == NoteTone.error,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(10),
          border: dashed ? null : Border.all(color: border),
        ),
        foregroundDecoration: dashed
            ? _DashedBorder(color: border, radius: 10)
            : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(icon, size: 14, color: foreground),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(
                      title!,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: foreground,
                      ),
                    ),
                  Text(
                    message,
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.4,
                      color: title == null ? foreground : AppColors.inkSoft,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashedBorder extends Decoration {
  const _DashedBorder({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  BoxPainter createBoxPainter([VoidCallback? onChanged]) =>
      _DashedPainter(color, radius);
}

class _DashedPainter extends BoxPainter {
  _DashedPainter(this.color, this.radius);

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Offset offset, ImageConfiguration configuration) {
    final size = configuration.size!;
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          (offset & size).deflate(0.5),
          Radius.circular(radius),
        ),
      );
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final metric in path.computeMetrics()) {
      for (var distance = 0.0; distance < metric.length; distance += 7) {
        canvas.drawPath(metric.extractPath(distance, distance + 4), paint);
      }
    }
  }
}

/// Green strip saying what the user may do with this society, or a blue one
/// for view-only access (M06v).
class ScopeBanner extends StatelessWidget {
  const ScopeBanner({super.key, required this.record, required this.user});

  final SocietyRecord record;
  final AuthenticatedUser user;

  @override
  Widget build(BuildContext context) {
    final permissions = record.permissions;
    if (permissions.viewOnlyReason == ViewOnlyReason.temporaryDistrictAccess) {
      return _strip(
        icon: Icons.schedule,
        bold: 'Temporary district-wide view',
        text: permissions.viewOnlyUntil == null
            ? ''
            : ' · ends ${formatEnds(permissions.viewOnlyUntil!)}',
        foreground: const Color(0xFF1F4E7A),
        background: const Color(0xFFE3EDF8),
      );
    }
    if (!permissions.canEdit) {
      return _strip(
        icon: Icons.lock_outline,
        text: permissions.viewOnlyReason == ViewOnlyReason.districtManager
            ? 'District Manager · ${record.districtName} · view only'
            : 'View only',
        foreground: const Color(0xFF1F4E7A),
        background: const Color(0xFFE3EDF8),
      );
    }
    final text = switch (user.primaryRole) {
      UserRole.societyOfficer =>
        'Your access: this society only · view and edit',
      UserRole.programmeCoordinator =>
        'SPC · your ${user.societyIds.length} assigned societies · view and edit',
      UserRole.deputyDistrictManager =>
        'DDM · your ${user.societyIds.length} assigned societies · view and edit',
      _ => 'HQ · national access · view and edit',
    };
    return _strip(
      icon: Icons.shield_outlined,
      text: text,
      foreground: AppColors.pine,
      background: const Color(0xFFE4EFE5),
    );
  }

  Widget _strip({
    required IconData icon,
    required String text,
    required Color foreground,
    required Color background,
    String? bold,
  }) => Container(
    width: double.infinity,
    color: background,
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
    child: Row(
      children: [
        Icon(icon, size: 13, color: foreground),
        const SizedBox(width: 6),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                if (bold != null)
                  TextSpan(
                    text: bold,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                TextSpan(text: text),
              ],
            ),
            style: TextStyle(
              color: foreground,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

enum ChipTone { success, warning, danger, info, neutral }

/// Small status pill such as "● Uploaded" or "● Waiting for HQ".
class RecordChip extends StatelessWidget {
  const RecordChip(
    this.label, {
    super.key,
    this.tone = ChipTone.neutral,
    this.icon,
  });

  final String label;
  final ChipTone tone;

  /// Shown instead of the dot, e.g. a lock for "View only".
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (foreground, background) = switch (tone) {
      ChipTone.success => (AppColors.leaf, const Color(0xFFE4F1E6)),
      ChipTone.warning => (const Color(0xFF8A6400), const Color(0xFFFFF1C7)),
      ChipTone.danger => (AppColors.danger, const Color(0xFFFBE4E1)),
      ChipTone.info => (const Color(0xFF2D5C88), const Color(0xFFE3EDF8)),
      ChipTone.neutral => (AppColors.inkSoft, const Color(0xFFEDEFEA)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: icon == null
          ? Text(
              '● $label',
              style: TextStyle(
                color: foreground,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 11, color: foreground),
                const SizedBox(width: 3),
                Text(
                  label,
                  style: TextStyle(
                    color: foreground,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
    );
  }
}

/// Field label with the red required mark used on every V4 form.
class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.required = false});

  final String text;
  final bool required;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 5),
    child: Text.rich(
      TextSpan(
        text: text,
        children: [
          if (required)
            const TextSpan(
              text: ' *',
              style: TextStyle(color: AppColors.danger),
            ),
        ],
      ),
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 11.5,
        color: AppColors.ink,
      ),
    ),
  );
}

/// Compact input text used by the SC-65 forms.
const recordInputStyle = TextStyle(fontSize: 13, color: AppColors.ink);

/// Decoration that marks a changed value in yellow, as in M06e and M06f.
InputDecoration changedDecoration({
  required bool changed,
  String? helper,
  String? error,
  Widget? suffix,
}) => InputDecoration(
  isDense: true,
  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
  helperText: helper,
  helperMaxLines: 2,
  helperStyle: RecordStyle.caption,
  errorText: error,
  errorMaxLines: 3,
  errorStyle: const TextStyle(
    fontSize: 10.5,
    fontWeight: FontWeight.w600,
    color: AppColors.danger,
  ),
  suffixIcon: suffix,
  fillColor: error != null
      ? const Color(0xFFFFF7F6)
      : changed
      ? const Color(0xFFFFFBEA)
      : null,
  enabledBorder: changed && error == null
      ? OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE5C96B)),
        )
      : null,
);

/// Pill in the app bar while a form has unsaved edits.
class UnsavedChip extends StatelessWidget {
  const UnsavedChip({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.only(right: 12),
    child: Center(child: RecordChip('Unsaved changes', tone: ChipTone.warning)),
  );
}

/// Grey read-only field with "🔒 Read only", as for the S number and grade.
class ReadOnlyField extends StatelessWidget {
  const ReadOnlyField(this.value, {super.key});

  final String value;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    decoration: BoxDecoration(
      color: const Color(0xFFEEF0EB),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: AppColors.line),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13, color: AppColors.inkSoft),
          ),
        ),
        const SizedBox(width: 4),
        const LockedNote('Read only'),
      ],
    ),
  );
}

/// Header used by the full-screen SC-65 forms: a close button, a title and
/// an optional subtitle.
PreferredSizeWidget recordFormAppBar(
  BuildContext context, {
  required String title,
  String? subtitle,
  List<Widget> actions = const [],
  VoidCallback? onClose,
}) => AppBar(
  toolbarHeight: 58,
  leading: IconButton(
    tooltip: 'Close',
    icon: const Icon(Icons.close, size: 22),
    onPressed: onClose ?? () => Navigator.of(context).maybePop(),
  ),
  titleSpacing: 0,
  title: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: RecordStyle.screenTitle),
      if (subtitle != null)
        Text(
          subtitle,
          style: RecordStyle.screenSubtitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
    ],
  ),
  actions: actions,
  shape: const Border(bottom: BorderSide(color: AppColors.line)),
);

/// One entry in a vertical timeline (M06h, M06q): a ring, a connecting line,
/// a bold title, a detail line and an optional quoted comment.
class RecordTimelineEntry extends StatelessWidget {
  const RecordTimelineEntry({
    super.key,
    required this.title,
    required this.detail,
    this.quote,
    this.ringColor = AppColors.forest,
    this.last = false,
  });

  final String title;
  final String detail;
  final String? quote;
  final Color ringColor;
  final bool last;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 18,
          child: Column(
            children: [
              Container(
                width: 11,
                height: 11,
                margin: const EdgeInsets.only(top: 2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: ringColor, width: 1.6),
                ),
              ),
              if (!last)
                Expanded(
                  child: Container(width: 1.2, color: const Color(0xFFD5DCD4)),
                ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 2 : 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: RecordStyle.value),
                if (detail.isNotEmpty) Text(detail, style: RecordStyle.caption),
                if (quote != null && quote!.isNotEmpty)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(top: 5),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF2F3EF),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '“$quote”',
                      style: const TextStyle(
                        fontSize: 11,
                        height: 1.4,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
