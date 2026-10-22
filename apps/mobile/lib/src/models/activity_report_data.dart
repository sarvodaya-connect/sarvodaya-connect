import 'activity_draft.dart';

/// Immutable copy of the fields in a submitted M09 activity report.
/// This is demo session state, not a persisted backend record.
class ActivityReportData {
  const ActivityReportData({
    required this.title,
    required this.date,
    required this.location,
    required this.gpsLocation,
    required this.activityType,
    required this.description,
    required this.sector,
    required this.dimension,
    required this.femaleParticipants,
    required this.maleParticipants,
    required this.outcomes,
    required this.supportingInformation,
  });

  factory ActivityReportData.fromDraft(ActivityDraft draft) =>
      ActivityReportData(
        title: draft.title,
        date: draft.date,
        location: draft.location,
        gpsLocation: draft.gpsLocation,
        activityType: draft.activityType,
        description: draft.description,
        sector: draft.sector,
        dimension: draft.dimension,
        femaleParticipants: draft.femaleParticipants,
        maleParticipants: draft.maleParticipants,
        outcomes: draft.outcomes,
        supportingInformation: draft.supportingInformation,
      );

  final String title;
  final String date;
  final String location;
  final String gpsLocation;
  final String activityType;
  final String description;
  final String sector;
  final String dimension;
  final String femaleParticipants;
  final String maleParticipants;
  final String outcomes;
  final String supportingInformation;
}
