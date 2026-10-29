// Mirrors packages/api-contracts/src/identity.ts.
enum UserRole {
  societyOfficer,
  programmeCoordinator,
  deputyDistrictManager,
  districtManager,
  hqAdmin,
}

class DistrictAccessGrant {
  const DistrictAccessGrant({
    required this.districtId,
    required this.startsAt,
    required this.expiresAt,
  });
  final String districtId;
  final DateTime startsAt;
  final DateTime expiresAt;
  bool activeAt(DateTime now) =>
      !now.isBefore(startsAt) && now.isBefore(expiresAt);
}

class AuthenticatedUser {
  const AuthenticatedUser({
    required this.id,
    required this.displayName,
    this.email,
    required this.roles,
    this.districtIds = const [],
    required this.societyIds,
    this.delegatedDistrictAccess = const [],
  });
  final String id;
  final String displayName;
  final String? email;
  final List<UserRole> roles;
  final List<String> districtIds;
  final List<String> societyIds;
  final List<DistrictAccessGrant> delegatedDistrictAccess;
  UserRole get primaryRole => roles.first;
  bool canViewSociety(String id, String districtId, DateTime now) =>
      roles.contains(UserRole.hqAdmin) ||
      societyIds.contains(id) ||
      (roles.contains(UserRole.districtManager) &&
          districtIds.contains(districtId)) ||
      (roles.contains(UserRole.deputyDistrictManager) &&
          delegatedDistrictAccess.any(
            (g) => g.districtId == districtId && g.activeAt(now),
          ));
  bool canEditSociety(String id) =>
      roles.contains(UserRole.hqAdmin) ||
      (roles.any(
            (r) => [
              UserRole.societyOfficer,
              UserRole.programmeCoordinator,
              UserRole.deputyDistrictManager,
            ].contains(r),
          ) &&
          societyIds.contains(id));
  factory AuthenticatedUser.fromJson(Map<String, dynamic> json) =>
      AuthenticatedUser(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        roles: (json['roles'] as List)
            .map(
              (r) => switch (r) {
                'SOCIETY_OFFICER' => UserRole.societyOfficer,
                'PROGRAMME_COORDINATOR' => UserRole.programmeCoordinator,
                'DEPUTY_DISTRICT_MANAGER' => UserRole.deputyDistrictManager,
                'DISTRICT_MANAGER' => UserRole.districtManager,
                'HQ_ADMIN' => UserRole.hqAdmin,
                _ => throw FormatException('Unknown role'),
              },
            )
            .toList(),
        districtIds: List<String>.from(json['districtIds'] as List),
        societyIds: List<String>.from(json['societyIds'] as List),
        delegatedDistrictAccess:
            ((json['delegatedDistrictAccess'] as List?) ?? [])
                .map(
                  (g) => DistrictAccessGrant(
                    districtId: g['districtId'] as String,
                    startsAt: DateTime.parse(
                      (g['startsAt'] as String?) ?? '1970-01-01T00:00:00Z',
                    ),
                    expiresAt: DateTime.parse(g['expiresAt'] as String),
                  ),
                )
                .toList(),
      );
}

extension UserRoleLabels on UserRole {
  String get label => switch (this) {
    UserRole.societyOfficer => 'Society Officer',
    UserRole.programmeCoordinator => 'SPC',
    UserRole.deputyDistrictManager => 'Deputy District Manager',
    UserRole.districtManager => 'District Manager',
    UserRole.hqAdmin => 'HQ',
  };
  String get apiValue => switch (this) {
    UserRole.societyOfficer => 'SOCIETY_OFFICER',
    UserRole.programmeCoordinator => 'PROGRAMME_COORDINATOR',
    UserRole.deputyDistrictManager => 'DEPUTY_DISTRICT_MANAGER',
    UserRole.districtManager => 'DISTRICT_MANAGER',
    UserRole.hqAdmin => 'HQ_ADMIN',
  };
}
