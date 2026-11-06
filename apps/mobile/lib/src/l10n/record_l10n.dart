import '../models/user.dart';
import '../society_record/record_widgets.dart' as english;
import '../society_record/society_record_api.dart';
import '../society_record/society_record_models.dart';
import 'l10n.dart';
import 'l10n_format.dart';

/// Society record wording in the chosen language (issue #108 phase 3).
/// Stored values such as "President", "MOTHERS" or a grade letter stay as the
/// API sends them; only what people read is translated. English keeps the
/// exact text the app showed before.
extension RecordL10n on AppLocalizations {
  /// "Society Officer", "SPC", "DDM", "DM" or "HQ". Acronyms stay as they are.
  String recordRole(UserRole role) => switch (role) {
    UserRole.societyOfficer => recRoleSocietyOfficer,
    _ => role.recordLabel,
  };

  /// "N. Wijesinghe (Society Officer)".
  String actor(ActorRef actor) => actor.role == null
      ? actor.displayName
      : '${actor.displayName} (${recordRole(actor.role!)})';

  /// An office bearer's title, or "Member" for anyone else.
  String office(String position) => switch (position) {
    'President' => recOfficePresident,
    'Secretary' => recOfficeSecretary,
    'Treasurer' => recOfficeTreasurer,
    _ => recOfficeMember,
  };

  String offices(List<String> positions) => positions.map(office).join(', ');

  String seatGroup(String seatType) => switch (seatType) {
    'CHILDREN' => recSeatChildren,
    'YOUTH' => recSeatYouth,
    'MOTHERS' => recSeatMothers,
    'ORDINARY' => recSeatOrdinary,
    'ELDERS_COUNCIL' => recSeatElders,
    _ => seatType,
  };

  String gradeName(String grade) => switch (grade) {
    'A' => recGradeA,
    'B' => recGradeB,
    'C' => recGradeC,
    _ => grade,
  };

  /// "Grade B · Developing", or "Grade not set".
  String gradeFull(String? grade) =>
      grade == null ? recGradeNotSet : recGradeFull(grade, gradeName(grade));

  /// "today 10:02", "22 Oct" or "12 Mar 2025".
  String recordWhen(DateTime when, DateTime now) {
    if (localeName == 'en') return english.formatWhen(when, now);
    final sameDay =
        when.year == now.year && when.month == now.month && when.day == now.day;
    if (sameDay) {
      return recToday(
        '${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}',
      );
    }
    return date(when);
  }

  /// "Exco not entered yet", "12 of 25", "No Treasurer" or "Complete".
  String excoShort(ExcoStatus status) => status.complete
      ? recExcoShortComplete
      : status.filledSeats == 0
      ? recExcoShortNone
      : status.toFill > 0
      ? recExcoShortSeats(status.filledSeats)
      : status.missingOffices.isNotEmpty
      ? recExcoShortOffices(offices(status.missingOffices))
      : recExcoShortCheck;

  /// Why the viewer can see personal details (V5 M07v / M07d note).
  String excoAccessNote(SocietyRecord record) =>
      switch (record.permissions.viewOnlyReason) {
        ViewOnlyReason.districtManager => excoNoteDistrict,
        ViewOnlyReason.temporaryDistrictAccess => excoNoteTemporary,
        null => record.permissions.canEdit ? excoNoteYours : excoNoteAccess,
      };

  /// The message for a failed request: the app's own wording in the chosen
  /// language, or what the server said (still English, phase 9).
  String recordError(Object error) => error is SocietyRecordException
      ? (error.failure == null ? error.message : failure(error.failure!))
      : error.toString();
}
