import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/auth/auth_service.dart';
import 'package:sarvodaya_connect_mobile/src/models/app_language.dart';
import 'package:sarvodaya_connect_mobile/src/motion/app_motion.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

class _WaitingAuth implements AuthService {
  final response = Completer<AuthSession?>();
  int calls = 0;
  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) {
    calls++;
    return response.future;
  }
}

Widget host(Widget child, {bool reduced = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduced),
    child: MotionScope(child: Scaffold(body: child)),
  ),
);

double opacity(WidgetTester tester) => tester
    .widget<Opacity>(
      find
          .descendant(
            of: find.byType(MotionEntrance).first,
            matching: find.byType(Opacity),
          )
          .first,
    )
    .opacity;

void main() {
  testWidgets(
    'entrance completes once; rebuild, keyboard and refresh do not replay',
    (tester) async {
      late StateSetter update;
      bool content = true;
      await tester.pumpWidget(
        host(
          StatefulBuilder(
            builder: (context, set) {
              update = set;
              return content
                  ? const MotionEntrance(id: 'home', child: TextField())
                  : const Text('Loading');
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(opacity(tester), 1);
      await tester.enterText(find.byType(TextField), 'kept');
      update(() {});
      await tester.pump();
      expect(opacity(tester), 1);
      expect(find.text('kept'), findsOneWidget);
      // Replacing a loading subtree must not reanimate an already seen section.
      update(() => content = false);
      await tester.pump();
      update(() => content = true);
      await tester.pump();
      expect(opacity(tester), 1);
    },
  );

  testWidgets(
    'reduced motion is visible immediately, including delayed blocks',
    (tester) async {
      await tester.pumpWidget(
        host(
          const MotionEntrance(id: 'reduced', order: 4, child: Text('Ready')),
          reduced: true,
        ),
      );
      expect(opacity(tester), 1);
      expect(tester.hasRunningAnimations, isFalse);
    },
  );

  testWidgets('turning reduced motion on finishes an active entrance', (
    tester,
  ) async {
    late StateSetter update;
    bool reduced = false;
    await tester.pumpWidget(
      MaterialApp(
        home: StatefulBuilder(
          builder: (context, set) {
            update = set;
            return MediaQuery(
              data: MediaQueryData(disableAnimations: reduced),
              child: const MotionScope(
                child: MotionEntrance(id: 'live', child: Text('Ready')),
              ),
            );
          },
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 40));
    expect(opacity(tester), lessThan(1));
    update(() => reduced = true);
    await tester.pump();
    expect(opacity(tester), 1);
    update(() => reduced = false);
    await tester.pump();
    expect(opacity(tester), 1);
  });

  testWidgets(
    'hidden retained tab waits, then plays once on first activation',
    (tester) async {
      late StateSetter update;
      bool visible = false;
      await tester.pumpWidget(
        host(
          StatefulBuilder(
            builder: (context, set) {
              update = set;
              return TickerMode(
                enabled: visible,
                child: const MotionEntrance(id: 'tab', child: Text('Tab')),
              );
            },
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      expect(opacity(tester), 0);
      update(() => visible = true);
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(opacity(tester), greaterThan(0));
      expect(opacity(tester), lessThan(1));
      await tester.pumpAndSettle();
      update(() => visible = false);
      await tester.pump();
      update(() => visible = true);
      await tester.pump();
      expect(opacity(tester), 1);
    },
  );

  testWidgets('new session scope allows a new entrance', (tester) async {
    Widget session(String account) => MaterialApp(
      home: MotionScope(
        key: ValueKey(account),
        child: const MotionEntrance(id: 'home', child: Text('Home')),
      ),
    );
    await tester.pumpWidget(session('a'));
    await tester.pumpAndSettle();
    expect(opacity(tester), 1);
    await tester.pumpWidget(session('b'));
    expect(opacity(tester), 0);
    await tester.pumpAndSettle();
  });

  testWidgets('press feedback preserves one tap callback and reduced motion', (
    tester,
  ) async {
    int taps = 0;
    await tester.pumpWidget(
      host(
        MotionPress(
          child: FilledButton(onPressed: () => taps++, child: const Text('Go')),
        ),
        reduced: true,
      ),
    );
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Go')),
    );
    await tester.pump();
    expect(tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale, 1);
    await gesture.up();
    await tester.pumpAndSettle();
    expect(taps, 1);
  });

  testWidgets('content size transitions use shared timing and settle cleanly', (
    tester,
  ) async {
    late StateSetter update;
    double height = 120;
    await tester.pumpWidget(
      host(
        StatefulBuilder(
          builder: (context, set) {
            update = set;
            return MotionSize(
              child: SizedBox(height: height, child: const Text('Details')),
            );
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      tester.widget<AnimatedSize>(find.byType(AnimatedSize)).duration,
      AppMotion.state,
    );

    update(() => height = 40);
    await tester.pump();
    expect(tester.hasRunningAnimations, isTrue);
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('content size changes are immediate with reduced motion', (
    tester,
  ) async {
    late StateSetter update;
    double height = 120;
    await tester.pumpWidget(
      host(
        StatefulBuilder(
          builder: (context, set) {
            update = set;
            return MotionSize(
              child: SizedBox(height: height, child: const Text('Details')),
            );
          },
        ),
        reduced: true,
      ),
    );
    update(() => height = 40);
    await tester.pump();
    expect(find.byType(AnimatedSize), findsNothing);
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets(
    'sign-in retains typed values and ignores repeated keyboard submits',
    (tester) async {
      final auth = _WaitingAuth();
      final store = DemoStore(
        authService: auth,
        showSplash: false,
        loadDelay: Duration.zero,
      )..chooseLanguage(AppLanguage.english);
      await tester.pumpWidget(SarvodayaConnectApp(store: store));
      await tester.pumpAndSettle();
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'officer');
      await tester.enterText(fields.at(1), 'password');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump(const Duration(milliseconds: 1));
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump(const Duration(milliseconds: 1));
      expect(auth.calls, 1);
      expect(find.text('officer'), findsOneWidget);
      auth.response.complete(null);
      await tester.pumpAndSettle();
      expect(find.text('officer'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('native iOS back gesture is retained', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          platform: TargetPlatform.iOS,
          pageTransitionsTheme: const PageTransitionsTheme(
            builders: {
              TargetPlatform.iOS: AccessiblePageTransitions(
                CupertinoPageTransitionsBuilder(),
              ),
            },
          ),
        ),
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const Scaffold(body: Text('Details')),
              ),
            ),
            child: const Text('Open'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.dragFrom(const Offset(1, 200), const Offset(600, 0));
    await tester.pumpAndSettle();
    expect(find.text('Open'), findsOneWidget);
    expect(find.text('Details'), findsNothing);
  });
}
