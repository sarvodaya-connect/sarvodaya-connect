/// Female and male membership counts for one approved society category.
class MembershipCategoryCounts {
  const MembershipCategoryCounts({
    required this.category,
    required this.female,
    required this.male,
  });

  final String category;
  final int female;
  final int male;

  int get total => female + male;
}

/// Annual, approved membership snapshot for M08.
class MembershipSummary {
  const MembershipSummary({required this.year, required this.categories});

  final int year;
  final List<MembershipCategoryCounts> categories;

  int get femaleTotal => categories.fold(0, (sum, item) => sum + item.female);
  int get maleTotal => categories.fold(0, (sum, item) => sum + item.male);
  int get overallTotal => femaleTotal + maleTotal;
}
