import '../society_record/society_record_models.dart' show PickedDocument;
import 'incident_api.dart';

/// Fictional sample incident for demonstration mode and widget tests. The
/// screens label it "Sample data". Nothing here is real.
class DemoIncidentApi implements IncidentApi {
  DemoIncidentApi({required this.clock, this.societyId = 'society-demo'}) {
    final now = clock();
    _incident = IncidentSummary(
      id: 'incident-demo',
      reference: 'INC-2026-09',
      title: 'Floods — Sample District',
      type: 'FLOOD',
      isClosed: false,
      areaNames: const ['Sample North', 'Sample West'],
      reportingSociety: _own,
      openedByName: 'N. Sample',
      openedByRole: 'SOCIETY_OFFICER',
      openedAt: now.subtract(const Duration(hours: 26)),
      assessmentsDueAt: now.add(const Duration(days: 1, hours: 9)),
      societiesInArea: 151,
      assessed: 96,
    );
    _actions = [
      ResponseAction(
        id: 'action-water',
        need: 'DRINKING_WATER',
        title: 'Drinking water',
        quantity: 200,
        unit: 'L',
        state: ActionState.assigned,
        delivered: 0,
        forSociety: _own,
        dueAt: now.add(const Duration(days: 1)),
        helpers: [
          _helper('helper-water', _helping, 200, 0, HelperStatus.assigned, now),
        ],
      ),
      ResponseAction(
        id: 'action-rations',
        need: 'DRY_RATIONS',
        title: 'Dry-ration packs',
        quantity: 40,
        unit: 'packs',
        state: ActionState.inProgress,
        delivered: 12,
        forSociety: _own,
        helpers: [
          _helper(
            'helper-rations',
            _second,
            40,
            12,
            HelperStatus.inProgress,
            now,
          ),
        ],
      ),
      ResponseAction(
        id: 'action-help',
        need: 'DRINKING_WATER',
        title: 'Drinking water',
        quantity: 300,
        unit: 'L',
        state: ActionState.assigned,
        delivered: 0,
        forSociety: _needy,
        dueAt: now.add(const Duration(days: 1)),
        helpers: [
          _helper(
            'helper-own',
            _own,
            300,
            0,
            HelperStatus.assigned,
            now,
            canUpdate: true,
          ),
        ],
      ),
    ];
  }

  final DateTime Function() clock;
  final String societyId;
  late IncidentSummary _incident;
  late List<ResponseAction> _actions;
  final List<AssessmentUpdate> _updates = [];

  SocietyRef get _own => SocietyRef(
    id: societyId,
    name: 'Sample Village Society',
    code: 'S-000001',
    districtName: 'Sample North',
  );
  static const _helping = SocietyRef(
    id: 'society-helping',
    name: 'Sample Hill Society',
    code: 'S-000002',
    districtName: 'Sample North',
  );
  static const _second = SocietyRef(
    id: 'society-second',
    name: 'Sample River Society',
    code: 'S-000003',
    districtName: 'Sample North',
  );
  static const _needy = SocietyRef(
    id: 'society-needy',
    name: 'Sample Lake Society',
    code: 'S-000004',
    districtName: 'Sample North',
  );

  static Helper _helper(
    String id,
    SocietyRef society,
    int quantity,
    int delivered,
    HelperStatus status,
    DateTime now, {
    bool canUpdate = false,
  }) => Helper(
    id: id,
    society: society,
    quantity: quantity,
    deliveredQuantity: delivered,
    status: status,
    assignedBy: 'K. Sample (HQ)',
    assignedAt: now.subtract(const Duration(hours: 20)),
    canUpdate: canUpdate,
  );

  @override
  Future<List<IncidentSummary>> active() async =>
      _incident.isClosed ? const [] : [_incident];

  @override
  Future<IncidentDetail> detail(String id) async => IncidentDetail(
    incident: _incident,
    canAssess: !_incident.isClosed,
    canClose: !_incident.isClosed,
    totals: const IncidentTotals(
      affected: 38,
      critical: 4,
      families: 1240,
      people: 4610,
      housesFully: 36,
      housesPartly: 412,
      notAssessed: 55,
      societiesInArea: 151,
      actions: 23,
      byDistrict: [
        (name: 'Sample North', affected: 24, people: 2890),
        (name: 'Sample West', affected: 14, people: 1720),
      ],
      needs: [
        (need: 'DRINKING_WATER', societies: 29),
        (need: 'DRY_RATIONS', societies: 21),
        (need: 'TEMPORARY_SHELTER', societies: 9),
      ],
    ),
    recent: const [],
    actions: _actions,
    reports: [
      (
        id: 'report-demo',
        number: 3,
        asOf: clock().subtract(const Duration(hours: 3)),
      ),
    ],
    assessableSocieties: _incident.isClosed ? const [] : [_own],
  );

  @override
  Future<List<AssessmentUpdate>> updates(
    String incidentId,
    String societyId,
  ) async => _updates.reversed.toList();

  @override
  Future<String> sendAssessment(
    String incidentId,
    String societyId,
    String clientMutationId,
    AssessmentAnswers answers,
  ) async {
    final id = 'update-${_updates.length + 1}';
    _updates.add(
      AssessmentUpdate(
        id: id,
        number: _updates.length + 1,
        sentAt: clock(),
        photos: answers.photos.length,
      ),
    );
    return id;
  }

  @override
  Future<void> addPhoto(String assessmentId, PickedDocument photo) async {}

  @override
  Future<void> updateDelivery(
    String helperId, {
    required HelperStatus status,
    required int delivered,
    String? deliveredOn,
    String note = '',
    PickedDocument? photo,
  }) async {
    _actions = [
      for (final action in _actions)
        ResponseAction(
          id: action.id,
          need: action.need,
          title: action.title,
          quantity: action.quantity,
          unit: action.unit,
          state: action.helpers.any((h) => h.id == helperId)
              ? (status == HelperStatus.delivered
                    ? ActionState.delivered
                    : ActionState.inProgress)
              : action.state,
          delivered: action.helpers.any((h) => h.id == helperId)
              ? delivered
              : action.delivered,
          forSociety: action.forSociety,
          dueAt: action.dueAt,
          helpers: [
            for (final h in action.helpers)
              h.id == helperId
                  ? Helper(
                      id: h.id,
                      society: h.society,
                      quantity: h.quantity,
                      deliveredQuantity: delivered,
                      status: status,
                      assignedBy: h.assignedBy,
                      assignedAt: h.assignedAt,
                      canUpdate: h.canUpdate,
                      deliveredOn: deliveredOn,
                      deliveryNote: note,
                    )
                  : h,
          ],
        ),
    ];
  }

  @override
  Future<IncidentSummary> close(String id) async {
    final i = _incident;
    _incident = IncidentSummary(
      id: i.id,
      reference: i.reference,
      title: i.title,
      type: i.type,
      isClosed: true,
      areaNames: i.areaNames,
      reportingSociety: i.reportingSociety,
      openedByName: i.openedByName,
      openedByRole: i.openedByRole,
      openedAt: i.openedAt,
      assessmentsDueAt: i.assessmentsDueAt,
      closedAt: clock(),
      closedByName: 'You',
      societiesInArea: i.societiesInArea,
      assessed: i.assessed,
    );
    return _incident;
  }

  @override
  Future<ReportOptions> reportOptions() async => ReportOptions(
    societies: [_own],
    districts: const [
      (id: 'district-north', name: 'Sample North'),
      (id: 'district-west', name: 'Sample West'),
    ],
  );

  @override
  Future<String> open({
    required String type,
    required String reportingSocietyId,
    required List<String> districtIds,
    required String description,
    required DateTime startedAt,
  }) async => _incident.id;

  @override
  Future<SituationReport> report(String reportId) async {
    final detail = await this.detail(_incident.id);
    return SituationReport(
      number: 3,
      asOf: clock().subtract(const Duration(hours: 3)),
      incident: _incident,
      totals: detail.totals,
      helpingSocieties: 17,
      helpedSocieties: 24,
    );
  }

  @override
  Future<List<IncidentNotification>> notifications() async => [
    IncidentNotification(
      title: 'New incident: ${_incident.title}',
      body: 'Opened by N. Sample (Sample Village Society). Sample North and Sample West. Tap to see the incident and send an assessment.',
      at: _incident.openedAt,
    ),
  ];
}
