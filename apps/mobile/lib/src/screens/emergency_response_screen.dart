import 'package:flutter/material.dart';

import '../models/user.dart';
import '../services/emergency_api_client.dart';
import '../services/emergency_assessment_queue.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';

/// M22–M25 · local emergency response workflows. Data is fictional only.
class EmergencyResponseScreen extends StatefulWidget {
  const EmergencyResponseScreen({super.key});

  @override
  State<EmergencyResponseScreen> createState() =>
      _EmergencyResponseScreenState();
}

class _EmergencyResponseScreenState extends State<EmergencyResponseScreen> {
  final _api = EmergencyApiClient();
  late EmergencyAssessmentQueue _queue;
  late DemoStore _store;
  var _initialized = false;
  var _loading = true;
  var _syncing = false;
  String? _error;
  List<EmergencyIncident> _incidents = const [];
  List<PendingEmergencyAssessment> _pending = const [];

  UserRole get _role => _store.activeRole;
  bool get _canCoordinate =>
      _role == UserRole.districtManager || _role == UserRole.hqAdmin;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    _store = DemoScope.read(context);
    _open();
  }

  Future<void> _open() async {
    _queue = await EmergencyAssessmentQueue.open();
    if (!mounted) return;
    await _refresh();
  }

  Future<void> _refresh() async {
    if (!_initialized) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_store.offline) {
        final cached = await _queue.readIncidentCache();
        _incidents = cached
            .map(EmergencyIncident.fromJson)
            .toList(growable: false);
      } else {
        _syncing = true;
        await _queue.sync(_api, _role);
        final incidents = await _api.listIncidents(_role);
        _incidents = incidents;
        await _queue.saveIncidentCache(
          incidents.map((item) => item.toJson()).toList(),
        );
      }
    } catch (error) {
      _error = error.toString();
      final cached = await _queue.readIncidentCache();
      if (cached.isNotEmpty) {
        _incidents = cached
            .map(EmergencyIncident.fromJson)
            .toList(growable: false);
      }
    } finally {
      _syncing = false;
      _pending = await _queue.all();
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _newAssessment(EmergencyIncident incident) async {
    final payload = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _AssessmentDialog(incident: incident),
    );
    if (payload == null || !mounted) return;
    await _queue.save(payload);
    await _queue.syncIfOnline(_api, _role, offline: _store.offline);
    await _refresh();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _store.offline || _pending.isNotEmpty
              ? 'Assessment saved on this device. It will sync when you are online.'
              : 'Assessment submitted to the local API.',
        ),
      ),
    );
  }

  Future<void> _newSituationReport(EmergencyIncident incident) async {
    final report = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => const _SituationReportDialog(),
    );
    if (report == null || !mounted) return;
    try {
      if (_store.offline) {
        throw const EmergencyApiException(
          'You are offline. Situation reports need a connection.',
        );
      }
      await _api.submitSituationReport({
        'clientMutationId': newClientMutationId(),
        'incidentId': incident.id,
        if (_role == UserRole.societyOfficer) 'societyId': demoSunriseSocietyId,
        'status': 'SUBMITTED',
        'summary': report['summary'],
        'needs': report['needs'],
      }, _role);
      await _refresh();
      if (mounted) _notice('Situation report submitted.');
    } catch (error) {
      if (mounted) _notice(error.toString());
    }
  }

  Future<void> _newAction(EmergencyIncident incident) async {
    final action = await showDialog<Map<String, String>>(
      context: context,
      builder: (_) => const _ResponseActionDialog(),
    );
    if (action == null || !mounted) return;
    try {
      await _api.createResponseAction({
        'clientMutationId': newClientMutationId(),
        'incidentId': incident.id,
        'societyId': demoSunriseSocietyId,
        'title': action['title'],
        'description': action['description'],
        'status': 'PLANNED',
      }, _role);
      await _refresh();
      if (mounted) _notice('Response action added.');
    } catch (error) {
      if (mounted) _notice(error.toString());
    }
  }

  Future<void> _updateIncident(
    EmergencyIncident incident,
    String status,
  ) async {
    try {
      await _api.updateIncidentStatus(incident.id, status, _role);
      await _refresh();
    } catch (error) {
      if (mounted) _notice(error.toString());
    }
  }

  Future<void> _showDetails(EmergencyIncident incident) async {
    try {
      final details = await _api.loadIncident(incident.id, _role);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => _IncidentDetails(details: details),
      );
    } catch (error) {
      if (mounted) _notice(error.toString());
    }
  }

  void _notice(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency response'),
        actions: [
          IconButton(
            tooltip: _syncing ? 'Syncing' : 'Refresh and sync queue',
            onPressed: _loading ? null : _refresh,
            icon: const Icon(Icons.sync),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_store.offline)
                    const OfflineBanner(
                      message: 'Offline · cached incidents shown; assessments are saved on this device',
                    ),
                  if (!_store.offline && _error != null)
                    _NoticeCard(
                      message:
                          'API unavailable · showing the last saved incident list. $_error',
                    ),
                  _queueSummary(),
                  const SizedBox(height: 14),
                  if (_incidents.isEmpty)
                    const StateMessage(
                      icon: Icons.warning_amber_outlined,
                      title: 'No cached or active incidents',
                      message: 'Connect to the local API to load active fictional incidents.',
                    )
                  else
                    for (final incident in _incidents) ...[
                      _IncidentCard(
                        incident: incident,
                        canCoordinate: _canCoordinate,
                        onAssessment: () => _newAssessment(incident),
                        onSituationReport: () => _newSituationReport(incident),
                        onResponseAction: () => _newAction(incident),
                        onDetails: () => _showDetails(incident),
                        onStatus: (status) => _updateIncident(incident, status),
                      ),
                      const SizedBox(height: 12),
                    ],
                  const SizedBox(height: 24),
                  const Text(
                    'Demonstration only. Use fictional information; do not enter real names, health details or other personal data.',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _queueSummary() {
    final pending = _pending.length;
    return Card(
      child: ListTile(
        leading: Icon(
          pending == 0
              ? Icons.cloud_done_outlined
              : Icons.cloud_upload_outlined,
          color: pending == 0 ? AppColors.leaf : Colors.orange.shade800,
        ),
        title: Text(
          pending == 0
              ? 'Assessment queue clear'
              : '$pending assessment${pending == 1 ? '' : 's'} waiting to sync',
        ),
        subtitle: Text(
          pending == 0 ? 'No locally saved assessments.' : 'Saved on this device and retained until the API confirms receipt.',
        ),
        trailing: pending > 0 && !_store.offline
            ? IconButton(
                onPressed: _refresh,
                icon: const Icon(Icons.sync),
                tooltip: 'Retry sync',
              )
            : null,
      ),
    );
  }
}

class _IncidentCard extends StatelessWidget {
  const _IncidentCard({
    required this.incident,
    required this.canCoordinate,
    required this.onAssessment,
    required this.onSituationReport,
    required this.onResponseAction,
    required this.onDetails,
    required this.onStatus,
  });

  final EmergencyIncident incident;
  final bool canCoordinate;
  final VoidCallback onAssessment;
  final VoidCallback onSituationReport;
  final VoidCallback onResponseAction;
  final VoidCallback onDetails;
  final ValueChanged<String> onStatus;

  @override
  Widget build(BuildContext context) {
    final critical =
        incident.severity == 'CRITICAL' || incident.severity == 'HIGH';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _Tag(
                  label: incident.severity,
                  color: critical ? const Color(0xFFB83A32) : AppColors.leaf,
                ),
                _Tag(label: incident.status, color: AppColors.forest),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              incident.title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              '${incident.type.replaceAll('_', ' ')} · ${incident.district} · ${incident.location}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 9),
            Text(
              incident.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
            Text(
              '${incident.assessmentCount} assessments · ${incident.actionCount} actions · ${incident.reportCount} reports',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            const Divider(height: 22),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                OutlinedButton.icon(
                  onPressed: onAssessment,
                  icon: const Icon(Icons.assignment_outlined),
                  label: const Text('Assess'),
                ),
                OutlinedButton.icon(
                  onPressed: onSituationReport,
                  icon: const Icon(Icons.description_outlined),
                  label: const Text('Situation report'),
                ),
                if (canCoordinate)
                  OutlinedButton.icon(
                    onPressed: onResponseAction,
                    icon: const Icon(Icons.add_task),
                    label: const Text('Add action'),
                  ),
                TextButton(
                  onPressed: onDetails,
                  child: const Text('View details'),
                ),
                if (canCoordinate && incident.status != 'CLOSED')
                  PopupMenuButton<String>(
                    tooltip: 'Update incident status',
                    onSelected: onStatus,
                    itemBuilder: (_) => [
                      if (incident.status != 'ACTIVE')
                        const PopupMenuItem(
                          value: 'ACTIVE',
                          child: Text('Mark active'),
                        ),
                      if (incident.status != 'CONTAINED')
                        const PopupMenuItem(
                          value: 'CONTAINED',
                          child: Text('Mark contained'),
                        ),
                      const PopupMenuItem(
                        value: 'CLOSED',
                        child: Text('Close incident'),
                      ),
                    ],
                    child: const Padding(
                      padding: EdgeInsets.all(8),
                      child: Icon(Icons.more_horiz),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(30),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11),
    ),
  );
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(padding: const EdgeInsets.all(14), child: Text(message)),
  );
}

class _AssessmentDialog extends StatefulWidget {
  const _AssessmentDialog({required this.incident});
  final EmergencyIncident incident;

  @override
  State<_AssessmentDialog> createState() => _AssessmentDialogState();
}

class _AssessmentDialogState extends State<_AssessmentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _people = TextEditingController(text: '0');
  final _households = TextEditingController(text: '0');
  final _displaced = TextEditingController(text: '0');
  final _infrastructure = TextEditingController();
  final _needs = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _people.dispose();
    _households.dispose();
    _displaced.dispose();
    _infrastructure.dispose();
    _needs.dispose();
    _notes.dispose();
    super.dispose();
  }

  String? _countError(String? value) {
    final parsed = int.tryParse(value ?? '');
    return parsed == null || parsed < 0
        ? 'Enter a non-negative whole number'
        : null;
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Rapid impact assessment'),
    content: SizedBox(
      width: 500,
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Fictional assessment · ${widget.incident.title}',
                style: const TextStyle(color: AppColors.muted),
              ),
              _input(
                _people,
                'People affected',
                number: true,
                validator: _countError,
              ),
              _input(
                _households,
                'Households affected',
                number: true,
                validator: _countError,
              ),
              _input(
                _displaced,
                'People displaced',
                number: true,
                validator: _countError,
              ),
              _input(_infrastructure, 'Infrastructure impact', maxLines: 2),
              _input(_needs, 'Urgent needs', maxLines: 2),
              _input(_notes, 'Additional notes', maxLines: 2),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (!_formKey.currentState!.validate()) return;
          Navigator.pop(context, {
            'clientMutationId': newClientMutationId(),
            'incidentId': widget.incident.id,
            'societyId': demoSunriseSocietyId,
            'status': 'SUBMITTED',
            'observedAt': DateTime.now().toUtc().toIso8601String(),
            'peopleAffected': int.parse(_people.text),
            'householdsAffected': int.parse(_households.text),
            'displacedPeople': int.parse(_displaced.text),
            'infrastructureNotes': _infrastructure.text.trim(),
            'urgentNeeds': _needs.text.trim(),
            'notes': _notes.text.trim(),
          });
        },
        child: const Text('Save assessment'),
      ),
    ],
  );
}

class _SituationReportDialog extends StatefulWidget {
  const _SituationReportDialog();
  @override
  State<_SituationReportDialog> createState() => _SituationReportDialogState();
}

class _SituationReportDialogState extends State<_SituationReportDialog> {
  final _formKey = GlobalKey<FormState>();
  final _summary = TextEditingController();
  final _needs = TextEditingController();
  @override
  void dispose() {
    _summary.dispose();
    _needs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Situation report'),
    content: Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _input(_summary, 'Current situation', maxLines: 4, required: true),
          _input(_needs, 'Urgent needs', maxLines: 3),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (_formKey.currentState!.validate()) {
            Navigator.pop(context, {
              'summary': _summary.text.trim(),
              'needs': _needs.text.trim(),
            });
          }
        },
        child: const Text('Submit'),
      ),
    ],
  );
}

class _ResponseActionDialog extends StatefulWidget {
  const _ResponseActionDialog();
  @override
  State<_ResponseActionDialog> createState() => _ResponseActionDialogState();
}

class _ResponseActionDialogState extends State<_ResponseActionDialog> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Coordinate response action'),
    content: Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _input(_title, 'Action title', required: true),
          _input(_description, 'Details', maxLines: 3),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (_formKey.currentState!.validate()) {
            Navigator.pop(context, {
              'title': _title.text.trim(),
              'description': _description.text.trim(),
            });
          }
        },
        child: const Text('Add action'),
      ),
    ],
  );
}

Widget _input(
  TextEditingController controller,
  String label, {
  bool number = false,
  int maxLines = 1,
  bool required = false,
  String? Function(String?)? validator,
}) => Padding(
  padding: const EdgeInsets.only(top: 10),
  child: TextFormField(
    controller: controller,
    keyboardType: number ? TextInputType.number : TextInputType.multiline,
    maxLines: maxLines,
    decoration: InputDecoration(
      labelText: label,
      border: const OutlineInputBorder(),
    ),
    validator:
        validator ??
        (required
            ? (value) =>
                  value == null || value.trim().isEmpty ? 'Required' : null
            : null),
  ),
);

class _IncidentDetails extends StatelessWidget {
  const _IncidentDetails({required this.details});
  final Map<String, dynamic> details;

  @override
  Widget build(BuildContext context) {
    final assessments = details['assessments'] as List<dynamic>? ?? const [];
    final actions = details['actions'] as List<dynamic>? ?? const [];
    final reports = details['reports'] as List<dynamic>? ?? const [];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                details['title'] as String? ?? 'Incident details',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              Text(
                'Assessments (${assessments.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              for (final item in assessments)
                _RecordSummary(
                  item: item as Map<String, dynamic>,
                  kind: 'Assessment',
                ),
              const SizedBox(height: 10),
              Text(
                'Response actions (${actions.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              for (final item in actions)
                _RecordSummary(
                  item: item as Map<String, dynamic>,
                  kind: 'Action',
                ),
              const SizedBox(height: 10),
              Text(
                'Situation reports (${reports.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              for (final item in reports)
                _RecordSummary(
                  item: item as Map<String, dynamic>,
                  kind: 'Report',
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecordSummary extends StatelessWidget {
  const _RecordSummary({required this.item, required this.kind});
  final Map<String, dynamic> item;
  final String kind;
  @override
  Widget build(BuildContext context) => Card(
    color: AppColors.surface,
    child: ListTile(
      title: Text(
        (item['title'] ??
                item['summary'] ??
                item['urgentNeeds'] ??
                '$kind record')
            .toString(),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text((item['status'] ?? '').toString()),
    ),
  );
}
