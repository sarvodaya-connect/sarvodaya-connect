import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/user.dart';

void main() {
  final now = DateTime.utc(2026, 10, 29, 12);
  test('DDM can edit assignments and only view a temporary district', () {
    final user = AuthenticatedUser(
      id: 'ddm',
      displayName: 'Test DDM',
      roles: [UserRole.deputyDistrictManager],
      districtIds: ['district-a'],
      societyIds: ['society-a'],
      delegatedDistrictAccess: [
        DistrictAccessGrant(
          districtId: 'district-a',
          startsAt: now.subtract(const Duration(hours: 1)),
          expiresAt: now.add(const Duration(hours: 1)),
        ),
      ],
    );
    expect(user.canEditSociety('society-a'), isTrue);
    expect(user.canEditSociety('society-b'), isFalse);
    expect(user.canViewSociety('society-b', 'district-a', now), isTrue);
    expect(user.canViewSociety('society-b', 'district-b', now), isFalse);
    expect(
      user.canViewSociety(
        'society-b',
        'district-a',
        now.add(const Duration(hours: 1)),
      ),
      isFalse,
    );
  });
  test('SPC district affiliation never gives district-wide visibility', () {
    const user = AuthenticatedUser(
      id: 'spc',
      displayName: 'Test SPC',
      roles: [UserRole.programmeCoordinator],
      districtIds: ['district-a'],
      societyIds: ['society-a'],
    );
    expect(user.canViewSociety('society-a', 'district-a', now), isTrue);
    expect(user.canViewSociety('society-b', 'district-a', now), isFalse);
  });
}
