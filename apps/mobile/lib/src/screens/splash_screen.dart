import 'dart:async';

import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';

/// M01 - branded launch screen.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 900), () {
      if (mounted) DemoScope.read(context).finishSplash();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // V5 M01: orange screen, white logo, tagline, spinner and footer.
    return Scaffold(
      backgroundColor: AppColors.splash,
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 72),
              child: Semantics(
                label: 'Sarvodaya Connect',
                image: true,
                child: Image.asset(
                  'assets/branding/sarvodaya_connect_logo_white.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Village societies, connected.',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
                semanticsLabel: 'Loading',
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Sarvodaya Shramadana Movement',
              style: TextStyle(color: Colors.white, fontSize: 11),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
