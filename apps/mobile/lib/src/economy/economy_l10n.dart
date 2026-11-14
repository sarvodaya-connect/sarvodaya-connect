import 'package:intl/intl.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import 'economy_models.dart';

const _englishMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// Issue #146: Village Economic Profile wording in the chosen language.
/// Codes stay as the API sends them; only what people read is translated.
extension EconomyL10n on AppLocalizations {
  String industryName(String code) => switch (code) {
    'AGRICULTURE' => vepIndustryAgriculture,
    'LIVESTOCK_DAIRY' => vepIndustryLivestockDairy,
    'FISHERIES' => vepIndustryFisheries,
    'FOOD_PROCESSING' => vepIndustryFoodProcessing,
    'TEXTILES_GARMENTS' => vepIndustryTextilesGarments,
    'HANDICRAFTS' => vepIndustryHandicrafts,
    'SERVICES' => vepIndustryServices,
    'OTHER' => vepIndustryOther,
    _ => code,
  };

  /// The industry, or what the officer typed for Other.
  String businessIndustry(SocietyBusiness business) =>
      business.industry == 'OTHER' && business.otherIndustry != null
      ? business.otherIndustry!
      : industryName(business.industry);

  String statusName(String code) => switch (code) {
    'OPERATING' => vepStatusOperating,
    'SEASONAL' => vepStatusSeasonal,
    'TEMPORARILY_STOPPED' => vepStatusTemporarilyStopped,
    'CLOSED' => vepStatusClosed,
    _ => code,
  };

  String productName(String code) => switch (code) {
    'MILK' => vepProductMilk,
    'CURD' => vepProductCurd,
    'EGGS' => vepProductEggs,
    'PADDY' => vepProductPaddy,
    'VEGETABLES' => vepProductVegetables,
    'FRUIT' => vepProductFruit,
    'COCONUTS' => vepProductCoconuts,
    'TEA_LEAF' => vepProductTeaLeaf,
    'FISH' => vepProductFish,
    'DRIED_FISH' => vepProductDriedFish,
    'RICE_FLOUR' => vepProductRiceFlour,
    'SNACK_PACKETS' => vepProductSnackPackets,
    'GARMENTS' => vepProductGarments,
    'HANDLOOM_FABRIC' => vepProductHandloomFabric,
    'HANDICRAFT_ITEMS' => vepProductHandicraftItems,
    'TAILORING_JOBS' => vepProductTailoringJobs,
    'REPAIR_JOBS' => vepProductRepairJobs,
    'OTHER' => vepProductOther,
    _ => code,
  };

  /// A product's name, or the officer's description for Other.
  String outputName(BusinessOutput output) =>
      output.product == 'OTHER' && output.otherDescription != null
      ? output.otherDescription!
      : productName(output.product);

  /// The unit as a word for pickers and help text: "Litres".
  String unitName(String code) => switch (code) {
    'LITRE' => vepUnitLitre,
    'KILOGRAM' => vepUnitKilogram,
    'METRE' => vepUnitMetre,
    'ITEM' => vepUnitItem,
    'NUT' => vepUnitNut,
    'EGG' => vepUnitEgg,
    'PACKET' => vepUnitPacket,
    'JOB' => vepUnitJob,
    _ => code,
  };

  String basisName(String code) => switch (code) {
    'WEEKLY' => vepBasisWeekly,
    'MONTHLY' => vepBasisMonthly,
    'SEASONAL' => vepBasisSeasonal,
    _ => code,
  };

  String measurementName(String code) =>
      code == 'ESTIMATED' ? vepEstimated : vepActual;

  /// "3,200" or "182.5": grouped, with only the decimals that were typed.
  String quantityNumber(double value) {
    final format = NumberFormat.decimalPattern(localeName)
      ..maximumFractionDigits = 3;
    return format.format(value);
  }

  /// "3,200 litres", "182.5 kg", "1 job".
  String quantity(double value, String unit) {
    final text = quantityNumber(value);
    return switch (unit) {
      'LITRE' => vepQtyLitre(value, text),
      'KILOGRAM' => vepQtyKilogram(value, text),
      'METRE' => vepQtyMetre(value, text),
      'ITEM' => vepQtyItem(value, text),
      'NUT' => vepQtyNut(value, text),
      'EGG' => vepQtyEgg(value, text),
      'PACKET' => vepQtyPacket(value, text),
      'JOB' => vepQtyJob(value, text),
      _ => '$text $unit',
    };
  }

  /// "October 2026" in the chosen language.
  String monthName(DateTime start) {
    final english = '${_englishMonths[start.month - 1]} ${start.year}';
    if (localeName == 'en') return english;
    try {
      return DateFormat('MMMM y', localeName).format(start);
    } catch (_) {
      // Month names are loaded with the app's localization delegates.
      return english;
    }
  }

  /// "October 2026", "05 Oct 2026 – 11 Oct 2026" or
  /// "Maha 2026/27 (01 Oct 2026 – 31 Mar 2027)": always the covered days.
  String period(ProductionPeriod period) {
    final range = vepPeriodRange(date(period.startsOn), date(period.endsOn));
    return switch (period.basis) {
      'MONTHLY' => monthName(period.startsOn),
      'SEASONAL' => vepPeriodSeason(period.seasonLabel ?? '', range),
      _ => range,
    };
  }

  /// "Milk: 3,200 litres · October 2026 · Actual".
  String productionLine(
    String product,
    double value,
    String unit,
    ProductionPeriod period,
    String measurement,
  ) =>
      '$product: ${quantity(value, unit)} · ${this.period(period)} · ${measurementName(measurement)}';

  /// "Milk · Litres": a product or service with the unit it is measured in.
  String withUnit(String name, String unit) => '$name · $unit';
}
