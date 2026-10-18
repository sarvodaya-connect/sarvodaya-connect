// Mirrors AuthenticatedUser from packages/api-contracts/src/identity.ts.

enum UserRole { societyOfficer, districtManager, hqAdmin }

class AuthenticatedUser {
  const AuthenticatedUser({
    required this.id,
    required this.displayName,
    this.email,
    required this.roles,
    this.districtIds = const [],
    required this.societyIds,
  });

  final String id;
  final String displayName;
  final String? email;
  final List<UserRole> roles;
  final List<String> districtIds;
  final List<String> societyIds;

  UserRole get primaryRole => roles.first;
}

extension UserRoleLabels on UserRole {
  String get label => switch (this) {
    UserRole.societyOfficer => 'Society Officer',
    UserRole.districtManager => 'District Manager',
    UserRole.hqAdmin => 'HQ Administrator',
  };
}
