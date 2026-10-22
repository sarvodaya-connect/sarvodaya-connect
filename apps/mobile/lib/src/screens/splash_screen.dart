import 'dart:async';

import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';

/// M01 - branded launch screen on the Sarvodaya Orange background
/// (Screen Catalogue v3, "Changed in v2").
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
    return Scaffold(
      backgroundColor: AppColors.orangeSplash,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 36),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(
                  label: 'Sarvodaya Connect',
                  image: true,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(28),
                    child: Container(
                      color: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 24,
                      ),
                      child: Image.asset(
                        'assets/branding/sarvodaya_connect_logo.jpg',
                        width: 220,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                const Text(
                  'Village societies, connected.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 48),
                const Text(
                  'Sarvodaya Shramadana Movement · v1.0',
                  style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
