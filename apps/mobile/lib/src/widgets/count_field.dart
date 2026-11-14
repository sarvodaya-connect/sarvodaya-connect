import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../theme/app_theme.dart';

/// The whole number a person typed, or null when it is not a count from 0 to
/// [max]. Commas and spaces between digits are allowed ("1,000"); anything
/// else (a minus sign, a decimal point, letters) is not, and nothing is
/// silently dropped or clamped.
int? parseCount(String text, {required int max}) {
  final compact = text.trim().replaceAll(RegExp(r'[\s,]'), '');
  if (!RegExp(r'^\d+$').hasMatch(compact)) return null;
  final value = int.tryParse(compact);
  return value == null || value > max ? null : value;
}

/// Issue #132: a count with − and + buttons and a number that can be typed
/// straight in, so 100 people need no 100 taps.
///
/// [onChanged] gets every valid value at once (typed or from a button), and
/// null while the box holds something that is not a valid count, including
/// while it is empty. The parent keeps the last valid value and blocks Next
/// while any count is null. Leaving the box empty never resets it to zero.
class CountField extends StatefulWidget {
  const CountField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    required this.max,
    this.decreaseTooltip,
    this.increaseTooltip,
    this.compact = false,
  });

  final String label;
  final int value;
  final ValueChanged<int?> onChanged;
  final int max;

  /// Kept from the screens' existing wording ("Fewer: Injured").
  final String? decreaseTooltip;
  final String? increaseTooltip;

  /// The smaller buttons used in the rapid assessment.
  final bool compact;

  @override
  State<CountField> createState() => _CountFieldState();
}

class _CountFieldState extends State<CountField> {
  late final _controller = TextEditingController(text: '${widget.value}');
  late final _focus = FocusNode();
  bool _invalid = false;

  @override
  void initState() {
    super.initState();
    // Selecting everything on focus makes it easy to replace the number.
    _focus.addListener(() {
      if (_focus.hasFocus) {
        _controller.selection = TextSelection(
          baseOffset: 0,
          extentOffset: _controller.text.length,
        );
      }
    });
  }

  @override
  void didUpdateWidget(CountField old) {
    super.didUpdateWidget(old);
    // A new value from outside (a button, or the parent) replaces the text,
    // unless the text already says that number.
    if (widget.value != parseCount(_controller.text, max: widget.max) &&
        !(_invalid && widget.value == old.value)) {
      _controller.text = '${widget.value}';
      _invalid = false;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _typed(String text) {
    final value = parseCount(text, max: widget.max);
    setState(() => _invalid = value == null);
    widget.onChanged(value);
  }

  void _step(int delta) {
    final next = widget.value + delta;
    if (next < 0 || next > widget.max) return;
    _controller.text = '$next';
    setState(() => _invalid = false);
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final current = _invalid ? null : widget.value;
    final buttonSize = widget.compact ? 18.0 : 24.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              visualDensity: widget.compact ? VisualDensity.compact : null,
              tooltip: widget.decreaseTooltip ?? l.countFewer(widget.label),
              onPressed: current != null && current > 0
                  ? () => _step(-1)
                  : null,
              icon: Icon(
                widget.compact ? Icons.remove : Icons.remove_circle_outline,
                size: buttonSize,
              ),
            ),
            Flexible(
              child: ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 52, maxWidth: 76),
                child: TextField(
                  controller: _controller,
                  focusNode: _focus,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  textInputAction: TextInputAction.done,
                  onChanged: _typed,
                  onTapOutside: (_) => _focus.unfocus(),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 10,
                    ),
                    // The label is read out by screen readers; the row shows it already.
                    labelText: widget.label,
                    floatingLabelBehavior: FloatingLabelBehavior.never,
                    labelStyle: const TextStyle(fontSize: 0),
                    errorText: _invalid ? '' : null,
                    errorStyle: const TextStyle(fontSize: 0, height: 0),
                    border: const OutlineInputBorder(),
                  ),
                ),
              ),
            ),
            IconButton(
              visualDensity: widget.compact ? VisualDensity.compact : null,
              tooltip: widget.increaseTooltip ?? l.countMore(widget.label),
              onPressed: current != null && current < widget.max
                  ? () => _step(1)
                  : null,
              icon: Icon(
                widget.compact ? Icons.add : Icons.add_circle_outline,
                size: buttonSize,
              ),
            ),
          ],
        ),
        if (_invalid)
          ConstrainedBox(
            // As wide as the controls, so a long message wraps under them.
            constraints: const BoxConstraints(maxWidth: 176),
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                l.countInvalid(l.number(widget.max)),
                textAlign: TextAlign.end,
                style: const TextStyle(fontSize: 11.5, color: AppColors.danger),
              ),
            ),
          ),
      ],
    );
  }
}
