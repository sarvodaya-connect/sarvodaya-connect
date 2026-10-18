import 'package:flutter/material.dart';

import 'screens/documents_screen.dart';
import 'screens/first_time_setup_screen.dart';
import 'screens/home_screen.dart';
import 'screens/language_screen.dart';
import 'screens/sign_in_screen.dart';
import 'screens/society_profile_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/tracker_screen.dart';
import 'state/demo_store.dart';
import 'theme/app_theme.dart';

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

/// The four destinations from the SC-25 navigation model.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key});

  static const homeTab = 0;
  static const societyTab = 1;
  static const documentsTab = 2;
  static const trackerTab = 3;

  /// Returns to the shell and opens a tab, for example after a submission.
  static void openTab(BuildContext context, int tab) {
    DemoScope.read(context).selectTab(tab);
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      body: IndexedStack(
        index: store.selectedTab,
        children: const [
          HomeScreen(),
          SocietyProfileScreen(),
          DocumentsScreen(),
          TrackerScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: store.selectedTab,
        onDestinationSelected: store.selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups),
            label: 'Society',
          ),
          NavigationDestination(
            icon: Icon(Icons.description_outlined),
            selectedIcon: Icon(Icons.description),
            label: 'Documents',
          ),
          NavigationDestination(
            icon: Icon(Icons.timeline_outlined),
            selectedIcon: Icon(Icons.timeline),
            label: 'Tracker',
          ),
        ],
      ),
    );
  }
}
