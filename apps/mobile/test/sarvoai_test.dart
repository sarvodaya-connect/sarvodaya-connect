import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/sarvoai/sarvoai_api.dart';
import 'package:sarvodaya_connect_mobile/src/sarvoai/sarvoai_screen.dart';
import 'package:sarvodaya_connect_mobile/src/screens/more_screen.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';

import 'test_helpers.dart';

/// Records what was asked and answers with [reply].
class _FakeApi implements SarvoAiApi {
  _FakeApi(this.reply);

  Future<SarvoAiAnswer> Function(String question) reply;
  final asked = <(String, List<({String role, String text})>)>[];

  @override
  Future<SarvoAiAnswer> ask(
    String question, {
    List<({String role, String text})> history = const [],
  }) {
    asked.add((question, history));
    return reply(question);
  }
}

Future<DemoStore> _pump(
  WidgetTester tester,
  Widget home, {
  UserRole role = UserRole.hqAdmin,
  SarvoAiApi? api,
  Size size = const Size(390, 1600),
}) async {
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final store = DemoStore(
    loadDelay: Duration.zero,
    clock: () => demoNow,
    sarvoAiApi: api,
  )..switchDemoRole(role);
  await tester.pumpWidget(
    DemoScope(
      store: store,
      child: MaterialApp(theme: AppTheme.light(), home: home),
    ),
  );
  await tester.pumpAndSettle();
  return store;
}

Future<void> _ask(WidgetTester tester, String question) async {
  await tester.enterText(find.byType(TextField), question);
  await tester.tap(find.byTooltip('Ask'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('M80 shows what SarvoAI uses and the example questions', (
    tester,
  ) async {
    await _pump(tester, const SarvoAiScreen());
    expect(find.text('Collective Wisdom. Intelligent Impact.'), findsOneWidget);
    expect(find.text('TRY ASKING'), findsOneWidget);
    expect(
      find.textContaining('never share capital, savings, loans'),
      findsOneWidget,
    );
  });

  testWidgets(
    'M81–M84 shows a small spinner, then the answer with its sources',
    (tester) async {
      final pending = Completer<SarvoAiAnswer>();
      final api = _FakeApi((_) => pending.future);
      await _pump(tester, const SarvoAiScreen(), api: api);
      await tester.enterText(
        find.byType(TextField),
        'Average profit in Kurunegala?',
      );
      await tester.tap(find.byTooltip('Ask'));
      await tester.pump();

      expect(find.text('Working on it…'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      expect(find.text('Stop'), findsOneWidget);

      pending.complete(demoSarvoAiAnswer('average profit in Kurunegala'));
      await tester.pumpAndSettle();
      expect(find.textContaining('LKR 298,400 per society'), findsOneWidget);
      expect(find.text('88 societies included'), findsOneWidget);
      expect(find.text('10 excluded · figures not added'), findsOneWidget);
      expect(find.text('612,400'), findsOneWidget);
      expect(find.text('Sample data'), findsOneWidget);

      await tester.tap(find.text('View details'));
      await tester.pumpAndSettle();
      expect(find.text('How was this answered?'), findsOneWidget);
      expect(
        find.textContaining('Annual summary · total profit'),
        findsOneWidget,
      );
      expect(find.textContaining('not counted as zero'), findsOneWidget);
      expect(find.textContaining('LKR 26,259,200 ÷ 88'), findsOneWidget);
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();
    },
  );

  testWidgets('M85 sends the earlier answer with a follow-up', (tester) async {
    final api = _FakeApi(
      (question) async =>
          demoSarvoAiAnswer(question, earlier: 'average profit'),
    );
    await _pump(tester, const SarvoAiScreen(), api: api);
    await _ask(tester, 'What was the average profit in Kurunegala?');
    await _ask(tester, 'Which of these had the highest profit?');
    expect(find.textContaining('had the highest total profit'), findsOneWidget);
    expect(api.asked.last.$2.map((turn) => turn.role), ['user', 'assistant']);
    expect(
      api.asked.last.$2.first.text,
      'What was the average profit in Kurunegala?',
    );
  });

  testWidgets('M86 asks which meaning, and a choice asks again', (
    tester,
  ) async {
    final api = _FakeApi((question) async => demoSarvoAiAnswer(question));
    await _pump(tester, const SarvoAiScreen(), api: api);
    await _ask(
      tester,
      'Which societies had more than LKR 100,000 profit in the last five years?',
    );
    expect(find.textContaining('Which do you mean?'), findsOneWidget);
    await tester.tap(
      find.text('More than LKR 100,000 combined over the five years'),
    );
    await tester.pumpAndSettle();
    expect(
      api.asked.last.$1,
      'More than LKR 100,000 combined over the five years',
    );
  });

  for (final (question, title) in [
    ('Mannar above LKR 1,000,000?', 'No societies match'),
    ('Average in Mullaitivu?', 'Only 6 of 17 societies have added figures'),
    ('Which are the best societies?', 'What do you mean by “best”?'),
    ('Total share capital in Kurunegala?', 'SarvoAI can’t answer this'),
  ]) {
    testWidgets('M87–M89 shows “$title”', (tester) async {
      await _pump(
        tester,
        const SarvoAiScreen(),
        api: _FakeApi((q) async => demoSarvoAiAnswer(q)),
      );
      await _ask(tester, question);
      expect(find.textContaining(title.split('.').first), findsOneWidget);
    });
  }

  testWidgets('M89 keeps the question and tries again after an error', (
    tester,
  ) async {
    var calls = 0;
    final api = _FakeApi((question) async {
      calls++;
      if (calls == 1) {
        throw const SarvoAiException(
          'SarvoAI isn’t available right now.',
          status: 503,
        );
      }
      return demoSarvoAiAnswer('Who is the president of Pahala Kosgama SSS?');
    });
    await _pump(tester, const SarvoAiScreen(), api: api);
    await _ask(tester, 'Who is the president of Pahala Kosgama SSS?');
    expect(find.text('SarvoAI isn’t available right now'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.textContaining('is A. Jayasekara'), findsOneWidget);
    expect(calls, 2);
  });

  testWidgets('stops waiting and lets HQ ask again', (tester) async {
    await _pump(
      tester,
      const SarvoAiScreen(),
      api: _FakeApi((_) => Completer<SarvoAiAnswer>().future),
    );
    await tester.enterText(find.byType(TextField), 'Average profit?');
    await tester.tap(find.byTooltip('Ask'));
    await tester.pump();
    await tester.tap(find.text('Stop'));
    await tester.pump();
    expect(
      find.text('Stopped. Nothing from this question is shown.'),
      findsOneWidget,
    );
    expect(find.byType(TextField), findsOneWidget);
  });

  for (final role in [
    UserRole.societyOfficer,
    UserRole.programmeCoordinator,
    UserRole.deputyDistrictManager,
    UserRole.districtManager,
  ]) {
    testWidgets('M89f tells ${role.name} that SarvoAI is for HQ only', (
      tester,
    ) async {
      await _pump(tester, const SarvoAiScreen(), role: role);
      expect(find.text('SarvoAI is for HQ only'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    test(
      'the demonstration API refuses ${role.name} like the server',
      () async {
        final store = DemoStore(loadDelay: Duration.zero)..switchDemoRole(role);
        await expectLater(
          store.sarvoAi.ask('Average profit?'),
          throwsA(
            isA<SarvoAiException>().having((e) => e.status, 'status', 403),
          ),
        );
      },
    );
  }

  testWidgets('a refusal from the API also shows the no-access screen', (
    tester,
  ) async {
    await _pump(
      tester,
      const SarvoAiScreen(),
      api: _FakeApi(
        (_) async =>
            throw const SarvoAiException('SarvoAI is for HQ only', status: 403),
      ),
    );
    await _ask(tester, 'Average profit?');
    expect(find.text('SarvoAI is for HQ only'), findsOneWidget);
  });

  testWidgets('M17 offers Ask SarvoAI to HQ only', (tester) async {
    await _pump(tester, const MoreScreen());
    expect(find.text('Ask SarvoAI'), findsOneWidget);
    await tester.tap(find.text('Ask SarvoAI'));
    await tester.pumpAndSettle();
    expect(find.text('TRY ASKING'), findsOneWidget);
  });

  testWidgets('M17 has no SarvoAI for a DM', (tester) async {
    await _pump(tester, const MoreScreen(), role: UserRole.districtManager);
    expect(find.text('Ask SarvoAI'), findsNothing);
    expect(find.text('Help and HQ contact'), findsOneWidget);
    expect(find.text('Back to the sign-in screen'), findsOneWidget);
  });

  testWidgets('the answer lays out without overflow on a small phone', (
    tester,
  ) async {
    await _pump(
      tester,
      const SarvoAiScreen(),
      api: _FakeApi((q) async => demoSarvoAiAnswer(q)),
      size: const Size(320, 568),
    );
    await _ask(tester, 'Average profit in Kurunegala?');
    expect(tester.takeException(), isNull);
  });
}
