import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/economy/economy_models.dart';

/// Issue #146: the phone's copy of the Village Economic Profile catalogue must
/// equal the shared contract (`packages/api-contracts/src/economy.ts`), which
/// the API's copy is already checked against. A new product or unit then
/// fails here until the phone, and its translations, know it too.
void main() {
  final contract = File('../../packages/api-contracts/src/economy.ts')
      .readAsStringSync();

  /// The quoted strings of `export const NAME = [ ... ] as const`.
  List<String> list(String name) {
    final body = RegExp(
      'export const $name = \\[(.*?)\\] as const',
      dotAll: true,
    ).firstMatch(contract)!.group(1)!;
    return RegExp(r'"([A-Z_]+)"').allMatches(body).map((m) => m[1]!).toList();
  }

  int number(String name) => int.parse(
    RegExp('export const $name = ([0-9_]+);')
        .firstMatch(contract)!
        .group(1)!
        .replaceAll('_', ''),
  );

  test('industries, statuses, bases and measurements match', () {
    expect(economyIndustries, list('ECONOMY_INDUSTRIES'));
    expect(businessStatuses, list('BUSINESS_STATUSES'));
    expect(productionBases, list('PRODUCTION_BASES'));
    expect(productionMeasurements, list('PRODUCTION_MEASUREMENTS'));
  });

  test('units and their decimal places match', () {
    final units = {
      for (final m in RegExp(
        r'\{ code: "([A-Z]+)", decimals: (\d) \}',
      ).allMatches(contract))
        m[1]!: int.parse(m[2]!),
    };
    expect(productionUnits, units);
  });

  test('products, their industry, kind and unit match', () {
    final products = [
      for (final m in RegExp(
        r'\{ code: "([A-Z_]+)", industry: (null|"[A-Z_]+"), kind: (null|"[A-Z]+"), unit: (null|"[A-Z]+") \}',
      ).allMatches(contract))
        [m[1], m[2], m[3], m[4]].map((v) => v!.replaceAll('"', '')).join('|'),
    ];
    expect(products, hasLength(economyProducts.length));
    expect([
      for (final p in economyProducts)
        [
          p.code,
          p.industry ?? 'null',
          p.kind ?? 'null',
          p.unit ?? 'null',
        ].join('|'),
    ], products);
  });

  test('limits match', () {
    expect(maxProductionQuantity, number('MAX_PRODUCTION_QUANTITY'));
    expect(maxSeasonDays, number('MAX_SEASON_DAYS'));
  });
}
