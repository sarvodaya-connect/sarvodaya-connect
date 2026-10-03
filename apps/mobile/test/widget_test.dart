import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/main.dart';

void main() {
  testWidgets('renders the initial application', (WidgetTester tester) async {
    await tester.pumpWidget(const MainApp());

    expect(find.text('Hello World!'), findsOneWidget);
  });
}