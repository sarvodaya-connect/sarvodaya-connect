import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import 'state_views.dart';

/// Runs the demo store's simulated fetch for a screen and shows the loading,
/// offline and error states before the content.
class DemoLoader extends StatefulWidget {
  const DemoLoader({
    super.key,
    required this.builder,
    this.loadingLabel = 'Loading',
    this.skeletonCards = 3,
  });

  final WidgetBuilder builder;
  final String loadingLabel;
  final int skeletonCards;

  @override
  State<DemoLoader> createState() => _DemoLoaderState();
}

class _DemoLoaderState extends State<DemoLoader> {
  Future<void>? _future;
  int? _optionsVersion;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = DemoScope.of(context);
    // Load on first build, and again when a demo option (offline, error, empty) changes.
    if (_optionsVersion != store.optionsVersion) {
      _optionsVersion = store.optionsVersion;
      _future = store.load();
    }
  }

  void _retry() => setState(() => _future = DemoScope.read(context).load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return LoadingSkeleton(
            cards: widget.skeletonCards,
            label: widget.loadingLabel,
          );
        }
        if (snapshot.error is OfflineException) {
          return StateMessage(
            icon: Icons.wifi_off,
            tone: StateTone.offline,
            title: 'You are offline',
            message: 'We could not reach Sarvodaya Connect. Anything you have entered is saved on this phone.',
            primaryLabel: 'Try again',
            onPrimary: _retry,
            isAlert: true,
          );
        }
        if (snapshot.hasError) {
          return StateMessage(
            icon: Icons.error_outline,
            tone: StateTone.error,
            title: 'Something went wrong',
            message: 'This information could not be loaded. Your saved work has not been changed.',
            primaryLabel: 'Try again',
            onPrimary: _retry,
            isAlert: true,
          );
        }
        return widget.builder(context);
      },
    );
  }
}
