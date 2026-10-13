// Mirrors AuthenticatedUser from packages/api-contracts/src/identity.ts.

enum UserRole { societyOfficer, districtManager, hqAdmin }

class AuthenticatedUser {
  const AuthenticatedUser({
    required this.id,
    required this.displayName,
    this.email,
    required this.roles,
    required this.societyIds,
  });

  final String id;
  final String displayName;
  final String? email;
  final List<UserRole> roles;
  final List<String> societyIds;
}
