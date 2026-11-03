import '../district_access/access_format.dart';
import 'incident_api.dart';

/// V5 PR 8: words for disaster response on the phone.
const incidentTypeLabels = {
  'FLOOD': 'Flood',
  'LANDSLIDE': 'Landslide',
  'CYCLONE': 'Cyclone',
  'DROUGHT': 'Drought',
  'FIRE': 'Fire',
  'PUBLIC_HEALTH': 'Public health',
  'OTHER': 'Other',
};

const needLabels = {
  'DRINKING_WATER': 'Drinking water',
  'DRY_RATIONS': 'Dry rations',
  'TEMPORARY_SHELTER': 'Temporary shelter',
  'MEDICAL_HELP': 'Medical help',
  'CLOTHING': 'Clothing',
  'VOLUNTEERS': 'Volunteers',
  'OTHER': 'Other',
};

const roadLabels = {
  'OPEN': 'Open',
  'PARTLY_BLOCKED': 'Partly blocked',
  'CUT_OFF': 'Cut off',
  'UNKNOWN': 'Unknown',
};

const impactLabels = {
  'SAFE': 'Safe',
  'AFFECTED': 'Affected',
  'CRITICAL': 'Critical',
};

const roleLabels = {
  'HQ_ADMIN': 'HQ',
  'DISTRICT_MANAGER': 'DM',
  'DEPUTY_DISTRICT_MANAGER': 'DDM',
  'PROGRAMME_COORDINATOR': 'SPC',
  'SOCIETY_OFFICER': 'Society Officer',
};

const helperStatusLabels = {
  HelperStatus.assigned: 'Assigned',
  HelperStatus.inProgress: 'In progress',
  HelperStatus.delivered: 'Delivered',
};

const actionStateLabels = {
  ActionState.needed: 'Needed',
  ActionState.assigned: 'Assigned',
  ActionState.inProgress: 'In progress',
  ActionState.delivered: 'Delivered',
};

/// "N. Wijesinghe (Society Officer)"
String openedByLine(IncidentSummary incident) {
  final role = roleLabels[incident.openedByRole];
  return '${incident.openedByName ?? 'Someone'}${role == null ? '' : ' ($role)'}';
}

/// "Mon 27 Oct, 6:00 p.m. · 1 day 9 hours left": the deadline as words, never a bar.
String? dueLine(IncidentSummary incident, DateTime now) {
  final due = incident.assessmentsDueAt;
  if (due == null) return null;
  final left = accessTimeLeft(due, now);
  return '${accessEnds(due)} · ${left == 'Ended' ? 'deadline passed' : left}';
}

/// "200 L", "40 packs"
String quantityLine(int quantity, String unit) =>
    unit.isEmpty ? '$quantity' : '$quantity $unit';

/// "1,240": counts with thousands separators.
String grouped(int value) {
  final digits = value.toString();
  final out = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
    out.write(digits[i]);
  }
  return out.toString();
}
