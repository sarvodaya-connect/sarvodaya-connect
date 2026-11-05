import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/theme/app_theme.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/state_views.dart';

import 'test_helpers.dart';

Widget _host(Widget child) => MaterialApp(
  theme: AppTheme.light(),
  home: Scaffold(body: child),
);

void main() {
  testWidgets('the V5 bottom bar is icon-only with named tabs', (tester) async {
    final store = testStore()..switchDemoRole(UserRole.districtManager);
    await pumpApp(tester, store: store);

    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    final theme = Theme.of(tester.element(find.byType(NavigationBar)));
    expect(bar.labelBehavior, isNull);
    expect(
      theme.navigationBarTheme.labelBehavior,
      NavigationDestinationLabelBehavior.alwaysHide,
    );
    expect(theme.navigationBarTheme.indicatorColor, AppColors.navIndicator);
    expect(navTab('Societies'), findsOneWidget);
    expect(navTab('Access'), findsOneWidget);
  });

  testWidgets('M26 no access names nothing and offers a way back', (
    tester,
  ) async {
    var backs = 0;
    await tester.pumpWidget(_host(NoAccessView(onBack: () => backs++)));

    expect(find.text("You Don't Have Access to This"), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    await tester.tap(find.text('Back to my societies'));
    expect(backs, 1);
  });

  testWidgets('access banners describe what the viewer can do', (tester) async {
    await tester.pumpWidget(
      _host(
        const AccessBanner(
          tone: AccessBannerTone.temporary,
          child: Text('Temporary district-wide view · view only'),
        ),
      ),
    );

    expect(
      find.text('Temporary district-wide view · view only'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.schedule), findsOneWidget);
  });
}
