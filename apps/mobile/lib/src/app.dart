import 'motion/app_motion.dart';
import 'national/national_screens.dart';
import 'screens/live_societies_screen.dart';
import 'home/home_screens.dart';
import 'screens/notifications_screen.dart';
import 'district_access/district_access_screens.dart';
import 'incidents/incident_screens.dart';

import 'package:flutter/material.dart';

import 'screens/language_screen.dart';
import 'screens/more_screen.dart';
import 'screens/sign_in_screen.dart';
import 'screens/society_officer_home_screen.dart';
import 'screens/splash_screen.dart';
import 'l10n/l10n.dart';
import 'models/app_language.dart';
import 'state/demo_store.dart';
import 'auth/api_auth_service.dart';
import 'auth/cognito_auth.dart';
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
      child: ListenableBuilder(
        listenable: _store,
        builder: (context, _) => MaterialApp(
          title: 'Sarvodaya Connect',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          locale: _store.selectedLanguage.locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          builder: (context, child) => MotionScope(
            key: ValueKey((_store.user?.id, _store.activeRole)),
            child: _PhoneWidth(child: child!),
          ),
          home: const _Root(),
        ),
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
    // V5 PR 10: a release build without a valid https server address says so.
    final problem = DemoStore.demoMode
        ? null
        : IdentityApi.configurationProblem() ??
              CognitoSettings.configurationProblem();
    if (problem != null) return ConfigurationProblemScreen(message: problem);
    if (store.showSplash) return const SplashScreen();
    if (!store.languageChosen) return const LanguageScreen();
    if (store.user == null) return const SignInScreen();
    return const HomeShell();
  }
}

/// Shown instead of the app when a release build is misconfigured, so it
/// never signs in against the wrong server.
class ConfigurationProblemScreen extends StatelessWidget {
  const ConfigurationProblemScreen({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.settings_outlined,
                size: 40,
                color: AppColors.muted,
              ),
              const SizedBox(height: 12),
              const Text(
                'This App Is Not Set Up Yet',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Role-aware five-destination navigation for SC-39.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key});

  static const homeTab = 0;
  static const societyTab = 1;

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
    // V5 PR 10: a Society Officer with one society gets the V5 bar (Home,
    // Society, Incident, Exco, Work plan, More) in demo mode too; the V3
    // Submit/Requests journey no longer matches the prototype.
    final officerSocietyId =
        role == UserRole.societyOfficer &&
            user != null &&
            user.societyIds.length == 1
        ? user.societyIds.single
        : null;
    final configuration = _configuration(
      context.l10n,
      role,
      store.selectedTab,
      officerSocietyId,
    );
    // A tab remembered from another role may not exist in this tab set.
    final tab = store.selectedTab.clamp(0, configuration.pages.length - 1);
    return Scaffold(
      // Recreate per-user home state and notification buttons on account or
      // role changes; cached home responses must not follow another user.
      body: IndexedStack(
        key: ValueKey((user?.id, role)),
        index: tab,
        children: [
          for (final (index, page) in configuration.pages.indexed)
            TickerMode(enabled: index == tab, child: page),
        ],
      ),
      // V5 bottom bar (Nav): icon-only, styled by the theme, with a hairline above.
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.headerLine)),
        ),
        child: NavigationBar(
          animationDuration: AppMotion.duration(context, AppMotion.state),
          selectedIndex: tab,
          onDestinationSelected: store.selectTab,
          destinations: configuration.destinations,
        ),
      ),
    );
  }

  static _ShellConfiguration _configuration(
    AppLocalizations l10n,
    UserRole role,
    int selectedTab,
    String? officerSocietyId,
  ) => switch (role) {
    // V5 Nav for the Society Officer (Home, Society, the red Incident
    // button, Exco, Work plan, More), in API and demo mode.
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
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            label: l10n.navHome,
            tooltip: l10n.navHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.apartment_outlined),
            selectedIcon: const Icon(Icons.apartment),
            label: l10n.navSociety,
            tooltip: l10n.navSociety,
          ),
          _incidentDestination(l10n),
          NavigationDestination(
            icon: const Icon(Icons.people_outline),
            selectedIcon: const Icon(Icons.people),
            label: l10n.navExco,
            tooltip: l10n.navExco,
          ),
          NavigationDestination(
            icon: const Icon(Icons.calendar_today_outlined),
            selectedIcon: const Icon(Icons.calendar_today),
            label: l10n.navWorkPlan,
            tooltip: l10n.navWorkPlan,
          ),
          NavigationDestination(
            icon: const Icon(Icons.menu),
            label: l10n.navMore,
            tooltip: l10n.navMore,
          ),
        ],
      ),
    // A Society Officer with no society, or several, has no V5 frame (To
    // Confirm): their society list, the Incident button and More.
    UserRole.societyOfficer => _ShellConfiguration(
      pages: [
        const LiveSocietiesScreen(),
        selectedTab == 1 ? const IncidentsScreen() : const SizedBox.shrink(),
        const MoreScreen(),
      ],
      destinations: [
        NavigationDestination(
          icon: const Icon(Icons.home_outlined),
          selectedIcon: const Icon(Icons.home),
          label: l10n.navHome,
        ),
        _incidentDestination(l10n),
        NavigationDestination(
          icon: const Icon(Icons.menu),
          selectedIcon: const Icon(Icons.menu_open),
          label: l10n.navMore,
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
      destinations: [
        NavigationDestination(
          icon: const Icon(Icons.grid_view_outlined),
          selectedIcon: const Icon(Icons.grid_view),
          label: l10n.navOverview,
          tooltip: l10n.navOverview,
        ),
        NavigationDestination(
          icon: const Icon(Icons.bar_chart_outlined),
          selectedIcon: const Icon(Icons.bar_chart),
          label: l10n.navDistricts,
          tooltip: l10n.navDistricts,
        ),
        NavigationDestination(
          icon: const Icon(Icons.list_alt_outlined),
          selectedIcon: const Icon(Icons.list_alt),
          label: l10n.navSocieties,
          tooltip: l10n.navSocieties,
        ),
        NavigationDestination(
          icon: const Icon(Icons.notifications_outlined),
          selectedIcon: const Icon(Icons.notifications),
          label: l10n.navAlerts,
          tooltip: l10n.navAlerts,
        ),
        _moreDestination(l10n),
      ],
    ),
    // V5 Nav: SPC and DDM have Home, Alerts and More; incidents open from
    // the home (M40) and More.
    UserRole.programmeCoordinator ||
    UserRole.deputyDistrictManager => _ShellConfiguration(
      pages: const [RoleHomeScreen(), NotificationsScreen(), MoreScreen()],
      destinations: [
        _homeDestination(l10n),
        NavigationDestination(
          icon: const Icon(Icons.notifications_outlined),
          selectedIcon: const Icon(Icons.notifications),
          label: l10n.navAlerts,
          tooltip: l10n.navAlerts,
        ),
        _moreDestination(l10n),
      ],
    ),
    // V5 Nav (DM): Home, Societies, Access, Alerts and More.
    UserRole.districtManager => _ShellConfiguration(
      pages: const [
        RoleHomeScreen(),
        DistrictSocietiesScreen(),
        DistrictAccessScreen(),
        NotificationsScreen(),
        MoreScreen(),
      ],
      destinations: [
        _homeDestination(l10n),
        NavigationDestination(
          icon: const Icon(Icons.list_alt_outlined),
          selectedIcon: const Icon(Icons.list_alt),
          label: l10n.navSocieties,
          tooltip: l10n.navSocieties,
        ),
        NavigationDestination(
          icon: const Icon(Icons.key_outlined),
          selectedIcon: const Icon(Icons.key),
          label: l10n.navAccess,
          tooltip: l10n.navAccess,
        ),
        NavigationDestination(
          icon: const Icon(Icons.notifications_outlined),
          selectedIcon: const Icon(Icons.notifications),
          label: l10n.navAlerts,
          tooltip: l10n.navAlerts,
        ),
        _moreDestination(l10n),
      ],
    ),
  };
}

class _ShellConfiguration {
  const _ShellConfiguration({required this.pages, required this.destinations});

  final List<Widget> pages;
  final List<NavigationDestination> destinations;
}

/// V5 Nav: the red "Incident" button for disaster response (M40–M49).
NavigationDestination _incidentDestination(AppLocalizations l10n) =>
    NavigationDestination(
      icon: const _IncidentIcon(),
      selectedIcon: const _IncidentIcon(),
      label: l10n.navIncident,
      tooltip: l10n.navIncident,
    );

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

NavigationDestination _homeDestination(AppLocalizations l10n) =>
    NavigationDestination(
      icon: const Icon(Icons.home_outlined),
      selectedIcon: const Icon(Icons.home),
      label: l10n.navHome,
    );

NavigationDestination _moreDestination(AppLocalizations l10n) =>
    NavigationDestination(
      icon: const Icon(Icons.menu),
      selectedIcon: const Icon(Icons.menu_open),
      label: l10n.navMore,
    );
