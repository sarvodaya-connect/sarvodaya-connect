import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../motion/app_motion.dart';
import '../society_record/record_widgets.dart';
import '../society_record/society_record_models.dart' show ActorRef;
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'business_screens.dart';
import 'economy_api.dart';
import 'economy_l10n.dart';
import 'economy_models.dart';
import 'economy_widgets.dart';

/// Issue #146 frame 1: the Village Economic Profile tab of a society record.
/// The businesses the society runs itself, what each produces and the latest
/// figure of each, with its period. Only the assigned Society Officer sees
/// Add business; everyone else in scope sees the same figures, read only.
class EconomicProfileTab extends StatefulWidget {
  const EconomicProfileTab({
    super.key,
    required this.societyId,
    this.initialProfile,
    this.onLoaded,
  });

  final String societyId;

  /// Issue #163: the profile the Overview already loaded, shown at once
  /// instead of being fetched a second time. Pull to refresh reloads it.
  final EconomicProfile? initialProfile;

  /// Told about every profile this tab loads, so the Overview stays current.
  final ValueChanged<EconomicProfile>? onLoaded;

  @override
  State<EconomicProfileTab> createState() => _EconomicProfileTabState();
}

class _EconomicProfileTabState extends State<EconomicProfileTab>
    with AutomaticKeepAliveClientMixin {
  late EconomicProfile? _profile = widget.initialProfile;
  SocietyRecordException? _error;
  bool _loading = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    if (_profile == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }
  }

  /// Keeps what is on screen while it reloads, so the list and its scroll
  /// position stay put; only the first load shows the skeleton.
  Future<void> _load() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = DemoScope.read(context).economy;
    try {
      // The latest figures come with the profile, worked out by the API
      // from each output's whole history.
      final profile = await api.fetchProfile(widget.societyId);
      if (mounted) setState(() => _profile = profile);
      widget.onLoaded?.call(profile);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Opens a screen, then refreshes the cards in place.
  Future<void> _open(Widget screen) async {
    await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final l = context.l10n;
    final profile = _profile;
    final error = _error;
    // Access that has ended (an expired or revoked grant) answers 404; the
    // figures on screen are cleared rather than shown as still permitted.
    if (error != null && (error.status == 403 || error.status == 404)) {
      return NoAccessView(title: l.vepNoAccessTitle, message: l.vepNoAccess);
    }
    if (profile == null) {
      if (error != null) {
        return StateMessage(
          icon: Icons.error_outline,
          tone: StateTone.error,
          isAlert: true,
          title: l.vepLoadError,
          message: l.recNothingLost(l.recordError(error)),
          primaryLabel: l.commonTryAgain,
          onPrimary: _load,
        );
      }
      return LoadingSkeleton(label: l.vepLoading);
    }
    final businesses = profile.businesses;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        key: PageStorageKey('vep.${widget.societyId}'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          ...motionBlocks('vep.${widget.societyId}', [
            RecordNote(icon: Icons.storefront_outlined, message: l.vepIntro),
            if (error != null) ...[
              const SizedBox(height: 10),
              RecordNote(
                icon: Icons.error_outline,
                tone: NoteTone.error,
                title: l.vepLoadError,
                message: l.vepShowingSaved(l.recordError(error)),
              ),
            ],
            const SizedBox(height: 10),
            if (businesses.isNotEmpty) _Summary(profile: profile),
          ]),
          if (businesses.isNotEmpty) const SizedBox(height: 10),
          if (profile.canManage) ...[
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                key: const ValueKey('vep.addBusiness'),
                style: compactFilledStyle,
                onPressed: businesses.length >= maxSocietyBusinesses
                    ? null
                    : () => _open(
                        BusinessFormScreen(
                          societyId: widget.societyId,
                          societyName: profile.societyName,
                          existingIds: {for (final b in businesses) b.id},
                        ),
                      ),
                icon: const Icon(Icons.add, size: 16),
                label: Text(l.vepAddBusiness),
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (businesses.isEmpty)
            RecordCard(
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: AppColors.navIndicator,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.storefront_outlined,
                      color: AppColors.forest,
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Center(
                  child: Text(
                    l.vepEmptyTitle,
                    textAlign: TextAlign.center,
                    style: RecordStyle.cardTitle,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  profile.canManage ? l.vepEmptyManage : l.vepEmptyView,
                  textAlign: TextAlign.center,
                  style: RecordStyle.body,
                ),
              ],
            )
          else
            for (final business in businesses) ...[
              _BusinessCard(
                business: business,
                onOpen: () => _open(
                  BusinessDetailScreen(
                    societyId: widget.societyId,
                    businessId: business.id,
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
          if (!profile.canManage) ...[
            const SizedBox(height: 2),
            RecordNote(icon: Icons.lock_outline, message: l.vepViewOnly),
          ],
          const SizedBox(height: 10),
          Text(
            l.vepSelfReported,
            style: RecordStyle.caption,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// How many businesses, how many operate, how many products and services,
/// and when a business last changed. Figures are never added up here.
class _Summary extends StatelessWidget {
  const _Summary({required this.profile});

  final EconomicProfile profile;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final businesses = profile.businesses;
    final operating = businesses.where((b) => b.status == 'OPERATING').length;
    final outputs = businesses.fold<int>(
      0,
      (sum, business) => sum + business.activeOutputs.length,
    );
    final updated = businesses
        .map((b) => _figuresChange(b).$1)
        .reduce((a, b) => a.isAfter(b) ? a : b);
    return RecordCard(
      children: [
        KeyValueGrid([
          KeyValue(l.vepSummaryBusinesses, l.number(businesses.length)),
          KeyValue(l.vepSummaryOperating, l.number(operating)),
          KeyValue(l.vepSummaryOutputs, l.number(outputs)),
          KeyValue(l.vepSummaryUpdated, l.savedAt(updated)),
        ]),
      ],
    );
  }
}

class _BusinessCard extends StatelessWidget {
  const _BusinessCard({required this.business, required this.onOpen});

  final SocietyBusiness business;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final outputs = business.activeOutputs;
    return MotionPress(
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          key: ValueKey('vep.business.${business.id}'),
          borderRadius: BorderRadius.circular(12),
          onTap: onOpen,
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.line),
            ),
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Semantics(
                            header: true,
                            child: Text(
                              business.name,
                              style: RecordStyle.cardTitle,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            l.businessIndustry(business),
                            style: RecordStyle.caption,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(child: BusinessStatusChip(business.status)),
                    const Icon(
                      Icons.chevron_right,
                      size: 18,
                      color: AppColors.muted,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (outputs.isEmpty)
                  Text(l.vepNoOutputs, style: RecordStyle.caption)
                else
                  for (final (index, output) in outputs.indexed) ...[
                    if (index > 0) const Divider(height: 16),
                    Text(
                      l.withUnit(l.outputName(output), l.unitName(output.unit)),
                      style: RecordStyle.value,
                    ),
                    LatestFigure(
                      measurement: 'ACTUAL',
                      record: output.latest?.actual,
                      known: output.latest != null,
                    ),
                    if (output.latest?.estimated != null)
                      LatestFigure(
                        measurement: 'ESTIMATED',
                        record: output.latest?.estimated,
                      ),
                  ],
                const SizedBox(height: 8),
                Builder(
                  builder: (context) {
                    final (changedAt, who) = _figuresChange(business);
                    return Text(
                      l.vepBusinessUpdated(l.savedAt(changedAt), l.actor(who)),
                      style: RecordStyle.caption,
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The newest change to a business or its latest figures.
(DateTime, ActorRef) _figuresChange(SocietyBusiness business) =>
    lastChange(business, [
      for (final output in business.outputs) ...[
        output.latest?.actual,
        output.latest?.estimated,
      ],
    ]);
