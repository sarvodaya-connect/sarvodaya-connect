import 'package:flutter/material.dart';

import '../models/user.dart';
import '../national/national_screens.dart' show count;
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import 'sarvoai_api.dart';

const _examples = [
  (Icons.person_outline, 'Who is the president of Pahala Kosgama SSS?'),
  (
    Icons.insert_chart_outlined,
    'What was the average profit for societies in Kurunegala in FY 2025/26?',
  ),
  (
    Icons.bar_chart,
    'Which societies had more than LKR 100,000 profit in the last five years?',
  ),
  (
    Icons.description_outlined,
    'Which societies have not submitted their profit and expense figures for FY 2025/26?',
  ),
];

const _gold = Color(0xFFF3C44E);
const _orange = Color(0xFFF0A040);

class _Turn {
  _Turn(this.question);

  final String question;
  SarvoAiAnswer? answer;
  SarvoAiException? error;
  bool stopped = false;

  bool get waiting => answer == null && error == null && !stopped;
}

/// V5 M80–M89f SarvoAI on the phone (HQ only). Every question goes to the
/// API, which refuses other roles; the screen also shows them M89f.
class SarvoAiScreen extends StatefulWidget {
  const SarvoAiScreen({super.key});

  @override
  State<SarvoAiScreen> createState() => _SarvoAiScreenState();
}

class _SarvoAiScreenState extends State<SarvoAiScreen> {
  final _turns = <_Turn>[];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _refused = false;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  bool get _working => _turns.isNotEmpty && _turns.last.waiting;

  List<({String role, String text})> _history(Iterable<_Turn> turns) => [
    for (final turn in turns)
      if (turn.answer != null) ...[
        (role: 'user', text: turn.question),
        (role: 'assistant', text: turn.answer!.summary),
      ],
  ];

  Future<void> _ask(String text, {int? upTo}) async {
    final question = text.trim();
    if (question.length < 3 || _working) return;
    final base = upTo == null ? _turns : _turns.sublist(0, upTo);
    final history = _history(base);
    final turn = _Turn(question);
    setState(() {
      if (upTo != null) _turns.removeRange(upTo, _turns.length);
      _turns.add(turn);
      _input.clear();
    });
    try {
      final answer = await DemoScope.of(context).sarvoAi
          .ask(question, history: history);
      if (!mounted || turn.stopped) return;
      setState(() => turn.answer = answer);
    } on SarvoAiException catch (error) {
      if (!mounted || turn.stopped) return;
      setState(() {
        turn.error = error;
        _refused = error.status == 403;
      });
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _edit(String question) => setState(() => _input.text = question);

  @override
  Widget build(BuildContext context) {
    final user = DemoScope.of(context).user;
    final isHq = user?.roles.contains(UserRole.hqAdmin) == true;
    final demo = DemoStore.demoMode;
    if (!isHq || _refused) {
      return Scaffold(
        appBar: AppBar(
          title: const _Title('SarvoAI', 'Opened from a shared link'),
        ),
        body: NoAccessView(
          title: 'SarvoAI is for HQ only',
          message:
              'You are signed in as ${user?.displayName ?? 'another account'}${user == null ? '' : ' (${user.primaryRole.label})'}. Nothing from this link is shown.',
          backLabel: 'Go to my home',
          onBack: () => Navigator.of(context).maybePop(),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: _Title(
          'SarvoAI',
          demo && _turns.isNotEmpty ? 'HQ only · sample data' : 'HQ only',
        ),
        actions: [
          if (_turns.isNotEmpty)
            IconButton(
              tooltip: 'New question',
              onPressed: _working ? null : () => setState(_turns.clear),
              icon: const Icon(Icons.add),
            ),
        ],
      ),
      body: _turns.isEmpty ? _welcome() : _conversation(),
      bottomNavigationBar: _turns.isEmpty ? null : _composer(),
    );
  }

  Widget _welcome() => ListView(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
    children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.pine,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Icon(Icons.auto_awesome, color: _gold),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        header: true,
                        label: 'SarvoAI',
                        child: ExcludeSemantics(
                          child: Text.rich(
                            const TextSpan(
                              children: [
                                TextSpan(text: 'Sarvo '),
                                TextSpan(
                                  text: 'AI',
                                  style: TextStyle(color: _orange),
                                ),
                              ],
                            ),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w300,
                            ),
                          ),
                        ),
                      ),
                      const Text(
                        'Collective Wisdom. Intelligent Impact.',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      const Text(
                        'Societies, Exco and yearly profit and expenses',
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _askField('Ask about societies or yearly figures…', onDark: true),
          ],
        ),
      ),
      const SizedBox(height: 16),
      const Text(
        'TRY ASKING',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
          color: AppColors.inkSoft,
        ),
      ),
      const SizedBox(height: 8),
      for (final (icon, question) in _examples) ...[
        Material(
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.line),
          ),
          child: ListTile(
            leading: CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.mint,
              child: Icon(icon, size: 18, color: AppColors.leaf),
            ),
            title: Text(question, style: const TextStyle(fontSize: 13)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _ask(question),
          ),
        ),
        const SizedBox(height: 8),
      ],
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.stateGrey,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.lock_outline, size: 16, color: AppColors.inkSoft),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'HQ only. Uses only yearly total profit and total expenses — never share capital, savings, loans, assets, cash, NICs or passwords.',
                style: TextStyle(fontSize: 12, color: AppColors.inkBody),
              ),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _askField(String hint, {bool onDark = false}) => TextField(
    controller: _input,
    enabled: !_working,
    maxLength: 500,
    textInputAction: TextInputAction.send,
    onSubmitted: _ask,
    decoration: InputDecoration(
      hintText: _working ? 'Waiting for the answer…' : hint,
      counterText: '',
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(28),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      suffixIcon: Padding(
        padding: const EdgeInsets.all(4),
        child: IconButton.filled(
          tooltip: 'Ask',
          onPressed: _working ? null : () => _ask(_input.text),
          icon: const Icon(Icons.send, size: 18),
        ),
      ),
    ),
  );

  Widget _composer() => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
      child: _working
          ? OutlinedButton.icon(
              onPressed: () => setState(() => _turns.last.stopped = true),
              icon: const Icon(Icons.stop_outlined),
              label: const Text('Stop'),
            )
          : _askField('Ask a follow-up…'),
    ),
  );

  Widget _conversation() => ListView.builder(
    controller: _scroll,
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
    itemCount: _turns.length,
    itemBuilder: (context, index) {
      final turn = _turns[index];
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              constraints: const BoxConstraints(maxWidth: 320),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.forest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                turn.question,
                style: const TextStyle(color: Colors.white, fontSize: 13.5),
              ),
            ),
            TextButton(
              onPressed: _working ? null : () => _edit(turn.question),
              style: TextButton.styleFrom(
                minimumSize: const Size(48, 36),
                foregroundColor: AppColors.muted,
              ),
              child: const Text(
                'Edit question',
                style: TextStyle(fontSize: 12),
              ),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ExcludeSemantics(
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: AppColors.pine,
                    child: Icon(Icons.auto_awesome, size: 15, color: _gold),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(child: _reply(turn, index)),
              ],
            ),
          ],
        ),
      );
    },
  );

  Widget _reply(_Turn turn, int index) {
    if (turn.stopped) {
      return const _Box(
        child: Text(
          'Stopped. Nothing from this question is shown.',
          style: TextStyle(fontSize: 12.5, color: AppColors.muted),
        ),
      );
    }
    if (turn.waiting) {
      return Semantics(
        liveRegion: true,
        label: 'Working on it',
        child: const _Box(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Working on it…',
                    style: TextStyle(
                      color: AppColors.leaf,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 6),
              Text(
                'Understanding the question and reading the society records HQ can open.',
                style: TextStyle(fontSize: 12.5, color: AppColors.inkBody),
              ),
            ],
          ),
        ),
      );
    }
    final error = turn.error;
    if (error != null) {
      if (error.status == 400) return _Box(child: Text(error.message));
      // Issue #96: the API's own wording, with the date SarvoAI returns. No retry.
      if (error.status == 429) {
        return _Box(
          border: const Color(0xFFECD9A0),
          colour: const Color(0xFFFFFAF0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'SarvoAI has reached this month’s limit',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                error.message,
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.inkBody,
                ),
              ),
            ],
          ),
        );
      }
      return _Box(
        border: const Color(0xFFF0CFCB),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'SarvoAI isn’t available right now',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              error.message.contains('switched on')
                  ? 'SarvoAI is not switched on for this environment. Society records are not affected.'
                  : 'Your question is kept. Try again in a minute — society records are not affected.',
              style: const TextStyle(fontSize: 12.5, color: AppColors.inkBody),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _ask(turn.question, upTo: index),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Try again'),
              ),
            ),
          ],
        ),
      );
    }
    return _AnswerView(
      answer: turn.answer!,
      question: turn.question,
      onAsk: (text) => _ask(text, upTo: index + 1),
      onRefine: () => _edit(turn.question),
    );
  }
}

class _Title extends StatelessWidget {
  const _Title(this.title, this.subtitle);

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Column(
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
  );
}

class _Box extends StatelessWidget {
  const _Box({
    required this.child,
    this.border = AppColors.line,
    this.colour = AppColors.surface,
  });

  final Widget child;
  final Color border;
  final Color colour;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: colour,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: border),
    ),
    child: child,
  );
}

class _Chip extends StatelessWidget {
  const _Chip(
    this.text, {
    this.colour = AppColors.leaf,
    this.background = AppColors.mint,
  });

  final String text;
  final Color colour;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 11.5,
        color: colour,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

String _cell(Object? value) => value == null
    ? '—'
    : value is num
    ? count(value.round())
    : '$value';

class _AnswerView extends StatelessWidget {
  const _AnswerView({
    required this.answer,
    required this.question,
    required this.onAsk,
    required this.onRefine,
  });

  final SarvoAiAnswer answer;
  final String question;
  final void Function(String) onAsk;
  final VoidCallback onRefine;

  Widget _scope() {
    final scope = answer.scope;
    if (scope == null) return const SizedBox.shrink();
    final years = scope.financialYears;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          if (years.isNotEmpty)
            _Chip(
              years.length > 2
                  ? '${years.first} – ${years.last}'
                  : years.join(', '),
              colour: const Color(0xFF315D88),
              background: const Color(0xFFE5EEF8),
            ),
          _Chip(
            scope.district == null
                ? 'All districts'
                : '${scope.district} District',
          ),
          if (scope.currency != null)
            _Chip(
              scope.currency!,
              colour: AppColors.inkSoft,
              background: AppColors.stateGrey,
            ),
          if (scope.included != null)
            _Chip('${count(scope.included!)} societies included'),
          if ((scope.excluded ?? 0) > 0)
            _Chip(
              '${count(scope.excluded!)} excluded${scope.excludedReason == null ? '' : ' · ${scope.excludedReason}'}',
              colour: AppColors.warning,
              background: AppColors.warningSoft,
            ),
        ],
      ),
    );
  }

  Widget _options(BuildContext context, {String? label}) {
    if (answer.options.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label != null)
            Text(
              label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              for (final option in answer.options)
                ActionChip(label: Text(option), onPressed: () => onAsk(option)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _footer(BuildContext context) => Wrap(
    crossAxisAlignment: WrapCrossAlignment.center,
    spacing: 4,
    children: [
      if (answer.recordsUsed.isNotEmpty || answer.scope != null)
        TextButton.icon(
          onPressed: () => _showDetails(context),
          icon: const Icon(Icons.info_outline, size: 16),
          label: const Text('View details'),
        ),
      TextButton(onPressed: onRefine, child: const Text('Refine')),
      if (answer.sample)
        const _Chip(
          'Sample data',
          colour: AppColors.warning,
          background: AppColors.warningSoft,
        ),
    ],
  );

  void _showDetails(BuildContext context) {
    final scope = answer.scope;
    final rows = <(String, String)>[
      if (scope != null && scope.financialYears.isNotEmpty)
        ('Year', scope.financialYears.join(', ')),
      if (scope != null) ('District', scope.district ?? 'All districts'),
      if (scope?.currency != null) ('Currency', scope!.currency!),
      (
        'Records used',
        answer.recordsUsed.isEmpty
            ? 'None needed'
            : answer.recordsUsed.join('\n'),
      ),
      if (scope?.included != null)
        ('Included', '${count(scope!.included!)} societies'),
      if ((scope?.excluded ?? 0) > 0)
        (
          'Excluded',
          '${count(scope!.excluded!)} · ${scope.excludedReason ?? 'left out'} (not counted as zero)',
        ),
      ('Data as of', '${answer.dataAsOf.toLocal()}'.substring(0, 16)),
    ];
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: const Text(
                  'How was this answered?',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 8),
              for (final (label, value) in rows) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 110,
                        child: Text(
                          label,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: AppColors.muted,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          value,
                          textAlign: TextAlign.right,
                          style: const TextStyle(fontSize: 12.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (answer.calculation != null)
                _Box(
                  colour: AppColors.mintSoft,
                  border: AppColors.mint,
                  child: Text(
                    answer.calculation!,
                    style: const TextStyle(fontSize: 12.5),
                  ),
                ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Done'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    switch (answer.kind) {
      case AnswerKind.clarify:
        return _Box(
          border: const Color(0xFFC3D5EA),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.help_outline,
                    color: Color(0xFF315D88),
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      answer.summary,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              _options(context),
            ],
          ),
        );
      case AnswerKind.noMatch:
      case AnswerKind.incomplete:
      case AnswerKind.unsupported:
        final (icon, title, colour, border, label) = switch (answer.kind) {
          AnswerKind.noMatch => (
            Icons.search,
            'No societies match',
            AppColors.surface,
            AppColors.line,
            null,
          ),
          AnswerKind.incomplete => (
            Icons.warning_amber_outlined,
            null,
            const Color(0xFFFFFAF0),
            const Color(0xFFECD9A0),
            null,
          ),
          _ => (
            Icons.info_outline,
            'SarvoAI can’t answer this',
            AppColors.surface,
            AppColors.line,
            null,
          ),
        };
        return _Box(
          colour: colour,
          border: border,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                icon,
                size: 20,
                color: answer.kind == AnswerKind.incomplete
                    ? AppColors.warning
                    : AppColors.inkSoft,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (title != null)
                      Text(
                        title,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    Text(
                      answer.summary,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: answer.kind == AnswerKind.incomplete
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                    _scope(),
                    _options(context, label: label),
                    if (answer.kind != AnswerKind.unsupported) _footer(context),
                  ],
                ),
              ),
            ],
          ),
        );
      case AnswerKind.answer:
        final table = answer.table;
        final scope = answer.scope;
        return _Box(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(answer.summary, style: const TextStyle(fontSize: 14)),
              _scope(),
              if (scope?.included != null) ...[
                const SizedBox(height: 10),
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: _Figure(
                          'Included',
                          '${count(scope!.included!)} societies',
                          AppColors.leaf,
                          AppColors.mintSoft,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _Figure(
                          'Not included',
                          '${count(scope.excluded ?? 0)} societies',
                          AppColors.warning,
                          AppColors.warningSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (table != null && table.rows.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  table.columns.last.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.inkSoft,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    children: [
                      for (final (index, row) in table.rows.indexed) ...[
                        if (index > 0) const Divider(height: 1),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _cell(row.first),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                    ),
                                    if (row.length > 2)
                                      Text(
                                        row
                                            .sublist(1, row.length - 1)
                                            .map(_cell)
                                            .join(' · '),
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: AppColors.muted,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              if (row.length > 1)
                                Text(
                                  _cell(row.last),
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color:
                                        row.last is num && (row.last as num) < 0
                                        ? AppColors.danger
                                        : AppColors.ink,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Showing ${table.rows.length} of ${count(table.totalRows)}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.muted,
                    ),
                  ),
                ),
              ],
              _footer(context),
            ],
          ),
        );
    }
  }
}

class _Figure extends StatelessWidget {
  const _Figure(this.label, this.value, this.colour, this.background);

  final String label;
  final String value;
  final Color colour;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11.5, color: colour)),
        Text(
          value,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}
