import 'package:flutter/material.dart';

import '../models/activity_draft.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../validation/activity_validators.dart';

/// SC-54 / M09: four-step fictional mobile activity report.
class ActivityFormScreen extends StatefulWidget {
  const ActivityFormScreen({super.key});

  @override
  State<ActivityFormScreen> createState() => _ActivityFormScreenState();
}

class _ActivityFormScreenState extends State<ActivityFormScreen> {
  static const _steps = [
    'Details',
    'Classification',
    'Participation',
    'Review',
  ];
  final _pageScroll = ScrollController();
  int _step = 0;
  Map<String, String> _errors = {};
  bool _submitting = false;
  static const _green = Color(0xFF286B3D);
  static const _surface = Color(0xFFF6F7F2);

  late DemoStore _store;
  late ActivityDraft _draft;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _store = DemoScope.read(context);
    _draft = ActivityDraftRegistry.forStore(_store);
  }

  @override
  void dispose() {
    _pageScroll.dispose();
    super.dispose();
  }

  void _update(String key, String value) {
    switch (key) {
      case 'title':
        _draft.title = value;
      case 'date':
        _draft.date = value;
      case 'location':
        _draft.location = value;
      case 'activityType':
        _draft.activityType = value;
      case 'gpsLocation':
        _draft.gpsLocation = value;
      case 'description':
        _draft.description = value;
      case 'sector':
        _draft.sector = value;
      case 'dimension':
        _draft.dimension = value;
      case 'outcomes':
        _draft.outcomes = value;
      case 'supportingInformation':
        _draft.supportingInformation = value;
      case 'female':
        _draft.femaleParticipants = value;
      case 'male':
        _draft.maleParticipants = value;
    }
    if (_errors.containsKey(key) || _errors.containsKey('participants')) {
      setState(() {
        _errors.remove(key);
        _errors.remove('participants');
      });
    }
  }

  void _goNext() {
    if (_step < 3) {
      final errors = ActivityValidators.forStep(
        _draft,
        _step,
        today: _store.now,
      );
      if (errors.isNotEmpty) {
        setState(() => _errors = errors);
        return;
      }
      setState(() {
        _errors = {};
        _step++;
      });
      if (_pageScroll.hasClients) _pageScroll.jumpTo(0);
    }
  }

  void _back() {
    if (_step == 0) {
      Navigator.of(context).pop(); // In-memory draft remains for reopening.
    } else {
      setState(() {
        _errors = {};
        _step--;
      });
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final errors = ActivityValidators.all(_draft, today: _store.now);
    if (errors.isNotEmpty) {
      final first = errors.keys.first;
      setState(() {
        _errors = errors;
        _step =
            const {
              'title',
              'date',
              'location',
              'activityType',
              'gpsLocation',
              'description',
            }.contains(first)
            ? 0
            : const {'sector', 'dimension'}.contains(first)
            ? 1
            : 2;
      });
      return;
    }
    if (_store.offline) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You are offline. Your draft is still saved.'),
        ),
      );
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit this activity report?'),
        content: const Text(
          'Your report will be sent to the District Manager for review. It will not count in HQ reporting until approved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm submission'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _submitting = true);
    try {
      final reference = _store.submitActivityReport(_draft);
      ActivityDraftRegistry.clear(_store);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => _ActivitySubmittedScreen(
            reference: reference,
            title: _draft.title,
          ),
        ),
      );
    } on StateError catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Widget _section(Widget child) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(13),
        side: const BorderSide(color: Color(0xFFE3E7DE)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(padding: const EdgeInsets.all(14), child: child),
    ),
  );

  Widget _textField(
    String key,
    String label,
    String initial, {
    int lines = 1,
    TextInputType? inputType,
    String? hint,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      key: ValueKey('activity-$key'),
      initialValue: initial,
      onChanged: (value) => _update(key, value),
      keyboardType: inputType,
      maxLines: lines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        errorText: _errors[key],
        filled: true,
        fillColor: Colors.white,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: Color(0xFFD7DDD4)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9),
          borderSide: const BorderSide(color: _green, width: 1.5),
        ),
      ),
    ),
  );

  Widget _details() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _section(
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _textField('title', 'Activity name *', _draft.title),
            _textField(
              'activityType',
              'Activity type *',
              _draft.activityType,
              hint: 'e.g. Shramadana work camp',
            ),
            _textField('date', 'Date *', _draft.date, hint: 'YYYY-MM-DD'),
            _textField('location', 'Location *', _draft.location),
            _textField(
              'gpsLocation',
              'GPS location *',
              _draft.gpsLocation,
              hint: 'e.g. 7.4891 N, 80.3612 E',
            ),
            const Text(
              'Enter coordinates from your device or map. Automatic GPS capture is not enabled in this demo.',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
        ),
      ),
      _section(
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _textField(
              'description',
              'Short description *',
              _draft.description,
              lines: 3,
            ),
          ],
        ),
      ),
    ],
  );

  Widget _classification() => _section(
    Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _textField(
          'sector',
          'Sarvodaya sector *',
          _draft.sector,
          hint: 'Enter the approved sector name',
        ),
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text('Dimension *'),
        ),
        RadioGroup<String>(
          groupValue: _draft.dimension.isEmpty ? null : _draft.dimension,
          onChanged: (value) {
            if (value != null) {
              _update('dimension', value);
              setState(() {});
            }
          },
          child: Column(
            children: [
              for (final dimension in const [
                'Social',
                'Economic',
                'Governance',
              ])
                RadioListTile<String>(title: Text(dimension), value: dimension),
            ],
          ),
        ),
        if (_errors['dimension'] != null)
          Text(
            _errors['dimension']!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
      ],
    ),
  );

  Widget _participation() => _section(
    Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _textField(
          'female',
          'Female participants *',
          _draft.femaleParticipants,
          inputType: TextInputType.number,
        ),
        _textField(
          'male',
          'Male participants *',
          _draft.maleParticipants,
          inputType: TextInputType.number,
        ),
        if (_errors['participants'] != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              _errors['participants']!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        _textField(
          'outcomes',
          'Outcomes achieved *',
          _draft.outcomes,
          lines: 3,
        ),
        _textField(
          'supportingInformation',
          'Supporting information (optional)',
          _draft.supportingInformation,
          lines: 3,
        ),
      ],
    ),
  );

  Widget _review() => _section(
    Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Review your report before submitting it.',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        _reviewRow('Activity', _draft.title),
        _reviewRow('Activity type', _draft.activityType),
        _reviewRow('GPS location', _draft.gpsLocation),
        _reviewRow('Short description', _draft.description),
        _reviewRow('Date', _draft.date),
        _reviewRow('Location', _draft.location),
        _reviewRow('Sector', _draft.sector),
        _reviewRow('Dimension', _draft.dimension),
        _reviewRow('Female participants', _draft.femaleParticipants),
        _reviewRow('Male participants', _draft.maleParticipants),
        _reviewRow('Outcomes', _draft.outcomes),
        _reviewRow(
          'Supporting information',
          _draft.supportingInformation.isEmpty
              ? 'None'
              : _draft.supportingInformation,
        ),
        const SizedBox(height: 12),
        const Text(
          'The District Manager will review this report before it is included in HQ figures.',
        ),
      ],
    ),
  );

  Widget _reviewRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        Text(value),
        const Divider(),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.user == null || store.activeRole != UserRole.societyOfficer) {
      return Scaffold(
        appBar: AppBar(title: const Text('Report activity')),
        body: const Center(
          child: Text('Only a Society Officer may report activities.'),
        ),
      );
    }
    final content = switch (_step) {
      0 => _details(),
      1 => _classification(),
      2 => _participation(),
      _ => _review(),
    };
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: Text(_step == 3 ? 'Review activity' : 'Report activity'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Chip(
                label: const Text('Draft', style: TextStyle(fontSize: 12)),
                backgroundColor: const Color(0xFFE9EEE7),
                side: BorderSide.none,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: _surface,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Step ${_step + 1} of 4 — ${_steps[_step]}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: (_step + 1) / 4,
                    color: _green,
                    backgroundColor: const Color(0xFFDDE7DD),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Your draft is kept while this demo session is open.',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: _pageScroll,
                padding: const EdgeInsets.all(16),
                children: [content],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  OutlinedButton(
                    onPressed: _back,
                    child: Text(
                      _step == 0
                          ? 'Save Draft'
                          : (_step == 3 ? 'Edit' : 'Back'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _submitting
                          ? null
                          : (_step == 3 ? _submit : _goNext),
                      style: FilledButton.styleFrom(backgroundColor: _green),
                      child: Text(
                        _step == 3 ? 'Submit to District Manager' : 'Continue',
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

class _ActivitySubmittedScreen extends StatelessWidget {
  const _ActivitySubmittedScreen({
    required this.reference,
    required this.title,
  });
  final String reference;
  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF6F7F2),
    appBar: AppBar(
      title: const Text('Activity report'),
      backgroundColor: Colors.white,
    ),
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const CircleAvatar(
              radius: 38,
              backgroundColor: Color(0xFFE8F2E6),
              child: Icon(Icons.check, color: Color(0xFF286B3D), size: 42),
            ),
            const SizedBox(height: 20),
            const Text(
              'Activity submitted',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            const Text(
              'Your activity report has been sent to the District Manager.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              color: const Color(0xFFFFF4D8),
              child: const Text(
                'Awaiting District Manager review. Not counted in HQ figures until approved.',
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Text('Reference: $reference'),
                    const SizedBox(height: 8),
                    const Text('Status: Submitted'),
                    const SizedBox(height: 8),
                    Text('Activity: $title'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF286B3D),
              ),
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Back to Home'),
            ),
          ],
        ),
      ),
    ),
  );
}
