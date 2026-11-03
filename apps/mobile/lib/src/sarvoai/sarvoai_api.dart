import '../auth/api_auth_service.dart';
import '../auth/auth_service.dart';
import '../models/user.dart';

typedef Json = Map<String, dynamic>;

/// SarvoAI answer kinds from the API (PR #74, `packages/api-contracts`).
enum AnswerKind { answer, clarify, noMatch, incomplete, unsupported }

AnswerKind _kind(String value) => switch (value) {
  'CLARIFY' => AnswerKind.clarify,
  'NO_MATCH' => AnswerKind.noMatch,
  'INCOMPLETE' => AnswerKind.incomplete,
  'UNSUPPORTED' => AnswerKind.unsupported,
  _ => AnswerKind.answer,
};

class AnswerScope {
  const AnswerScope({
    this.financialYears = const [],
    this.district,
    this.currency,
    this.included,
    this.excluded,
    this.excludedReason,
  });

  factory AnswerScope.fromJson(Json json) => AnswerScope(
    financialYears: [
      for (final year in (json['financialYears'] as List?) ?? const [])
        year as String,
    ],
    district: json['district'] as String?,
    currency: json['currency'] as String?,
    included: (json['societiesIncluded'] as num?)?.toInt(),
    excluded: (json['societiesExcluded'] as num?)?.toInt(),
    excludedReason: json['excludedReason'] as String?,
  );

  final List<String> financialYears;
  final String? district;
  final String? currency;
  final int? included;
  final int? excluded;
  final String? excludedReason;
}

class AnswerTable {
  const AnswerTable(this.columns, this.rows, this.totalRows);

  factory AnswerTable.fromJson(Json json) => AnswerTable(
    [for (final column in json['columns'] as List) column as String],
    [
      for (final row in json['rows'] as List)
        [for (final cell in row as List) cell as Object?],
    ],
    (json['totalRows'] as num).toInt(),
  );

  final List<String> columns;
  final List<List<Object?>> rows;
  final int totalRows;
}

/// One SarvoAI answer. Figures, the table and the sources come from the
/// records the API read, never from the model's own words.
class SarvoAiAnswer {
  const SarvoAiAnswer({
    required this.kind,
    required this.summary,
    this.options = const [],
    this.scope,
    this.table,
    this.recordsUsed = const [],
    this.calculation,
    required this.dataAsOf,
    this.sample = false,
  });

  factory SarvoAiAnswer.fromJson(Json json) {
    final details = (json['details'] as Json?) ?? const {};
    return SarvoAiAnswer(
      kind: _kind(json['kind'] as String),
      summary: json['summary'] as String,
      options: [
        for (final option in (json['options'] as List?) ?? const [])
          option as String,
      ],
      scope: json['scope'] == null
          ? null
          : AnswerScope.fromJson(json['scope'] as Json),
      table: json['table'] == null
          ? null
          : AnswerTable.fromJson(json['table'] as Json),
      recordsUsed: [
        for (final record in (details['recordsUsed'] as List?) ?? const [])
          record as String,
      ],
      calculation: details['calculation'] as String?,
      dataAsOf: DateTime.parse(json['dataAsOf'] as String),
    );
  }

  final AnswerKind kind;
  final String summary;
  final List<String> options;
  final AnswerScope? scope;
  final AnswerTable? table;
  final List<String> recordsUsed;
  final String? calculation;
  final DateTime dataAsOf;

  /// Demonstration mode only: the answer is fictional sample data.
  final bool sample;
}

/// A refused or failed question. [status] is the HTTP status (0 offline).
class SarvoAiException implements Exception {
  const SarvoAiException(this.message, {this.status = 0});

  final String message;
  final int status;

  @override
  String toString() => message;
}

/// SarvoAI on the phone (M80–M89). The API allows HQ only and answers only
/// from society profiles, Exco lists, yearly total profit and expenses, and
/// which yearly figures were submitted.
abstract interface class SarvoAiApi {
  Future<SarvoAiAnswer> ask(
    String question, {
    List<({String role, String text})> history,
  });
}

class HttpSarvoAiApi implements SarvoAiApi {
  HttpSarvoAiApi(this.api);

  final IdentityApi api;

  @override
  Future<SarvoAiAnswer> ask(
    String question, {
    List<({String role, String text})> history = const [],
  }) async {
    try {
      final data = await api.request(
        '/assistant/questions',
        method: 'POST',
        body: {
          'question': question,
          'history': [
            for (final turn
                in history.length > 10
                    ? history.sublist(history.length - 10)
                    : history)
              {'role': turn.role, 'text': turn.text},
          ],
        },
      );
      return SarvoAiAnswer.fromJson(data as Json);
    } on IdentityError catch (error) {
      throw SarvoAiException(error.message, status: error.status);
    } on AuthNetworkException {
      throw const SarvoAiException(
        'The server did not answer. Check your connection and try again.',
      );
    } on AuthServiceException {
      throw const SarvoAiException(
        'SarvoAI isn’t available right now.',
        status: 503,
      );
    }
  }
}

/// Demonstration mode only: fictional answers to the V5 example questions,
/// labelled "sample data" on screen. Like the server, it refuses every role
/// but HQ.
class DemoSarvoAiApi implements SarvoAiApi {
  DemoSarvoAiApi({
    required this.user,
    this.delay = const Duration(milliseconds: 600),
  });

  final AuthenticatedUser? Function() user;
  final Duration delay;

  @override
  Future<SarvoAiAnswer> ask(
    String question, {
    List<({String role, String text})> history = const [],
  }) async {
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    if (user()?.roles.contains(UserRole.hqAdmin) != true) {
      throw const SarvoAiException('SarvoAI is for HQ only', status: 403);
    }
    return demoSarvoAiAnswer(
      question,
      earlier: history.map((turn) => turn.text).join(' '),
    );
  }
}

SarvoAiAnswer demoSarvoAiAnswer(String question, {String earlier = ''}) {
  final q = question.toLowerCase();
  final now = DateTime.now();
  const kurunegala = AnswerScope(
    financialYears: ['FY 2025/26'],
    district: 'Kurunegala',
    currency: 'LKR',
    included: 88,
    excluded: 10,
    excludedReason: 'figures not added',
  );
  const profits = [
    ['Pahala Kosgama SSS', 'Kuliyapitiya East DS', 612400],
    ['Giriulla SSS', 'Narammala DS', 544900],
    ['Nikaweratiya SSS', 'Nikaweratiya DS', 498250],
    ['Wariyapola North SSS', 'Wariyapola DS', 471800],
    ['Maho Ihala SSS', 'Maho DS', 455100],
  ];
  if (RegExp(r'share capital|savings|loan|asset|cash|bank').hasMatch(q)) {
    return SarvoAiAnswer(
      kind: AnswerKind.unsupported,
      summary: 'Only yearly total profit and total expenses are recorded. Share capital, savings, loans, assets and cash are not, so there is nothing to answer from.',
      options: const ['Average profit in Kurunegala'],
      dataAsOf: now,
      sample: true,
    );
  }
  if (RegExp(r'\bbest\b').hasMatch(q)) {
    return SarvoAiAnswer(
      kind: AnswerKind.clarify,
      summary:
          'What do you mean by “best”? Pick one, or add a year and a district.',
      options: const [
        'Highest profit FY 2025/26',
        'Class A societies',
        'Above LKR 100,000 for five years',
      ],
      dataAsOf: now,
      sample: true,
    );
  }
  if (q.contains('president')) {
    return SarvoAiAnswer(
      kind: AnswerKind.answer,
      summary: 'The president of Pahala Kosgama SSS is A. Jayasekara.',
      table: const AnswerTable(
        ['Society', 'Position', 'Name', 'Appointed'],
        [
          ['Pahala Kosgama SSS', 'President', 'A. Jayasekara', '14 Jun 2026'],
        ],
        1,
      ),
      recordsUsed: const ['Exco list · Pahala Kosgama SSS (S-104233)'],
      calculation: 'Direct lookup of the President on the current Exco. Phone, address and NIC are not shown.',
      dataAsOf: now,
      sample: true,
    );
  }
  if (q.contains('mannar')) {
    return SarvoAiAnswer(
      kind: AnswerKind.noMatch,
      summary: 'None of the 15 Mannar societies with FY 2025/26 figures had a total profit above LKR 1,000,000. 1 has not added its figure.',
      options: const ['Above LKR 250,000', 'All districts'],
      scope: const AnswerScope(
        financialYears: ['FY 2025/26'],
        district: 'Mannar',
        currency: 'LKR',
        included: 15,
        excluded: 1,
        excludedReason: 'not added',
      ),
      recordsUsed: const ['Annual summary · total profit, FY 2025/26 · Mannar'],
      dataAsOf: now,
      sample: true,
    );
  }
  if (q.contains('mullaitivu')) {
    return SarvoAiAnswer(
      kind: AnswerKind.incomplete,
      summary: 'Only 6 of 17 societies have added figures. Too few for a reliable district average, so none is given. The 6 that submitted averaged LKR 142,300 — not the district average.',
      options: const ['See the 11 not added'],
      scope: const AnswerScope(
        financialYears: ['FY 2025/26'],
        district: 'Mullaitivu',
        currency: 'LKR',
        included: 6,
        excluded: 11,
        excludedReason: 'not added',
      ),
      recordsUsed: const [
        'Annual summary · total profit, FY 2025/26 · Mullaitivu',
      ],
      dataAsOf: now,
      sample: true,
    );
  }
  if (q.contains('highest') && earlier.toLowerCase().contains('average')) {
    return SarvoAiAnswer(
      kind: AnswerKind.answer,
      summary: 'Pahala Kosgama SSS had the highest total profit: LKR 612,400.',
      scope: kurunegala,
      table: const AnswerTable(
        ['Society', 'DS division', 'Total profit FY 2025/26 (LKR)'],
        profits,
        88,
      ),
      recordsUsed: const [
        'Annual summary · total profit, FY 2025/26 · the same 88 societies',
      ],
      dataAsOf: now,
      sample: true,
    );
  }
  if (q.contains('average')) {
    return SarvoAiAnswer(
      kind: AnswerKind.answer,
      summary: 'Average total profit was LKR 298,400 per society across 88 Kurunegala societies in FY 2025/26.',
      scope: kurunegala,
      table: const AnswerTable(
        ['Society', 'DS division', 'Total profit FY 2025/26 (LKR)'],
        profits,
        88,
      ),
      recordsUsed: const [
        'Annual summary · total profit for the year',
        'Society profile · Kurunegala, 98 active',
      ],
      calculation: 'LKR 26,259,200 ÷ 88 = LKR 298,400 · rounded to LKR 100',
      dataAsOf: now,
      sample: true,
    );
  }
  if (RegExp(r'100,000').hasMatch(q) &&
      !RegExp(r'each|every|at least|combined').hasMatch(q)) {
    return SarvoAiAnswer(
      kind: AnswerKind.clarify,
      summary: 'Which do you mean? “More than LKR 100,000 profit in the last five years” can be read in three ways.',
      options: const [
        'More than LKR 100,000 in each of the five years',
        'More than LKR 100,000 in at least one of the five years',
        'More than LKR 100,000 combined over the five years',
      ],
      dataAsOf: now,
      sample: true,
    );
  }
  if (RegExp(r'not (submitted|added)|missing').hasMatch(q)) {
    return SarvoAiAnswer(
      kind: AnswerKind.answer,
      summary: '108 societies have not submitted their FY 2025/26 profit and expenses.',
      scope: const AnswerScope(financialYears: ['FY 2025/26'], included: 1076),
      recordsUsed: const [
        'Annual summary status · FY 2025/26 · all 25 districts, 1,076 active',
      ],
      dataAsOf: now,
      sample: true,
    );
  }
  return SarvoAiAnswer(
    kind: AnswerKind.unsupported,
    summary: 'This demonstration only answers the example questions.',
    options: const ['Who is the president of Pahala Kosgama SSS?'],
    dataAsOf: now,
    sample: true,
  );
}
