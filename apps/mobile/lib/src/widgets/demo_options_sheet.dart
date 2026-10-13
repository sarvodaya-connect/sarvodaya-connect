import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';

/// Lets the presenter show the offline, error and empty states during the demo.
Future<void> showDemoOptions(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      final store = DemoScope.of(context);
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Text(
                'Demo options',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'For demonstrations only. These switches show how the app behaves without a connection or when loading fails.',
                style: TextStyle(color: AppColors.muted),
              ),
            ),
            SwitchListTile(
              title: const Text('Offline'),
              subtitle: const Text(
                'Loading and sending fail; drafts stay on the phone',
              ),
              value: store.offline,
              onChanged: (value) => store.setDemoOptions(offline: value),
            ),
            SwitchListTile(
              title: const Text('Loading error'),
              subtitle: const Text('Screens show the general error state'),
              value: store.failLoads,
              onChanged: (value) => store.setDemoOptions(failLoads: value),
            ),
            SwitchListTile(
              title: const Text('No submissions yet'),
              subtitle: const Text('The tracker shows its empty state'),
              value: store.emptyTracker,
              onChanged: (value) => store.setDemoOptions(emptyTracker: value),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Sign out'),
              onTap: () {
                Navigator.of(context).pop();
                store.signOut();
              },
            ),
          ],
        ),
      );
    },
  );
}
