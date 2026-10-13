// Mirrors CommitteeMember from packages/api-contracts/src/registry.ts.
// Council seat types come from Screen Catalogue v2 (25-seat Executive Council)
// and are UI-only until the contracts add them.

enum CouncilSeatType { child, youth, mother, ordinary, elder }

extension CouncilSeatTypeInfo on CouncilSeatType {
  String get label => switch (this) {
    CouncilSeatType.child => 'Child',
    CouncilSeatType.youth => 'Youth',
    CouncilSeatType.mother => 'Mother',
    CouncilSeatType.ordinary => 'Ordinary',
    CouncilSeatType.elder => 'Elders Council',
  };

  /// Seats of this type in the 25-seat Council (18 Executive Members + 7 Elders).
  int get seatCount => switch (this) {
    CouncilSeatType.child => 3,
    CouncilSeatType.youth => 3,
    CouncilSeatType.mother => 3,
    CouncilSeatType.ordinary => 9,
    CouncilSeatType.elder => 7,
  };

  /// Inclusive age range for seats that have one, otherwise null.
  ({int min, int max})? get ageRange => switch (this) {
    CouncilSeatType.child => (min: 7, max: 14),
    CouncilSeatType.youth => (min: 15, max: 25),
    _ => null,
  };
}

class CommitteeMember {
  const CommitteeMember({
    required this.id,
    required this.fullName,
    required this.position,
    required this.seatType,
    this.phone,
    this.email,
    this.age,
    this.appointedOn,
    this.endedOn,
    required this.isActive,
    this.isPrimaryContact = false,
  });

  final String id;
  final String fullName;

  /// Office or role, for example "Treasurer" or "Executive member".
  final String position;
  final CouncilSeatType seatType;
  final String? phone;
  final String? email;
  final int? age;
  final DateTime? appointedOn;
  final DateTime? endedOn;
  final bool isActive;
  final bool isPrimaryContact;

  bool get isOfficeBearer =>
      const {'President', 'Secretary', 'Treasurer'}.contains(position);

  String get initials {
    final parts = fullName
        .replaceAll('.', ' ')
        .split(' ')
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}
