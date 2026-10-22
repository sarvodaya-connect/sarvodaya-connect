/// Female and male membership counts for one approved society category.
class MembershipCategoryCounts {
  const MembershipCategoryCounts({
    required this.category,
    required this.female,
    required this.male,
    this.note,
  });

  final String category;
  final int female;
  final int male;

  /// Age range or rule shown under the category, for example "7–14 years".
  final String? note;

  int get total => female + male;
}

/// Quarterly membership counts for M08 (Screen Catalogue v3).
class MembershipSummary {
  const MembershipSummary({
    required this.year,
    required this.period,
    required this.categories,
    required this.familiesWithMember,
    required this.villageFamilies,
    required this.changeSincePrevious,
    required this.previousPeriod,
  });

  final int year;
  final String period;
  final List<MembershipCategoryCounts> categories;
  final int familiesWithMember;
  final int villageFamilies;
  final int changeSincePrevious;
  final String previousPeriod;

  int get femaleTotal => categories.fold(0, (sum, item) => sum + item.female);
  int get maleTotal => categories.fold(0, (sum, item) => sum + item.male);
  int get overallTotal => femaleTotal + maleTotal;
}
