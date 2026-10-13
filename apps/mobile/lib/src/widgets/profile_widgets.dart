import 'package:flutter/material.dart';

import '../format.dart';
import '../theme/app_theme.dart';
import 'state_views.dart';

/// Conflicting-update state (SC-25): a newer version of the record exists, so the
/// outdated draft cannot be saved or sent until the officer reloads the record.
class ConflictNotice extends StatelessWidget {
  const ConflictNotice({
    super.key,
    required this.updatedBy,
    required this.updatedAt,
    required this.onReload,
    this.draftKeptMessage =
        'Your changes are kept, but they have not been sent.',
  });

  final String updatedBy;
  final DateTime updatedAt;
  final VoidCallback onReload;
  final String draftKeptMessage;

  @override
  Widget build(BuildContext context) {
    return NoticeBanner(
      icon: Icons.sync_problem,
      tone: NoticeTone.error,
      title: 'A newer version of this record is available',
      message:
          '$updatedBy updated the society record on ${formatDateTime(updatedAt)}. '
          '$draftKeptMessage Reload the record so your draft does not overwrite the newer details.',
      action: FilledButton.icon(
        onPressed: onReload,
        icon: const Icon(Icons.refresh),
        label: const Text('Reload Record'),
      ),
    );
  }
}

/// Shows a proposed draft value under an approved value, so the two are never confused.
class DraftValueTag extends StatelessWidget {
  const DraftValueTag(this.value, {super.key});

  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        label: 'Draft value, not approved yet: $value',
        excludeSemantics: true,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFEEF0EC),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFFC9CEC6)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.edit_note, size: 16, color: Color(0xFF55605A)),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  'Draft: $value',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF3E4B43),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Location-permission-denied state (SC-25 reusable states).
class LocationPermissionDenied extends StatelessWidget {
  const LocationPermissionDenied({
    super.key,
    required this.onOpenSettings,
    required this.onPlacePin,
  });

  final VoidCallback onOpenSettings;
  final VoidCallback onPlacePin;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.warningSoft,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(
              children: [
                Icon(Icons.location_off_outlined, color: AppColors.warning),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Location permission is needed',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.warning,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Sarvodaya Connect needs permission to use this phone’s location to record where the '
              'society is. You can allow it in Settings, or place the pin on the map yourself.',
              style: TextStyle(color: AppColors.inkSoft, height: 1.35),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: onOpenSettings,
                  icon: const Icon(Icons.settings_outlined),
                  label: const Text('Open Settings'),
                ),
                FilledButton.icon(
                  onPressed: onPlacePin,
                  icon: const Icon(Icons.push_pin_outlined),
                  label: const Text('Place Pin Manually'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Demo stand-in for opening the phone's settings: explains what would happen,
/// without requesting or changing any real permission.
Future<void> showOpenSettingsDemo(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Open Settings'),
      content: const Text(
        'On a phone, this opens Settings → Apps → Sarvodaya Connect → Location, where location '
        'access can be allowed. In this demonstration nothing on the device is changed.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('OK'),
        ),
      ],
    ),
  );
}
