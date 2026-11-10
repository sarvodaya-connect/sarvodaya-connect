import 'package:flutter/material.dart';

import '../format.dart';
import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../models/user.dart';
import '../society_record/society_record_models.dart'
    show documentTypeLabels, registrarDocumentTypes, sdgAsset, sdgTitle;
import '../sarvoai/sarvoai_screen.dart';
import '../society_admin/assign_staff_screen.dart';
import '../society_admin/create_society_screen.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/masthead.dart';
import '../widgets/state_views.dart';
import 'national_api.dart';
import 'national_models.dart';

/// "98,640"
String count(int value) {
  final digits = value.abs().toString();
  final buffer = StringBuffer(value < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// "LKR 312.4 m" for a million or more, "LKR 412,500" below. Pass
/// [notAdded] in the chosen language where a screen is translated.
String lkr(num? value, {String notAdded = 'Not added'}) {
  if (value == null) return notAdded;
  if (value.abs() >= 1000000) {
    final millions = (value / 100000).round() / 10;
    final whole = millions.truncate();
    final tenth = ((millions - whole) * 10).round();
    return 'LKR ${count(whole)}.$tenth m';
  }
  return 'LKR ${count(value.round())}';
}

const _gradeColours = {
  'A': Color(0xFF3F7D4F),
  'B': Color(0xFFE1B84A),
  'C': Color(0xFFDE7C3A),
  'UNGRADED': Color(0xFF7C8A99),
  'NOT_ACTIVE': Color(0xFFA3A8A2),
};

const _female = Color(0xFF7A3F96);
const _male = Color(0xFF2F5590);

/// Loads with [load] and shows the V5 loading, error · retry and HQ-only
/// states (M69b, M69c, M69d) around [builder].
class _Loader<T> extends StatefulWidget {
  const _Loader({
    super.key,
    required this.load,
    required this.builder,
    this.loadingLabel,
  });

  final Future<T> Function(NationalApi api) load;
  final Widget Function(BuildContext context, T data, VoidCallback reload)
  builder;

  /// Defaults to "Loading national figures" in the chosen language.
  final String? loadingLabel;

  @override
  State<_Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<_Loader<T>> {
  Future<T>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= widget.load(DemoScope.of(context).national);
  }

  void _reload() =>
      setState(() => _future = widget.load(DemoScope.of(context).national));

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: _future,
    builder: (context, snapshot) {
      final l = context.l10n;
      if (snapshot.connectionState != ConnectionState.done) {
        return LoadingSkeleton(label: widget.loadingLabel ?? l.nationalLoading);
      }
      final error = snapshot.error;
      if (error is SocietyRecordException && error.status == 403) {
        final user = DemoScope.of(context).user;
        return NoAccessView(
          title: l.nationalHqOnlyTitle,
          message: user == null
              ? l.nationalHqOnlyMessageAnother
              : l.nationalHqOnlyMessage(user.displayName),
          backLabel: l.nationalGoHome,
          onBack: Navigator.of(context).canPop()
              ? () => Navigator.of(context).pop()
              : null,
        );
      }
      if (error is SocietyRecordException && error.status == 404) {
        return const NoAccessView();
      }
      if (error != null) {
        return StateMessage(
          icon: Icons.error_outline,
          title: l.nationalErrorTitle,
          message: error is SocietyRecordException
              ? (error.failure == null
                    ? error.message
                    : l.failure(error.failure!))
              : l.nationalErrorCheck,
          tone: StateTone.error,
          isAlert: true,
          primaryLabel: l.commonTryAgain,
          onPrimary: _reload,
        );
      }
      return RefreshIndicator(
        onRefresh: () async => _reload(),
        child: widget.builder(context, snapshot.data as T, _reload),
      );
    },
  );
}

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.body,
  });

  final String title;
  final String subtitle;
  final Widget body;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      titleSpacing: 0,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
          ),
        ],
      ),
    ),
    body: body,
  );
}

/// Shown only in demonstration mode, so sample figures are never taken as real.
class SampleLabel extends StatelessWidget {
  const SampleLabel({super.key, this.text});

  /// Defaults to "Demonstration data · FY 2025/26" in the chosen language.
  final String? text;

  @override
  Widget build(BuildContext context) {
    if (!DemoStore.demoMode) return const SizedBox.shrink();
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.warningSoft,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE8D28A)),
        ),
        child: Text(
          text ?? context.l10n.nationalDemoData('FY 2025/26'),
          style: const TextStyle(
            fontSize: 11,
            color: AppColors.warning,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({
    required this.child,
    this.colour = AppColors.surface,
    this.border = AppColors.line,
    this.onTap,
  });

  final Widget child;
  final Color colour;
  final Color border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: colour,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: BorderSide(color: border),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(padding: const EdgeInsets.all(12), child: child),
    ),
  );
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text, {this.link, this.onLink});

  final String text;
  final String? link;
  final VoidCallback? onLink;

  @override
  // One line when it fits; the link drops below at larger text sizes.
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
            color: AppColors.leaf,
          ),
        ),
        if (link != null)
          TextButton(
            onPressed: onLink,
            style: TextButton.styleFrom(
              minimumSize: const Size(48, 40),
              padding: const EdgeInsets.symmetric(horizontal: 6),
            ),
            child: Text(
              '$link ›',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    ),
  );
}

/// A tile with a label on top, a big figure and a note.
class _Figure extends StatelessWidget {
  const _Figure(
    this.label,
    this.value,
    this.note, {
    this.colour = AppColors.ink,
    this.background = AppColors.surface,
    this.border = AppColors.line,
    this.onTap,
  });

  final String label;
  final String value;
  final String note;
  final Color colour;
  final Color background;
  final Color border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => _Card(
    colour: background,
    border: border,
    onTap: onTap,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: colour,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w700,
            color: AppColors.ink,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          note,
          style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
        ),
      ],
    ),
  );
}

/// Two cards side by side with equal height.
class _Pair extends StatelessWidget {
  const _Pair(this.left, this.right);

  final Widget left;
  final Widget right;

  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: left),
        const SizedBox(width: 8),
        Expanded(child: right),
      ],
    ),
  );
}

class GradeBadge extends StatelessWidget {
  const GradeBadge(this.grade, {super.key, this.size = 30});

  final String? grade;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    label: grade == null
        ? context.l10n.gradeNone
        : context.l10n.gradeOf(grade!),
    child: ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _gradeColours[grade] ?? AppColors.stateGrey,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          grade ?? '–',
          style: TextStyle(
            color: grade == null ? AppColors.muted : Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: size * 0.5,
          ),
        ),
      ),
    ),
  );
}

/// "A 14 · B 18 · C 66" in the grade colours.
class GradeLine extends StatelessWidget {
  const GradeLine(this.grades, {super.key});

  final GradeCounts grades;

  @override
  Widget build(BuildContext context) {
    TextSpan part(String grade, int value) => TextSpan(
      text: '$grade ${count(value)}',
      style: TextStyle(
        color: grade == 'B' ? const Color(0xFF8A6100) : _gradeColours[grade],
      ),
    );
    const dot = TextSpan(
      text: ' · ',
      style: TextStyle(color: AppColors.muted),
    );
    return Text.rich(
      TextSpan(
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        children: [
          part('A', grades.a),
          dot,
          part('B', grades.b),
          dot,
          part('C', grades.c),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(
    this.text, {
    this.colour = AppColors.warning,
    this.background = AppColors.warningSoft,
  });

  final String text;
  final Color colour;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 11,
        color: colour,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

/// " · Exco 3 of 25" or " · Exco: no Treasurer" for an incomplete Exco
/// (the API's completion), nothing once it is complete.
String _excoNote(int? filled, bool? complete, List<String> missingOffices) =>
    complete != false || filled == null
    ? ''
    : filled == 0
    ? ' · Exco not entered'
    : filled < 25
    ? ' · Exco $filled of 25'
    : missingOffices.isNotEmpty
    ? ' · Exco: no ${missingOffices.join(', ')}'
    : ' · Exco needs checking';

void _push(BuildContext context, Widget screen) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

/// V5 M05h National Dashboard: HQ's home (Overview tab).
class NationalDashboardScreen extends StatelessWidget {
  const NationalDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // At the largest text sizes the header scrolls within this limit, so
            // the figures below always keep their share of the screen.
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: constraints.maxHeight * 0.6,
              ),
              child: const SingleChildScrollView(child: _NationalHeader()),
            ),
            Expanded(
              child: _Loader<NationalOverview>(
                load: (api) => api.fetchOverview(),
                builder: (context, overview, _) => _Overview(overview),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// V5 M05h masthead: logo, search and bell, heading and greeting, the SarvoAI
/// entry point (HQ only; the API checks it too) and the hills.
class _NationalHeader extends StatelessWidget {
  const _NationalHeader();

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final store = DemoScope.of(context);
    final user = store.user;
    final name = user?.displayName.split(' ').first;
    final role = user == null
        ? null
        : user.primaryRole == UserRole.hqAdmin
        ? l.roleHqNational
        : user.primaryRole.label;
    // "Ask SarvoAI" with "AI" in orange, wherever the translation puts it.
    const brand = 'SarvoAI';
    final ask = l.moreAsk(brand);
    final at = ask.indexOf(brand);
    return ColoredBox(
      color: AppColors.surface,
      child: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            const Positioned.fill(
              child: ExcludeSemantics(
                child: CustomPaint(painter: HillsPainter()),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 12, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const MastheadLogo(),
                      const Spacer(),
                      // The phone has no search across all records (D18 is on
                      // the dashboard), so this says what it searches.
                      MastheadButton(
                        tooltip: l.nationalSearchSocieties,
                        icon: const Icon(
                          Icons.search,
                          size: 19,
                          color: AppColors.ink,
                        ),
                        onPressed: () => _push(
                          context,
                          const NationalSocietiesScreen(autofocusSearch: true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const NotificationsButton(),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Semantics(
                    header: true,
                    child: Text(
                      l.nationalTitle,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                        height: 1.15,
                      ),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [l.greeting(store.now, name), ?role].join(' · '),
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Material(
                    color: AppColors.pine,
                    shape: const StadiumBorder(),
                    child: InkWell(
                      customBorder: const StadiumBorder(),
                      onTap: () => _push(context, const SarvoAiScreen()),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.auto_awesome,
                              size: 18,
                              color: Color(0xFFF3C44E),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Wrap(
                                alignment: WrapAlignment.spaceBetween,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text.rich(
                                    TextSpan(
                                      children: [
                                        TextSpan(
                                          text: ask.substring(0, at + 5),
                                        ),
                                        const TextSpan(
                                          text: 'AI',
                                          style: TextStyle(
                                            color: Color(0xFFF0A040),
                                          ),
                                        ),
                                        TextSpan(text: ask.substring(at + 7)),
                                      ],
                                    ),
                                    semanticsLabel: ask,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    l.nationalHqOnly,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview(this.overview);

  final NationalOverview overview;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final audit = overview.auditReport;
    final links = <(String, Widget)>[
      (l.navDistricts, const DistrictsScreen(standalone: true)),
      (l.nationalLinkMap, const SocietyMapScreen()),
      (l.nationalLinkMembership, const NationalMembershipScreen()),
      (l.nationalLinkAudit, const AuditAgmScreen()),
      (l.nationalLinkProfit, const ProfitExpensesScreen()),
      (l.nationalLinkActivities, const NationalActivitiesScreen()),
    ];
    final sampleSocieties = DemoStore.demoMode
        ? l.nationalSampleSocieties(overview.societiesWithBoth)
        : l.nationalSocieties(overview.societiesWithBoth);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        SizedBox(
          height: 48,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: links.length,
            separatorBuilder: (_, _) => const SizedBox(width: 6),
            itemBuilder: (context, index) => Center(
              child: ActionChip(
                label: Text(links[index].$1),
                onPressed: () => _push(context, links[index].$2),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        SampleLabel(text: l.nationalDemoData(overview.year.label)),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Eyebrow(
                l.nationalSectionStatus,
                link: l.navDistricts,
                onLink: () =>
                    _push(context, const DistrictsScreen(standalone: true)),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Flexible(
                    child: _Headline(
                      l.nationalRegistered,
                      l.number(overview.registered),
                      AppColors.ink,
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    child: Icon(
                      Icons.arrow_forward,
                      size: 18,
                      color: AppColors.muted,
                    ),
                  ),
                  Flexible(
                    child: _Headline(
                      l.nationalActive,
                      l.number(overview.active),
                      AppColors.leaf,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              GradeLine(overview.grades),
              const SizedBox(height: 4),
              Text(
                l.nationalStatusNote(
                  overview.notUpdatedIn90Days,
                  overview.gradeRequestsWaiting,
                ),
                style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        _Pair(
          _Figure(
            l.nationalSectionMembers,
            l.number(overview.members),
            l.nationalFemaleMaleShare(
              sharePercent(overview.female, overview.members),
              sharePercent(overview.male, overview.members),
            ),
            colour: _female,
            background: const Color(0xFFF6EFF9),
            border: const Color(0xFFE4D3EC),
            onTap: () => _push(context, const NationalMembershipScreen()),
          ),
          _Figure(
            l.nationalSectionAudit,
            '${sharePercent(audit.submitted, overview.active)}%',
            l.nationalUploadedOf(audit.submitted, overview.active),
            colour: AppColors.leaf,
            background: const Color(0xFFEEF6EF),
            border: const Color(0xFFCFE3D3),
            onTap: () => _push(context, const AuditAgmScreen()),
          ),
        ),
        const SizedBox(height: 8),
        _Pair(
          _Figure(
            l.nationalSectionProfit,
            lkr(overview.totalProfit, notAdded: l.nationalNotAdded),
            sampleSocieties,
            colour: AppColors.leaf,
            onTap: () => _push(context, const ProfitExpensesScreen()),
          ),
          _Figure(
            l.nationalSectionExpenses,
            lkr(overview.totalExpenses, notAdded: l.nationalNotAdded),
            sampleSocieties,
            colour: const Color(0xFF9A4F12),
            background: const Color(0xFFFDF3EA),
            border: const Color(0xFFF0D9C4),
            onTap: () => _push(context, const ProfitExpensesScreen()),
          ),
        ),
        const SizedBox(height: 8),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Eyebrow(
                l.nationalSectionActivities,
                link: l.nationalLinkActivities,
                onLink: () => _push(context, const NationalActivitiesScreen()),
              ),
              Text.rich(
                TextSpan(
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  children: styledSpans(
                    l.nationalCompletedOf(
                      styledSlot,
                      overview.planned,
                      sharePercent(overview.completed, overview.planned),
                    ),
                    TextSpan(
                      text: l.number(overview.completed),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                l.nationalTopSdgs(overview.year.label),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              if (overview.topSdgs.isEmpty)
                Text(
                  l.nationalNoSdgYet,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                )
              else
                Row(
                  children: [
                    for (final (index, row)
                        in overview.topSdgs.take(3).indexed) ...[
                      if (index > 0) const SizedBox(width: 6),
                      Expanded(child: _SdgTile(row, rank: index + 1)),
                    ],
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// A small label over a large figure that shrinks rather than overflowing.
class _Headline extends StatelessWidget {
  const _Headline(this.label, this.value, this.colour);

  final String label;
  final String value;
  final Color colour;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: colour,
          ),
        ),
      ),
    ],
  );
}

class _SdgTile extends StatelessWidget {
  const _SdgTile(this.row, {required this.rank});

  final SdgCount row;
  final int rank;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: context.l10n.nationalSdgTile(
      rank,
      row.sdg,
      sdgTitle(row.sdg),
      row.completed,
    ),
    child: ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: AspectRatio(
              aspectRatio: 1,
              child: Image.asset(sdgAsset(row.sdg), fit: BoxFit.cover),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            context.l10n.number(row.completed),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          Text(
            'SDG ${row.sdg}',
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
      ),
    ),
  );
}

/// V5 M65 Districts: alphabetical, never ranked (HQ tab, or opened from M05h).
class DistrictsScreen extends StatefulWidget {
  const DistrictsScreen({super.key, this.standalone = false});

  final bool standalone;

  @override
  State<DistrictsScreen> createState() => _DistrictsScreenState();
}

class _DistrictsScreenState extends State<DistrictsScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final body = _Loader<List<DistrictFigures>>(
      loadingLabel: l.nationalDistrictsLoading,
      load: (api) => api.fetchDistricts(),
      builder: (context, districts, _) {
        final shown = districts
            .where(
              (row) => row.name.toLowerCase().contains(_search.toLowerCase()),
            )
            .toList();
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            TextField(
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: l.nationalDistrictsFind,
              ),
              onChanged: (value) => setState(() => _search = value.trim()),
            ),
            const SizedBox(height: 10),
            const SampleLabel(),
            if (shown.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 40),
                child: StateMessage(
                  icon: Icons.search,
                  title: l.nationalDistrictsNoMatch,
                  message: l.nationalDistrictsTryAnother,
                ),
              ),
            for (final district in shown) ...[
              _Card(
                onTap: () => _push(
                  context,
                  NationalSocietiesScreen(
                    initial: DirectoryQuery(
                      districtId: district.id,
                      districtName: district.name,
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            district.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        _Pill(
                          l.nationalDistrictAudit(district.auditPercent),
                          colour: district.auditPercent >= 85
                              ? AppColors.leaf
                              : district.auditPercent >= 70
                              ? AppColors.warning
                              : AppColors.danger,
                          background: district.auditPercent >= 85
                              ? AppColors.mint
                              : district.auditPercent >= 70
                              ? AppColors.warningSoft
                              : AppColors.dangerSoft,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l.nationalDistrictLine(
                        (district.province ?? '').replaceAll(' Province', ''),
                        district.active,
                        district.members,
                        district.recordsCompletePercent,
                      ),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.inkBody,
                      ),
                    ),
                    const SizedBox(height: 4),
                    GradeLine(district.grades),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
          ],
        );
      },
    );
    if (!widget.standalone) {
      return Scaffold(
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(
                  l.navDistricts,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: Text(
                  l.nationalDistrictsSubtitle,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ),
              Expanded(child: body),
            ],
          ),
        ),
      );
    }
    return _Page(
      title: l.navDistricts,
      subtitle: l.nationalDistrictsSubtitle,
      body: body,
    );
  }
}

/// V5 M66 Societies: the directory, filtered by district, class or 90+ days.
class NationalSocietiesScreen extends StatefulWidget {
  const NationalSocietiesScreen({
    super.key,
    this.initial = const DirectoryQuery(),
    this.asTab = false,
    this.autofocusSearch = false,
  });

  final DirectoryQuery initial;
  final bool asTab;

  /// Opened from the masthead's search button: ready to type.
  final bool autofocusSearch;

  @override
  State<NationalSocietiesScreen> createState() =>
      _NationalSocietiesScreenState();
}

class _NationalSocietiesScreenState extends State<NationalSocietiesScreen> {
  late DirectoryQuery _query = widget.initial;
  int _version = 0;

  void _set(DirectoryQuery query) => setState(() {
    _query = query;
    _version++;
  });

  @override
  Widget build(BuildContext context) {
    final list = _Loader<DirectoryPage>(
      key: ValueKey(_version),
      loadingLabel: 'Loading societies',
      load: (api) => api.fetchDirectory(_query),
      builder: (context, page, _) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          if (page.rows.isEmpty)
            StateMessage(
              icon: Icons.search,
              title: 'No Societies Match',
              message: _query.filtered
                  ? 'Try fewer filters.'
                  : 'No society is in your view yet.',
              primaryLabel: _query.filtered ? 'Clear all filters' : null,
              onPrimary: () => _set(const DirectoryQuery()),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${count(page.total)} active societies',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.muted,
                    ),
                  ),
                ),
                GradeLine(page.grades),
              ],
            ),
            const SizedBox(height: 6),
            Material(
              color: AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.line),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (final (index, row) in page.rows.indexed) ...[
                    if (index > 0) const Divider(height: 1),
                    ListTile(
                      leading: GradeBadge(row.grade),
                      title: Text(
                        row.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      subtitle: Text(
                        '${row.societyCode}${row.members == null ? '' : ' · ${count(row.members!)} members'} · ${row.figuresAdded ? 'updated ${formatDate(row.updatedAt)}' : 'figures not added'}${_excoNote(row.excoSeatsFilled, row.excoComplete, row.excoMissingOffices)}',
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: row.requestedGrade != null
                          ? _Pill('${row.grade ?? '–'} → ${row.requestedGrade}')
                          : row.notUpdatedIn90Days
                          ? const _Pill(
                              '90+ days',
                              colour: AppColors.danger,
                              background: AppColors.dangerSoft,
                            )
                          : !row.figuresAdded
                          ? const _Pill('Not added')
                          : const Icon(Icons.chevron_right),
                      onTap: () => _push(
                        context,
                        SocietySummaryScreen(societyId: row.id),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
    final filters = Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            autofocus: widget.autofocusSearch,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Name or S number',
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: (value) => _set(_query.copyWith(search: value.trim())),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              if (_query.districtId != null)
                InputChip(
                  label: Text('District: ${_query.districtName ?? 'chosen'}'),
                  selected: true,
                  deleteIconColor: Colors.white,
                  onDeleted: () => _set(_query.copyWith(district: () => null)),
                  deleteButtonTooltipMessage: 'Remove the district filter',
                ),
              PopupMenuButton<String?>(
                tooltip: 'Class',
                onSelected: (grade) =>
                    _set(_query.copyWith(grade: () => grade)),
                itemBuilder: (_) => [
                  const PopupMenuItem(value: null, child: Text('All classes')),
                  for (final grade in ['A', 'B', 'C'])
                    PopupMenuItem(value: grade, child: Text('Class $grade')),
                ],
                child: Chip(label: Text('Class: ${_query.grade ?? 'All'}')),
              ),
              FilterChip(
                label: const Text('90+ Days'),
                selected: _query.notUpdated,
                onSelected: (value) => _set(_query.copyWith(notUpdated: value)),
              ),
            ],
          ),
        ],
      ),
    );
    final body = Column(
      children: [
        filters,
        Expanded(child: list),
      ],
    );
    final subtitle = _query.districtName == null
        ? 'Active societies'
        : 'Filtered to ${_query.districtName}';
    if (widget.asTab) {
      return Scaffold(
        // V5 D05n on the phone: HQ creates a society, then assigns its staff.
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () async {
            await Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const CreateSocietyScreen(),
              ),
            );
            if (mounted) setState(() => _version++);
          },
          icon: const Icon(Icons.add),
          label: const Text('Create society'),
        ),
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(
                  'Societies',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ),
              Expanded(child: body),
            ],
          ),
        ),
      );
    }
    return _Page(title: 'Societies', subtitle: subtitle, body: body);
  }
}

/// V5 M67 Society summary.
class SocietySummaryScreen extends StatelessWidget {
  const SocietySummaryScreen({super.key, required this.societyId});

  final String societyId;

  @override
  Widget build(BuildContext context) => _Page(
    title: 'Society Summary',
    subtitle: 'Counts and yearly totals',
    body: _Loader<SocietyAtAGlance>(
      loadingLabel: 'Loading the society',
      load: (api) => api.fetchSociety(societyId),
      builder: (context, society, _) {
        final uploaded = society.uploaded.values.where((value) => value).length;
        final completeTone = society.recordsCompletePercent >= 90;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _Card(
              child: Row(
                children: [
                  GradeBadge(society.grade, size: 40),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          society.name,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${society.societyCode} · ${society.district} · ${society.hasSocietyOfficer ? 'updated ${formatDate(society.updatedAt)}' : 'no Society Officer'}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _Pair(
              _Figure(
                'Members',
                society.members == null
                    ? 'Not entered'
                    : count(society.members!),
                society.membershipYear == null
                    ? 'No counts yet'
                    : '${society.membershipYear}',
              ),
              _Figure(
                'Records Complete',
                '${society.recordsCompletePercent}%',
                society.missingFields == 0
                    ? 'Every field entered'
                    : '${society.missingFields} fields missing',
                colour: completeTone ? AppColors.leaf : AppColors.warning,
                background: completeTone
                    ? const Color(0xFFEEF6EF)
                    : AppColors.warningSoft,
              ),
            ),
            const SizedBox(height: 8),
            _Pair(
              _Figure(
                'Profit for the Year',
                lkr(society.profit),
                society.profit == null
                    ? 'Waiting for the society'
                    : society.year.label,
                colour: AppColors.leaf,
              ),
              _Figure(
                'Expenses for the Year',
                lkr(society.expenses),
                society.expenses == null
                    ? 'Waiting for the society'
                    : society.year.label,
                colour: const Color(0xFF9A4F12),
              ),
            ),
            const SizedBox(height: 8),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Eyebrow(
                    'Registrar Documents · $uploaded of ${registrarDocumentTypes.length}',
                  ),
                  for (final type in registrarDocumentTypes)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              documentTypeLabels[type] ?? type,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          society.uploaded[type] == true
                              ? const _Pill(
                                  'Uploaded',
                                  colour: AppColors.leaf,
                                  background: AppColors.mint,
                                )
                              : type == 'AUDIT_REPORT' && society.auditPastDue
                              ? const _Pill(
                                  'Past due',
                                  colour: AppColors.danger,
                                  background: AppColors.dangerSoft,
                                )
                              : const _Pill('Missing'),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            if (!society.hasSocietyOfficer) ...[
              const SizedBox(height: 8),
              NoticeBanner(
                icon: Icons.warning_amber_outlined,
                title: '${society.name} Has No Society Officer',
                message: society.spcName == null
                    ? 'Its SPC adds the yearly figures and the audit report. Assign a Society Officer to enter the Exco.'
                    : 'Its SPC, ${society.spcName}, adds the yearly figures and the audit report. Assign a Society Officer to enter the Exco.',
              ),
            ],
            if (society.excoComplete == false) ...[
              const SizedBox(height: 8),
              NoticeBanner(
                icon: Icons.groups_outlined,
                tone: NoticeTone.warning,
                title: society.excoSeatsFilled == 0
                    ? 'Exco not entered yet'
                    : (society.excoSeatsFilled ?? 0) < 25
                    ? 'Exco incomplete · ${society.excoSeatsFilled} of 25'
                    : society.excoMissingOffices.isNotEmpty
                    ? 'Exco incomplete · no ${society.excoMissingOffices.join(', ')} chosen'
                    : 'Exco incomplete · needs checking',
                message: 'The Society Officer enters the Exco and can save it as they go. HQ can also add members from the society record.',
              ),
            ],
            const SizedBox(height: 8),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (society.gradeRequest != null) ...[
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Grade change ${society.gradeRequest}',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        const _Pill('Waiting for HQ'),
                      ],
                    ),
                    const Divider(height: 18),
                  ],
                  Text(
                    'Activities this year: ${society.approved} of ${society.planned} approved',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (society.latestActivity != null)
                    Text(
                      'Latest: ${society.latestActivity}${society.latestSdgs.isEmpty ? '' : ' · SDG ${society.latestSdgs.join(', ')}'}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.muted,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () =>
                  _push(context, SocietyRecordScreen(societyId: society.id)),
              child: const Text('Open society record'),
            ),
            const SizedBox(height: 8),
            // V5 D05a on the phone. The server allows it to HQ only.
            OutlinedButton.icon(
              onPressed: () => _push(
                context,
                AssignStaffScreen(
                  societyId: society.id,
                  societyName: society.name,
                ),
              ),
              icon: const Icon(Icons.manage_accounts_outlined, size: 18),
              label: Text(
                society.hasSocietyOfficer
                    ? 'Change assigned staff'
                    : 'Assign staff',
              ),
            ),
          ],
        );
      },
    ),
  );
}

/// The island outline in latitude and longitude, simplified by hand.
const _outline = [
  (9.82, 79.95),
  (9.83, 80.25),
  (9.6, 80.42),
  (9.3, 80.6),
  (8.95, 80.95),
  (8.55, 81.22),
  (8.2, 81.4),
  (7.85, 81.62),
  (7.45, 81.83),
  (7.0, 81.88),
  (6.65, 81.8),
  (6.25, 81.62),
  (6.12, 81.3),
  (6.03, 80.95),
  (5.93, 80.6),
  (6.03, 80.25),
  (6.25, 80.05),
  (6.6, 79.95),
  (7.05, 79.84),
  (7.5, 79.82),
  (8.0, 79.78),
  (8.4, 79.85),
  (8.75, 79.92),
  (9.05, 79.95),
  (9.3, 80.1),
  (9.55, 80.05),
];

Offset _project(double lat, double lng, Size size) =>
    Offset((lng - 79.5) / 2.5 * size.width, (9.95 - lat) / 4.1 * size.height);

class _MapPainter extends CustomPainter {
  _MapPainter(this.points, this.selected);

  final List<MapPoint> points;
  final String? selected;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path();
    for (final (index, (lat, lng)) in _outline.indexed) {
      final offset = _project(lat, lng, size);
      index == 0
          ? path.moveTo(offset.dx, offset.dy)
          : path.lineTo(offset.dx, offset.dy);
    }
    path.close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFF7F5EC));
    canvas.drawPath(
      path,
      Paint()
        ..color = const Color(0xFFB9BDB2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
    for (final point in points) {
      final offset = _project(point.lat, point.lng, size);
      final chosen = point.id == selected;
      canvas.drawCircle(
        offset,
        chosen ? 7 : 3.5,
        Paint()..color = _gradeColours[point.societyClass]!,
      );
      if (chosen) {
        canvas.drawCircle(
          offset,
          10,
          Paint()
            ..color = AppColors.ink
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_MapPainter old) =>
      old.points != points || old.selected != selected;
}

/// V5 M64 Map: active societies by class; tap a dot for its summary.
class SocietyMapScreen extends StatefulWidget {
  const SocietyMapScreen({super.key});

  @override
  State<SocietyMapScreen> createState() => _SocietyMapScreenState();
}

class _SocietyMapScreenState extends State<SocietyMapScreen> {
  MapPoint? _selected;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return _Page(
      title: l.nationalMapTitle,
      subtitle: l.nationalMapSubtitle,
      body: _Loader<SocietyMapData>(
        loadingLabel: l.nationalMapLoading,
        load: (api) => api.fetchMap(),
        builder: (context, map, _) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  for (final (grade, value) in [
                    ('A', map.counts.a),
                    ('B', map.counts.b),
                    ('C', map.counts.c),
                    ('NOT_ACTIVE', map.notActive),
                  ])
                    Chip(
                      avatar: CircleAvatar(
                        backgroundColor: _gradeColours[grade],
                        radius: 5,
                      ),
                      label: Text(
                        grade == 'NOT_ACTIVE'
                            ? l.nationalMapNotActive(value)
                            : '$grade ${l.number(value)}',
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SampleLabel(text: l.nationalDemoPositions),
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final height = constraints.maxHeight;
                  final width = (height * 2.5 / 4.1).clamp(
                    0.0,
                    constraints.maxWidth,
                  );
                  final size = Size(width, width * 4.1 / 2.5);
                  return Center(
                    child: Semantics(
                      label: l.nationalMapSemantics(map.points.length),
                      child: GestureDetector(
                        onTapUp: (details) {
                          MapPoint? nearest;
                          var best = 24.0 * 24.0;
                          for (final point in map.points) {
                            final distance =
                                (_project(point.lat, point.lng, size) -
                                        details.localPosition)
                                    .distanceSquared;
                            if (distance < best) {
                              best = distance;
                              nearest = point;
                            }
                          }
                          setState(() => _selected = nearest);
                        },
                        child: CustomPaint(
                          size: size,
                          painter: _MapPainter(map.points, _selected?.id),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            if (_selected != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                child: _Card(
                  onTap: _selected!.id.startsWith('sample-')
                      ? null
                      : () => _push(
                          context,
                          SocietySummaryScreen(societyId: _selected!.id),
                        ),
                  child: Row(
                    children: [
                      GradeBadge(
                        ['A', 'B', 'C'].contains(_selected!.societyClass)
                            ? _selected!.societyClass
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _selected!.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (!_selected!.id.startsWith('sample-'))
                        const Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// V5 M61 Membership: counts only, no personal data.
class NationalMembershipScreen extends StatelessWidget {
  const NationalMembershipScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return _Page(
      title: l.nationalMembershipTitle,
      subtitle: l.nationalMembershipSubtitle,
      body: _Loader<NationalOverview>(
        load: (api) => api.fetchOverview(),
        builder: (context, overview, _) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            SampleLabel(
              text: overview.membershipYear == null
                  ? l.nationalDemoDataPlain
                  : l.nationalDemoData('${overview.membershipYear}'),
            ),
            _Pair(
              _Figure(
                l.nationalTotalMembers,
                l.number(overview.members),
                l.nationalSocietiesReported(overview.societiesReported),
              ),
              _Figure(
                l.nationalFemaleMale,
                '${sharePercent(overview.female, overview.members)}% · ${sharePercent(overview.male, overview.members)}%',
                '${l.number(overview.female)} · ${l.number(overview.male)}',
                colour: _female,
                background: const Color(0xFFF6EFF9),
                border: const Color(0xFFE4D3EC),
              ),
            ),
            const SizedBox(height: 8),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Eyebrow(l.nationalByCategory),
                  for (final row in overview.categories)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _categoryLabel(l, row.category),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text(
                                l.number(row.total),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          Text.rich(
                            TextSpan(
                              style: const TextStyle(fontSize: 12),
                              children: styledSpans2(
                                l.nationalCategoryShare(
                                  styledSlot,
                                  styledSlot2,
                                  row.female,
                                  row.male,
                                ),
                                TextSpan(
                                  text:
                                      '${sharePercent(row.female, row.total)}%',
                                  style: const TextStyle(
                                    color: _female,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                TextSpan(
                                  text: '${sharePercent(row.male, row.total)}%',
                                  style: const TextStyle(
                                    color: _male,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            NoticeBanner(
              icon: Icons.info_outline,
              title: l.nationalCountsOnlyTitle,
              message: l.nationalCountsOnlyMessage,
            ),
          ],
        ),
      ),
    );
  }
}

/// A membership category's label in the chosen language; the API's value
/// stays as sent.
String _categoryLabel(AppLocalizations l, String category) =>
    switch (category) {
      'CHILDREN' => l.membershipChildren,
      'YOUTH' => l.membershipYouth,
      'MOTHERS' => l.membershipMothers,
      'ORDINARY' => l.membershipOrdinary,
      'ELDERS_COUNCIL' => l.membershipElders,
      _ => membershipCategoryLabels[category] ?? category,
    };

/// V5 M62a Audit & AGM: the audit report and the other Registrar documents.
class AuditAgmScreen extends StatelessWidget {
  const AuditAgmScreen({super.key});

  @override
  Widget build(BuildContext context) => _Page(
    title: 'Audit & AGM',
    subtitle: 'Audit report and Registrar documents',
    body: _Loader<NationalOverview>(
      load: (api) => api.fetchOverview(),
      builder: (context, overview, _) {
        final audit = overview.auditReport;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            SampleLabel(text: 'Demonstration data · ${overview.year.label}'),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${sharePercent(audit.submitted, overview.active)}%',
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: AppColors.leaf,
                    ),
                  ),
                  Text(
                    '${count(audit.submitted)} of ${count(overview.active)} active societies have uploaded an audit report for ${overview.year.label}.',
                    style: const TextStyle(fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  _Pair(
                    _Figure(
                      'Uploaded',
                      count(audit.submitted),
                      overview.year.label,
                      colour: AppColors.leaf,
                    ),
                    _Figure(
                      overview.auditPastDue ? 'Past due' : 'Not yet',
                      count(audit.missing),
                      overview.auditPastDue ? 'After 30 Sep' : 'Due 30 Sep',
                      colour: overview.auditPastDue
                          ? AppColors.danger
                          : AppColors.warning,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Eyebrow('4 Registrar Documents · ${overview.year.label}'),
                  for (final row in overview.documentCounts)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              documentTypeLabels[row.documentType] ??
                                  row.documentType,
                            ),
                          ),
                          Text(
                            '${count(row.submitted)} · ${sharePercent(row.submitted, overview.active)}%',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  Text(
                    '${count(overview.allFour)} societies have all four · ${sharePercent(overview.allFour, overview.active)}%',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    ),
  );
}

/// V5 M62b Profit & expenses: the only two yearly figures societies enter.
class ProfitExpensesScreen extends StatelessWidget {
  const ProfitExpensesScreen({super.key});

  @override
  Widget build(BuildContext context) => _Page(
    title: 'Profit & Expenses',
    subtitle: 'The only two yearly figures societies enter',
    body: _Loader<(NationalOverview, FiguresNotAdded)>(
      load: (api) async =>
          (await api.fetchOverview(), await api.fetchFiguresNotAdded()),
      builder: (context, data, _) {
        final (overview, missing) = data;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            SampleLabel(text: 'Demonstration data · ${overview.year.label}'),
            _Figure(
              'Total Profit for the Year',
              lkr(overview.totalProfit),
              '${overview.year.label} · from ${count(overview.societiesWithBoth)} active societies',
              colour: AppColors.leaf,
              background: const Color(0xFFEEF6EF),
              border: const Color(0xFFCFE3D3),
            ),
            const SizedBox(height: 8),
            _Figure(
              'Total Expenses for the Year',
              lkr(overview.totalExpenses),
              '${overview.year.label} · from ${count(overview.societiesWithBoth)} active societies',
              colour: const Color(0xFF9A4F12),
              background: const Color(0xFFFDF3EA),
              border: const Color(0xFFF0D9C4),
            ),
            const SizedBox(height: 8),
            _Card(
              child: Text(
                '${count(overview.societiesWithBoth)} of ${count(overview.active)} societies submitted both figures — ${sharePercent(overview.societiesWithBoth, overview.active)}% · ${count(missing.total)} not submitted',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 8),
            const NoticeBanner(
              icon: Icons.info_outline,
              title: 'Two Yearly Totals Only',
              message: 'Each society enters only its total profit and total expenses, with its audit report. No other financial details are kept.',
            ),
            const SizedBox(height: 12),
            Text(
              'Not Added Yet · ${count(missing.total)}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.muted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 6),
            for (final (id, name, district) in missing.societies) ...[
              _Card(
                onTap: () =>
                    _push(context, SocietySummaryScreen(societyId: id)),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          Text(
                            district,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const _Pill('Not added'),
                  ],
                ),
              ),
              const SizedBox(height: 6),
            ],
          ],
        );
      },
    ),
  );
}

/// V5 M63 Activities: done vs planned, SPC-approved only.
class NationalActivitiesScreen extends StatefulWidget {
  const NationalActivitiesScreen({super.key});

  @override
  State<NationalActivitiesScreen> createState() =>
      _NationalActivitiesScreenState();
}

class _NationalActivitiesScreenState extends State<NationalActivitiesScreen> {
  bool _bySector = true;

  @override
  Widget build(BuildContext context) => _Page(
    title: 'Activities',
    subtitle: 'Done vs planned · SPC-approved only',
    body: _Loader<NationalProgrammes>(
      load: (api) => api.fetchProgrammes(),
      builder: (context, programmes, _) {
        final ranked = programmes.sdgs
            .where((row) => row.completed > 0)
            .toList();
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            SampleLabel(text: 'Demonstration data · ${programmes.year.label}'),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: count(programmes.completed),
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        TextSpan(
                          text:
                              ' of ${count(programmes.planned)} planned completed — ${sharePercent(programmes.completed, programmes.planned)}%',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: true, label: Text('10 Sectors')),
                      ButtonSegment(value: false, label: Text('Dimensions')),
                    ],
                    selected: {_bySector},
                    onSelectionChanged: (value) =>
                        setState(() => _bySector = value.first),
                  ),
                  const SizedBox(height: 6),
                  if (_bySector)
                    for (final (
                          index,
                          MapEntry(key: sector, value: (done, planned)),
                        )
                        in programmes.sectors.entries.indexed)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 11,
                              backgroundColor: AppColors.leaf,
                              child: Text(
                                '${index + 1}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(sector)),
                            Text(
                              '${count(done)} / ${count(planned)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      )
                  else
                    for (final row in programmes.byDimension)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${row.dimension[0]}${row.dimension.substring(1).toLowerCase()}',
                              ),
                            ),
                            Text(
                              '${count(row.completed)} / ${count(row.planned)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Eyebrow('UN SDGs · Ranked by Completed Activities'),
                  Text(
                    '${programmes.year.label} · equal counts listed by SDG number',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.muted,
                    ),
                  ),
                  if (ranked.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text('No completed activity with a UN SDG yet.'),
                    ),
                  for (final (index, row) in ranked.indexed)
                    Semantics(
                      container: true,
                      label:
                          'Number ${index + 1}, SDG ${row.sdg}: ${sdgTitle(row.sdg)}, ${count(row.completed)} completed',
                      child: ExcludeSemantics(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 28,
                                child: Text(
                                  '#${index + 1}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                  ),
                                ),
                              ),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: Image.asset(
                                  sdgAsset(row.sdg),
                                  width: 48,
                                  height: 48,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'SDG ${row.sdg}\n${sdgTitle(row.sdg)}',
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                              Text(
                                count(row.completed),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    ),
  );
}
