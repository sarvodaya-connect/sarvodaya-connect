import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../models/user.dart';

/// Lets the presenter show the offline, error, empty, location-permission and
/// conflicting-update states during the demo.
Future<void> showDemoOptions(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) {
      final store = DemoScope.of(context);
      return SafeArea(
        child: SingleChildScrollView(
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
                  'For demonstrations only. These options show how the app behaves offline, when loading or uploading fails, with no records, without location permission or when the record changes.',
                  style: TextStyle(color: AppColors.muted),
                ),
              ),
              if (store.user != null) ...[
                const Divider(),
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
                  child: Text(
                    'Preview role home',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                RadioGroup<UserRole>(
                  groupValue: store.activeRole,
                  onChanged: (value) {
                    if (value == null) return;
                    store.switchDemoRole(value);
                    Navigator.of(context).pop();
                  },
                  child: Column(
                    children: [
                      for (final role in UserRole.values)
                        RadioListTile<UserRole>(
                          value: role,
                          title: Text(role.label),
                          subtitle: const Text(
                            'Fictional demonstration account',
                          ),
                        ),
                    ],
                  ),
                ),
              ],
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
              SwitchListTile(
                title: const Text('New society with no records'),
                subtitle: const Text(
                  'Documents, Audit and Notifications show their empty states',
                ),
                value: store.emptyRecords,
                onChanged: (value) => store.setDemoOptions(emptyRecords: value),
              ),
              SwitchListTile(
                title: const Text('Next upload fails'),
                subtitle: const Text(
                  'The next document upload stops part-way so Retry can be shown',
                ),
                value: store.failNextUpload,
                onChanged: (value) =>
                    store.setDemoOptions(failNextUpload: value),
              ),
              SwitchListTile(
                title: const Text('Location permission denied'),
                subtitle: const Text(
                  '"Use my location" shows Open Settings and Place Pin Manually',
                ),
                value: store.locationPermissionDenied,
                onChanged: (value) =>
                    store.setDemoOptions(locationPermissionDenied: value),
              ),
              ListTile(
                leading: const Icon(Icons.sync_problem),
                title: const Text('Simulate a newer society record'),
                subtitle: Text(
                  store.recordVersion == 1
                      ? 'The District Centre saves a newer version; open profile drafts must be reloaded'
                      : 'Record is now version ${store.recordVersion}. Tap again for another update',
                ),
                onTap: store.demoNewerRecord,
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
        ),
      );
    },
  );
}
