import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

const _maxReason = 500;
const _minReason = 10;

/// M06g: Society Officers, SPCs and DDMs propose a grade with a reason. The
/// grade stays as it is until HQ approves.
class GradeChangeRequestScreen extends StatefulWidget {
  const GradeChangeRequestScreen({super.key, required this.record});

  final SocietyRecord record;

  @override
  State<GradeChangeRequestScreen> createState() =>
      _GradeChangeRequestScreenState();
}

class _GradeChangeRequestScreenState extends State<GradeChangeRequestScreen> {
  String? _grade;
  final _reason = TextEditingController();
  bool _submitted = false;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  String? get _gradeError =>
      _grade == null ? 'Choose the grade you propose.' : null;

  String? get _reasonError => _reason.text.trim().length < _minReason
      ? 'Explain the reason in at least $_minReason characters.'
      : null;

  Future<void> _send() async {
    setState(() {
      _submitted = true;
      _error = null;
    });
    if (_gradeError != null || _reasonError != null) return;
    setState(() => _sending = true);
    try {
      await DemoScope.read(context).societyRecords.requestGradeChange(
        widget.record.id,
        toGrade: _grade!,
        reason: _reason.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Request sent to HQ. You will get a notification with HQ's decision.",
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = '${error.message} Your reason is still here.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final record = widget.record;
    final current = record.grade;
    return Scaffold(
      appBar: recordFormAppBar(context, title: 'Request a grade change'),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          Container(
            color: const Color(0xFFE4EFE5),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
            child: Row(
              children: [
                const Icon(
                  Icons.shield_outlined,
                  size: 13,
                  color: AppColors.pine,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${record.nameEn} · ${record.societyCode}',
                    style: const TextStyle(
                      color: AppColors.pine,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const FieldLabel('Current grade'),
                ReadOnlyField(
                  current == null
                      ? 'Not set'
                      : '$current · ${gradeLabels[current]}',
                ),
                const SizedBox(height: 14),
                const FieldLabel('Requested grade', required: true),
                Row(
                  children: [
                    for (final grade in const ['A', 'B', 'C']) ...[
                      Expanded(
                        child: _GradeOption(
                          grade: grade,
                          isCurrent: grade == current,
                          selected: grade == _grade,
                          onTap: grade == current
                              ? null
                              : () => setState(() => _grade = grade),
                        ),
                      ),
                      if (grade != 'C') const SizedBox(width: 8),
                    ],
                  ],
                ),
                if (_submitted && _gradeError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      _gradeError!,
                      style: RecordStyle.caption.copyWith(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                const SizedBox(height: 14),
                const FieldLabel(
                  'Why should the grade change?',
                  required: true,
                ),
                TextField(
                  controller: _reason,
                  maxLines: 5,
                  minLines: 3,
                  maxLength: _maxReason,
                  style: recordInputStyle,
                  decoration: changedDecoration(
                    changed: false,
                    error: _submitted ? _reasonError : null,
                  ),
                  buildCounter: (
                    _, {
                    required currentLength,
                    required isFocused,
                    maxLength,
                  }) => null,
                ),
                const SizedBox(height: 5),
                Text(
                  'HQ reads this before deciding. ${_reason.text.length} of $_maxReason characters.',
                  style: RecordStyle.caption,
                ),
                const SizedBox(height: 12),
                RecordNote(
                  icon: Icons.info_outline,
                  tone: NoteTone.warning,
                  title: 'HQ approval needed',
                  message:
                      "The grade stays ${current ?? 'as it is'} until HQ approves. You will get a notification with HQ's decision.",
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  RecordNote(
                    icon: Icons.error_outline,
                    tone: NoteTone.error,
                    title: 'Not sent',
                    message: _error!,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: () => Navigator.of(context).maybePop(),
          child: const Text('Cancel'),
        ),
        primary: FilledButton(
          onPressed: _sending ? null : _send,
          child: Text(_sending ? 'Sending…' : 'Send to HQ'),
        ),
      ),
    );
  }
}

class _GradeOption extends StatelessWidget {
  const _GradeOption({
    required this.grade,
    required this.isCurrent,
    required this.selected,
    required this.onTap,
  });

  final String grade;
  final bool isCurrent;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    enabled: onTap != null,
    label:
        'Grade $grade, ${gradeLabels[grade]}${isCurrent ? ', current grade' : ''}',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Opacity(
        opacity: isCurrent ? 0.45 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          decoration: BoxDecoration(
            color: selected ? AppColors.mintSoft : AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? AppColors.forest : AppColors.line,
              width: selected ? 2 : 1,
            ),
          ),
          child: ExcludeSemantics(
            child: Column(
              children: [
                GradeBadge(grade),
                const SizedBox(height: 6),
                Text(
                  isCurrent ? 'Current' : gradeLabels[grade]!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
