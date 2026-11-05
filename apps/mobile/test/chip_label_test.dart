import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

/// Issue #98: chip labels were invisible on unselected chips, because the
/// theme's label style had no colour. These read what a chip really renders.
Color _labelColour(WidgetTester tester, String label) {
  final colour = tester
      .widget<RichText>(
        find.descendant(
          of: find.byType(RawChip),
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is RichText && widget.text.toPlainText() == label,
          ),
        ),
      )
      .text
      .style
      ?.color;
  expect(colour, isNotNull, reason: '"$label" has no colour');
  return colour!;
}

Color _chipFill(WidgetTester tester, String label) {
  final ink = tester.widget<Ink>(
    find.descendant(
      of: find.ancestor(of: find.text(label), matching: find.byType(RawChip)),
      matching: find.byType(Ink),
    ),
  );
  return ((ink.decoration! as ShapeDecoration).color)!;
}

double _contrast(Color a, Color b) {
  final (la, lb) = (a.computeLuminance(), b.computeLuminance());
  return (la > lb ? la + 0.05 : lb + 0.05) / (la > lb ? lb + 0.05 : la + 0.05);
}

void _expectReadable(WidgetTester tester, String label) => expect(
  _contrast(_labelColour(tester, label), _chipFill(tester, label)),
  greaterThanOrEqualTo(4.5),
  reason: '"$label" is too faint on its chip',
);

Future<void> _pump(WidgetTester tester, List<Widget> chips) =>
    tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(body: Wrap(children: chips)),
      ),
    );

void main() {
  const platforms = TargetPlatformVariant({
    TargetPlatform.iOS,
    TargetPlatform.android,
  });

  testWidgets('labels are readable when unselected', (tester) async {
    await _pump(tester, [
      ActionChip(label: const Text('Action'), onPressed: () {}),
      const Chip(label: Text('Plain')),
      FilterChip(
        label: const Text('Filter'),
        selected: false,
        onSelected: (_) {},
      ),
      ChoiceChip(
        label: const Text('Choice'),
        selected: false,
        onSelected: (_) {},
      ),
      InputChip(label: const Text('Input'), onPressed: () {}),
    ]);
    for (final label in ['Action', 'Plain', 'Filter', 'Choice', 'Input']) {
      _expectReadable(tester, label);
    }
  }, variant: platforms);

  testWidgets('labels are readable when selected', (tester) async {
    await _pump(tester, [
      FilterChip(
        label: const Text('Filter'),
        selected: true,
        onSelected: (_) {},
      ),
      ChoiceChip(
        label: const Text('Choice'),
        selected: true,
        onSelected: (_) {},
      ),
      InputChip(label: const Text('Input'), selected: true, onPressed: () {}),
    ]);
    for (final label in ['Filter', 'Choice', 'Input']) {
      _expectReadable(tester, label);
    }
  }, variant: platforms);

  testWidgets('labels are readable when disabled, and stay disabled', (
    tester,
  ) async {
    await _pump(tester, [
      const ActionChip(label: Text('Action')),
      const FilterChip(
        label: Text('Filter'),
        selected: false,
        onSelected: null,
      ),
      const FilterChip(
        label: Text('Filter on'),
        selected: true,
        onSelected: null,
      ),
      const ChoiceChip(
        label: Text('Choice on'),
        selected: true,
        onSelected: null,
      ),
    ]);
    for (final label in ['Action', 'Filter', 'Filter on', 'Choice on']) {
      _expectReadable(tester, label);
      expect(
        tester
            .widget<RawChip>(
              find.ancestor(
                of: find.text(label),
                matching: find.byType(RawChip),
              ),
            )
            .isEnabled,
        isFalse,
      );
    }
  }, variant: platforms);

  testWidgets('labels are readable when focused', (tester) async {
    final focus = FocusNode();
    addTearDown(focus.dispose);
    await _pump(tester, [
      FilterChip(
        label: const Text('Filter'),
        selected: false,
        focusNode: focus,
        onSelected: (_) {},
      ),
    ]);
    focus.requestFocus();
    await tester.pumpAndSettle();
    expect(focus.hasFocus, isTrue);
    _expectReadable(tester, 'Filter');
  }, variant: platforms);

  testWidgets('the tick on a selected chip shows on its dark fill', (
    tester,
  ) async {
    await _pump(tester, [
      FilterChip(label: const Text('On'), selected: true, onSelected: (_) {}),
    ]);
    expect(
      Theme.of(tester.element(find.text('On'))).chipTheme.checkmarkColor,
      Colors.white,
    );
  });

  testWidgets('a chip can still set its own label colour', (tester) async {
    await _pump(tester, [
      FilterChip(
        label: const Text('Custom'),
        labelStyle: const TextStyle(color: AppColors.danger),
        selected: false,
        onSelected: (_) {},
      ),
    ]);
    expect(_labelColour(tester, 'Custom'), AppColors.danger);
  });
}
