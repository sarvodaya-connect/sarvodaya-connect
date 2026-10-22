/// M09 demonstration draft. The app's current demo store is in memory only.
/// A later API-backed activity repository must replace this session storage.
class ActivityDraft {
  String title = '';
  String date = '';
  String location = '';
  String activityType = '';
  String gpsLocation = '';
  String description = '';
  String sector = '';
  String dimension = '';
  String outcomes = '';
  String supportingInformation = '';
  String femaleParticipants = '';
  String maleParticipants = '';
}

/// Drafts survive step changes and reopening M09 within the same signed-in
/// demo-store session, but not an application restart.
class ActivityDraftRegistry {
  static final Expando<ActivityDraft> _drafts = Expando<ActivityDraft>();

  static ActivityDraft forStore(Object store) =>
      _drafts[store] ??= ActivityDraft();

  static void clear(Object store) {
    _drafts[store] = null;
  }
}
