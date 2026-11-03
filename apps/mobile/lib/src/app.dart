import 'national/national_screens.dart';
import 'screens/live_societies_screen.dart';
import 'home/home_screens.dart';
import 'screens/notifications_screen.dart';
import 'district_access/district_access_screens.dart';
import 'incidents/incident_screens.dart';

import 'package:flutter/material.dart';

import 'screens/documents_screen.dart';
import 'screens/home_screen.dart';
import 'screens/language_screen.dart';
import 'screens/more_screen.dart';
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
    // A tab remembered from another role may not exist in this tab set.
    final tab = store.selectedTab.clamp(0, configuration.pages.length - 1);
    return Scaffold(
      body: IndexedStack(index: tab, children: configuration.pages),
      // V5 bottom bar (Nav): icon-only, styled by the theme, with a hairline above.
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.headerLine)),
        ),
        child: NavigationBar(
          selectedIndex: tab,
          onDestinationSelected: store.selectTab,
          destinations: configuration.destinations,
        ),
      ),
    );
  }

  static _ShellConfiguration _configuration(
    UserRole role,
    AppLanguage language,
    int selectedTab,
    String? officerSocietyId,
  ) => switch (role) {
    // API mode: V5 Nav for the Society Officer (Home, Society, the red
    // Incident button, Exco, Work plan, More).
    UserRole.societyOfficer when officerSocietyId != null =>
      _ShellConfiguration(
        pages: [
          SocietyOfficerHomeScreen(societyId: officerSocietyId),
          const LiveSocietiesScreen(),
          selectedTab == OfficerTabs.incident
              ? const IncidentsScreen()
              : const SizedBox.shrink(),
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
          _IncidentDestination(),
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
        // Outside demo mode an officer with several societies starts from
        // their society list; one society opens the V5 home above.
        DemoStore.demoMode ? HomeScreen() : LiveSocietiesScreen(),
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
    // V5 HQ tabs: Overview, Districts, Societies, Alerts, More.
    UserRole.hqAdmin => _ShellConfiguration(
      pages: [
        const NationalDashboardScreen(),
        const DistrictsScreen(),
        const NationalSocietiesScreen(asTab: true),
        const NotificationsScreen(),
        const MoreScreen(),
      ],
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.grid_view_outlined),
          selectedIcon: Icon(Icons.grid_view),
          label: 'Overview',
          tooltip: 'Overview',
        ),
        NavigationDestination(
          icon: Icon(Icons.bar_chart_outlined),
          selectedIcon: Icon(Icons.bar_chart),
          label: 'Districts',
          tooltip: 'Districts',
        ),
        NavigationDestination(
          icon: Icon(Icons.list_alt_outlined),
          selectedIcon: Icon(Icons.list_alt),
          label: 'Societies',
          tooltip: 'Societies',
        ),
        NavigationDestination(
          icon: Icon(Icons.notifications_outlined),
          selectedIcon: Icon(Icons.notifications),
          label: 'Alerts',
          tooltip: 'Alerts',
        ),
        _MoreDestination(),
      ],
    ),
    // V5 Nav: SPC and DDM have Home, Alerts and More; incidents open from
    // the home (M40) and More.
    UserRole.programmeCoordinator ||
    UserRole.deputyDistrictManager => const _ShellConfiguration(
      pages: [RoleHomeScreen(), NotificationsScreen(), MoreScreen()],
      destinations: [
        _HomeDestination(),
        NavigationDestination(
          icon: Icon(Icons.notifications_outlined),
          selectedIcon: Icon(Icons.notifications),
          label: 'Alerts',
          tooltip: 'Alerts',
        ),
        _MoreDestination(),
      ],
    ),
    // V5 Nav (DM): Home, Societies, Access, Alerts and More.
    UserRole.districtManager => const _ShellConfiguration(
      pages: [
        RoleHomeScreen(),
        DistrictSocietiesScreen(),
        DistrictAccessScreen(),
        NotificationsScreen(),
        MoreScreen(),
      ],
      destinations: [
        _HomeDestination(),
        NavigationDestination(
          icon: Icon(Icons.list_alt_outlined),
          selectedIcon: Icon(Icons.list_alt),
          label: 'Societies',
          tooltip: 'Societies',
        ),
        NavigationDestination(
          icon: Icon(Icons.key_outlined),
          selectedIcon: Icon(Icons.key),
          label: 'Access',
          tooltip: 'Access',
        ),
        NavigationDestination(
          icon: Icon(Icons.notifications_outlined),
          selectedIcon: Icon(Icons.notifications),
          label: 'Alerts',
          tooltip: 'Alerts',
        ),
        _MoreDestination(),
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

/// V5 Nav: the red "Incident" button for disaster response (M40–M49).
class _IncidentDestination extends NavigationDestination {
  const _IncidentDestination()
    : super(
        icon: const _IncidentIcon(),
        selectedIcon: const _IncidentIcon(),
        label: 'Incident',
        tooltip: 'Incident',
      );
}

class _IncidentIcon extends StatelessWidget {
  const _IncidentIcon();

  @override
  Widget build(BuildContext context) => Container(
    width: 46,
    height: 30,
    decoration: BoxDecoration(
      color: AppColors.danger,
      borderRadius: BorderRadius.circular(9),
    ),
    child: const Icon(
      Icons.warning_amber_rounded,
      color: Colors.white,
      size: 20,
    ),
  );
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
