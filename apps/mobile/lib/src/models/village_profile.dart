/// Fictional, read-only community information for the mobile demonstration.
class VillageProfile {
  const VillageProfile({
    required this.name,
    required this.gnDivision,
    required this.population,
    required this.households,
    required this.womenHeadedHouseholds,
    required this.residentsWithDisabilities,
    required this.eldersOverSixty,
    required this.femaleShare,
    required this.maleShare,
    required this.keyStatistics,
    required this.livelihoods,
    required this.priorityIssues,
  });

  final String name;
  final String gnDivision;
  final int population;
  final int households;
  final int womenHeadedHouseholds;
  final int residentsWithDisabilities;
  final int eldersOverSixty;
  final int femaleShare;
  final int maleShare;
  final List<VillageStatistic> keyStatistics;
  final List<VillageShare> livelihoods;
  final List<String> priorityIssues;
}

class VillageStatistic {
  const VillageStatistic({required this.label, required this.value});

  final String label;
  final String value;
}

class VillageShare {
  const VillageShare({required this.name, required this.percent});

  final String name;
  final int percent;
}
