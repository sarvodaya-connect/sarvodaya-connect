import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/app.dart';
import 'package:sarvodaya_connect_mobile/src/data/demo_data.dart';
import 'package:sarvodaya_connect_mobile/src/models/notification.dart';
import 'package:sarvodaya_connect_mobile/src/models/society.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';
import 'package:sarvodaya_connect_mobile/src/services/registry_api_client.dart';
import 'package:sarvodaya_connect_mobile/src/state/demo_store.dart';

/// Fixed demo clock so dates in tests do not depend on the day they run.
final demoNow = DateTime(2026, 10, 13, 10, 15);

class TestRegistryApiClient extends RegistryApiClient {
  TestRegistryApiClient({List<SocietyDetails>? societies, List<AppNotification>? notifications})
      : societies = societies ?? _societies(),
        notifications = notifications ?? demoNotifications(demoNow);
  final List<SocietyDetails> societies;
  List<AppNotification> notifications;
  bool failSocieties = false;
  bool failNotifications = false;

  static List<SocietyDetails> _societies() => demoSocieties.indexed.map((item) {
    final society = item.$2;
    final grade = switch (item.$1) { 0 => 'B', 1 => 'C', _ => 'A' };
    return society.copyWith(grade: grade, dsDivision: society.address.dsDivision, memberCount: 100 + item.$1, spcName: 'Demo SPC', spcUserId: 'spc-demo', hasOpenGradeRequest: item.$1 == 0);
  }).toList();

  @override
  Future<List<SocietyDetails>> listSocieties(UserRole role, {Map<String, String> filters = const {}}) async {
    if (failSocieties) throw const RegistryApiException('unavailable');
    final user = switch (role) { UserRole.societyOfficer => demoOfficer, UserRole.programmeCoordinator => demoProgrammeCoordinator, UserRole.deputyDistrictManager => demoDeputyDistrictManager, UserRole.districtManager => demoDistrictManager, UserRole.hqAdmin => demoHqAdmin };
    var rows = societies.where((society) => switch (role) { UserRole.societyOfficer || UserRole.programmeCoordinator || UserRole.deputyDistrictManager => user.societyIds.contains(society.id), UserRole.districtManager => user.districtIds.contains(society.district.id), UserRole.hqAdmin => true }).toList();
    final search = filters['search']?.toLowerCase();
    if (search != null && search.isNotEmpty) rows = rows.where((row) => row.nameEn.toLowerCase().contains(search) || row.societyCode.toLowerCase().contains(search)).toList();
    if (filters['districtId'] case final district?) rows = rows.where((row) => row.district.id == district).toList();
    if (filters['grade'] case final grade?) rows = rows.where((row) => row.grade == grade).toList();
    if (filters['dsDivision'] case final division?) rows = rows.where((row) => row.dsDivision == division).toList();
    if (filters['spcUserId'] case final spc?) rows = rows.where((row) => row.spcUserId == spc).toList();
    if (filters['gradeRequest'] == 'OPEN') rows = rows.where((row) => row.hasOpenGradeRequest).toList();
    if (filters['gradeRequest'] == 'NONE') rows = rows.where((row) => !row.hasOpenGradeRequest).toList();
    return rows;
  }

  @override
  Future<List<AppNotification>> listNotifications(UserRole role) async {
    if (failNotifications) throw const RegistryApiException('unavailable');
    return List.of(notifications);
  }
  @override
  Future<void> markRead(UserRole role, String id) async {
    notifications = notifications.map((item) => item.id == id ? item.markedRead() : item).toList();
  }
  @override
  Future<void> markAllRead(UserRole role) async {
    notifications = notifications.map((item) => item.markedRead()).toList();
  }
}

DemoStore testStore({RegistryApiClient? registryApiClient}) => DemoStore(
  loadDelay: Duration.zero,
  clock: () => demoNow,
  showSplash: false,
  languageChosen: true,
  firstTimeSetupComplete: true,
  registryApiClient: registryApiClient ?? TestRegistryApiClient(),
);

/// Pumps the app on a tall phone-width screen so long screens need less scrolling.
Future<DemoStore> pumpApp(WidgetTester tester, {DemoStore? store}) async {
  tester.view.physicalSize = const Size(412 * 3, 1400 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final demoStore = store ?? testStore(registryApiClient: TestRegistryApiClient());
  await tester.pumpWidget(SarvodayaConnectApp(store: demoStore));
  await tester.pumpAndSettle();
  return demoStore;
}

Future<void> signInWithDemoAccount(WidgetTester tester) async {
  await tester.tap(find.text('Use demo account'));
  await tester.pump();
  await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
  await tester.pumpAndSettle();
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  tester.state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger).first).clearSnackBars();
  await tester.pumpAndSettle();
  if (finder.evaluate().isEmpty) await tester.scrollUntilVisible(finder, 300, scrollable: find.byType(Scrollable).first);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}
