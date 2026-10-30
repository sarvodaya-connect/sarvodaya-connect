import 'screens/live_societies_screen.dart';
import 'screens/v4_role_home_screen.dart';
import 'screens/district_access_screen.dart';
import 'screens/emergency_response_screen.dart';

import 'package:flutter/material.dart';

import 'screens/documents_screen.dart';
import 'screens/first_time_setup_screen.dart';
import 'screens/home_screen.dart';
import 'screens/language_screen.dart';
import 'screens/more_screen.dart';
import 'screens/my_societies_screen.dart';
import 'screens/role_workspace_screen.dart';
import 'screens/sign_in_screen.dart';
import 'screens/society_officer_home_screen.dart';
import 'screens/society_profile_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/tracker_screen.dart';
import 'models/app_language.dart';
import 'state/demo_store.dart';
import 'theme/app_theme.dart';
import 'models/user.dart';

class SarvodayaConnectApp extends StatefulWidget {
  const SarvodayaConnectApp({super.key, this.store});

  /// Tests pass a store with no loading delay.
  final DemoStore? store;

  @override
  State<SarvodayaConnectApp> createState() => _SarvodayaConnectAppState();
}

class _SarvodayaConnectAppState extends State<SarvodayaConnectApp> {
  late final DemoStore _store = widget.store ?? DemoStore();

  @override
  Widget build(BuildContext context) {
    return DemoScope(
      store: _store,
      child: MaterialApp(
        title: 'Sarvodaya Connect',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        builder: (context, child) => _PhoneWidth(child: child!),
        home: const _Root(),
      ),
    );
  }
}

/// Keeps the phone layout readable on tablets by centring it at phone width.
class _PhoneWidth extends StatelessWidget {
  const _PhoneWidth({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.background,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: child,
        ),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.showSplash) return const SplashScreen();
    if (!store.languageChosen) return const LanguageScreen();
    if (store.user == null) return const SignInScreen();
    if (store.needsFirstTimeSetup) return const FirstTimeSetupScreen();
    return const HomeShell();
  }
}

/// Role-aware five-destination navigation for SC-39.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key});

  static const homeTab = 0;
  static const societyTab = 1;
  static const documentsTab = 2;
  static const trackerTab = 3;
  static const roleWorkTab = 2;
  static const moreTab = 4;

  /// Returns to the shell and opens a tab, for example after a submission.
  static void openTab(BuildContext context, int tab) {
    DemoScope.read(context).selectTab(tab);
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final role = store.activeRole;
    final user = store.user;
    // A Society Officer with one society gets the Prototype v4 home in API
    // mode; demo mode keeps the v3 journey.
    final officerSocietyId =
        !DemoStore.demoMode &&
            role == UserRole.societyOfficer &&
            user != null &&
            user.societyIds.length == 1
        ? user.societyIds.single
        : null;
    final configuration = _configuration(
      role,
      store.selectedLanguage,
      store.selectedTab,
      officerSocietyId,
    );
    return Scaffold(
      body: IndexedStack(
        index: store.selectedTab,
        children: configuration.pages,
      ),
      bottomNavigationBar: NavigationBar(
        // The v4 officer bar shows icons only; labels stay as tooltips and
        // screen-reader names.
        labelBehavior: officerSocietyId == null
            ? null
            : NavigationDestinationLabelBehavior.alwaysHide,
        height: officerSocietyId == null ? null : 60,
        selectedIndex: store.selectedTab,
        onDestinationSelected: store.selectTab,
        destinations: configuration.destinations,
      ),
    );
  }

  static _ShellConfiguration _configuration(
    UserRole role,
    AppLanguage language,
    int selectedTab,
    String? officerSocietyId,
  ) => switch (role) {
    // API mode: Prototype v4 M05 home and bottom bar (Home, Society, Exco,
    // Work plan, More). Submissions to District are not part of v4.
    UserRole.societyOfficer when officerSocietyId != null =>
      _ShellConfiguration(
        pages: [
          SocietyOfficerHomeScreen(societyId: officerSocietyId),
          const LiveSocietiesScreen(),
          selectedTab == OfficerTabs.exco
              ? const LiveSocietiesScreen(initialTab: 1)
              : const SizedBox.shrink(),
          selectedTab == OfficerTabs.workPlan
              ? const LiveSocietiesScreen(initialTab: 2)
              : const SizedBox.shrink(),
          const MoreScreen(),
        ],
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            label: 'Home',
            tooltip: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.apartment_outlined),
            selectedIcon: Icon(Icons.apartment),
            label: 'Society',
            tooltip: 'Society',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Exco',
            tooltip: 'Exco',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today_outlined),
            selectedIcon: Icon(Icons.calendar_today),
            label: 'Work plan',
            tooltip: 'Work plan',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu),
            label: 'More',
            tooltip: 'More',
          ),
        ],
      ),
    UserRole.societyOfficer => _ShellConfiguration(
      pages: const [
        DemoStore.demoMode
            ? HomeScreen()
            : V4RoleHomeScreen(role: UserRole.societyOfficer),
        // Demo mode keeps the v3 profile that the Society Officer demo
        // journey still uses.
        DemoStore.demoMode ? SocietyProfileScreen() : LiveSocietiesScreen(),
        DocumentsScreen(),
        TrackerScreen(),
        MoreScreen(),
      ],
      destinations: [
        NavigationDestination(
          icon: const Icon(Icons.home_outlined),
          selectedIcon: const Icon(Icons.home),
          label: _officerLabel(language, 'Home'),
        ),
        NavigationDestination(
          icon: const Icon(Icons.people_outline),
          selectedIcon: const Icon(Icons.people),
          label: _officerLabel(language, 'Society'),
        ),
        NavigationDestination(
          icon: const _SubmitIcon(),
          label: _officerLabel(language, 'Submit'),
        ),
        NavigationDestination(
          icon: const _RequestsIcon(),
          selectedIcon: const _RequestsIcon(selected: true),
          label: _officerLabel(language, 'Requests'),
        ),
        NavigationDestination(
          icon: const Icon(Icons.menu),
          selectedIcon: const Icon(Icons.menu_open),
          label: _officerLabel(language, 'More'),
        ),
      ],
    ),
    UserRole.programmeCoordinator ||
    UserRole.deputyDistrictManager ||
    UserRole.districtManager ||
    UserRole.hqAdmin => _ShellConfiguration(
      pages: [
        V4RoleHomeScreen(role: role),
        const MySocietiesScreen(),
        role == UserRole.districtManager
            ? const DistrictAccessScreen()
            : RoleWorkspaceScreen(role: role, workspace: RoleWorkspace.alerts),
        selectedTab == 3
            ? const EmergencyResponseScreen()
            : const SizedBox.shrink(),
        const MoreScreen(),
      ],
      destinations: [
        const _HomeDestination(),
        const NavigationDestination(
          icon: Icon(Icons.holiday_village_outlined),
          label: 'Societies',
        ),
        NavigationDestination(
          icon: Icon(
            role == UserRole.districtManager
                ? Icons.schedule
                : Icons.notifications_outlined,
          ),
          label: role == UserRole.districtManager ? 'Access' : 'Alerts',
        ),
        const NavigationDestination(
          icon: Icon(Icons.warning_amber_outlined),
          label: 'Disasters',
        ),
        const _MoreDestination(),
      ],
    ),
  };

  static String _officerLabel(AppLanguage language, String english) {
    if (language != AppLanguage.tamil) return english;
    return switch (english) {
      'Home' => 'முகப்பு',
      'Society' => 'சங்கம்',
      'Submit' => 'சமர்ப்பி',
      'Requests' => 'கோரிக்கைகள்',
      'More' => 'மேலும்',
      _ => english,
    };
  }
}

/// Catalogue bottom-bar "Submit": a filled green square with a plus.
class _SubmitIcon extends StatelessWidget {
  const _SubmitIcon();

  @override
  Widget build(BuildContext context) => Container(
    width: 34,
    height: 24,
    decoration: BoxDecoration(
      color: AppColors.action,
      borderRadius: BorderRadius.circular(6),
    ),
    child: const Icon(Icons.add, color: Colors.white, size: 20),
  );
}

/// Requests inbox icon with the amber dot for new requests.
class _RequestsIcon extends StatelessWidget {
  const _RequestsIcon({this.selected = false});

  final bool selected;

  @override
  Widget build(BuildContext context) => Badge(
    smallSize: 7,
    backgroundColor: const Color(0xFFF3C44E),
    child: Icon(
      selected ? Icons.mark_email_unread : Icons.mark_email_unread_outlined,
    ),
  );
}

class _ShellConfiguration {
  const _ShellConfiguration({required this.pages, required this.destinations});

  final List<Widget> pages;
  final List<NavigationDestination> destinations;
}

class _HomeDestination extends NavigationDestination {
  const _HomeDestination()
    : super(
        icon: const Icon(Icons.home_outlined),
        selectedIcon: const Icon(Icons.home),
        label: 'Home',
      );
}

class _MoreDestination extends NavigationDestination {
  const _MoreDestination()
    : super(
        icon: const Icon(Icons.menu),
        selectedIcon: const Icon(Icons.menu_open),
        label: 'More',
      );
}
