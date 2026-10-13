import 'package:flutter/material.dart';

import '../format.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/council_widgets.dart';
import '../widgets/demo_loader.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'council_screen.dart';

/// M06 · Society profile (approved registry record, read-only).
class SocietyProfileScreen extends StatelessWidget {
  const SocietyProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Society profile')),
      body: Column(
        children: [
          if (store.offline) const OfflineBanner(),
          Expanded(
            child: DemoLoader(
              loadingLabel: 'Loading the society profile',
              builder: (context) => const _ProfileContent(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileContent extends StatelessWidget {
  const _ProfileContent();

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final society = store.society;
    final societyPhone = society.contacts
        .where((contact) => contact.label == 'Society phone')
        .firstOrNull;
    final societyEmail = society.contacts
        .where(
          (contact) =>
              contact.email != null && contact.label == 'Society email',
        )
        .firstOrNull;
    final officeBearers = store.council
        .where((member) => member.isOfficeBearer)
        .toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        NoticeBanner(
          icon: Icons.verified_outlined,
          tone: NoticeTone.success,
          title: 'Approved record · Verified',
          message:
              'Last verified ${formatDate(society.lastVerifiedOn!)} by ${society.lastVerifiedBy}. '
              'Changes you make are drafts until the District Centre approves them.',
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Registration',
          children: [
            InfoRow(label: 'Name', value: society.nameEn),
            InfoRow(label: 'Local name', value: society.nameLocal),
            Row(
              children: [
                Expanded(
                  child: InfoRow(
                    label: 'Society ID',
                    value: society.societyCode,
                  ),
                ),
                Expanded(
                  child: InfoRow(
                    label: 'Registration number',
                    value: society.registrationNumber,
                  ),
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: InfoRow(
                    label: 'Established',
                    value: society.establishedOn == null
                        ? null
                        : formatDate(society.establishedOn!),
                  ),
                ),
                Expanded(
                  child: InfoRow(
                    label: 'District',
                    value: society.district.nameEn,
                  ),
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: InfoRow(
                    label: 'DS Division',
                    value: society.address.dsDivision,
                  ),
                ),
                Expanded(
                  child: InfoRow(
                    label: 'GN Division',
                    value: society.address.gnDivision,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Address and contact',
          children: [
            InfoRow(label: 'Address', value: society.address.addressLine),
            InfoRow(label: 'Village or town', value: society.address.village),
            InfoRow(label: 'Society phone', value: societyPhone?.phone),
            InfoRow(label: 'Society email', value: societyEmail?.email),
            InfoRow(
              label: 'Primary contact',
              value:
                  '${society.primaryContact?.fullName} (${society.primaryContact?.position})',
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Location',
          children: [
            const _MapPreview(),
            const SizedBox(height: 12),
            InfoRow(
              label: 'GPS',
              value: society.location == null
                  ? null
                  : '${society.location!.latitude.toStringAsFixed(4)}° N, ${society.location!.longitude.toStringAsFixed(4)}° E',
            ),
          ],
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Executive Council',
          trailing:
              store.councilSubmission != null &&
                  store.councilSubmission!.isLocked
              ? StatusChip.submission(
                  store.councilSubmission!.status,
                  compact: true,
                )
              : null,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          children: [
            SeatSummary(filled: store.seatsFilled, total: store.totalSeats),
            const SizedBox(height: 12),
            for (final member in officeBearers)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    MemberAvatar(member, size: 32),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        member.fullName,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    Text(
                      member.position,
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 4),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const CouncilScreen()),
              ),
              icon: const Icon(Icons.groups_outlined),
              label: const Text('Update Committee'),
            ),
          ],
        ),
      ],
    );
  }
}

/// Simple drawn map placeholder; a map package is not needed for the demo.
class _MapPreview extends StatelessWidget {
  const _MapPreview();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Map showing the society location',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          height: 140,
          child: CustomPaint(
            painter: _MapPainter(),
            child: const Center(
              child: Icon(Icons.location_on, color: AppColors.action, size: 36),
            ),
          ),
        ),
      ),
    );
  }
}

class _MapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFFE7F0DF),
    );
    final road = Paint()
      ..color = Colors.white
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(0, size.height * 0.7),
      Offset(size.width, size.height * 0.35),
      road,
    );
    canvas.drawLine(
      Offset(size.width * 0.35, 0),
      Offset(size.width * 0.55, size.height),
      road..strokeWidth = 4,
    );
    final water = Paint()..color = const Color(0xFFCFE3EA);
    canvas.drawOval(
      Rect.fromLTWH(
        size.width * 0.72,
        size.height * 0.55,
        size.width * 0.22,
        size.height * 0.3,
      ),
      water,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
