import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../district_access/access_format.dart' as english;
import '../format.dart' as english;
import 'l10n.dart';

/// Why a request failed before the server could say, so the screen can say it
/// in the chosen language. Messages the server sends stay as sent until the
/// API messages phase (docs/localization.md).
enum ClientFailure { offline, server, unreachable }

/// Locale-aware wording for numbers, dates and time left. English keeps the
/// exact text the app showed before, so existing behaviour and tests hold.
extension LocalizedFormat on AppLocalizations {
  bool get _english => localeName == 'en';

  String failure(ClientFailure failure) => switch (failure) {
    ClientFailure.offline => errorOffline,
    ClientFailure.server => errorServer,
    ClientFailure.unreachable => errorUnreachable,
  };

  /// "98,640" in English and Sinhala; Tamil uses its own digit grouping.
  String number(int value) =>
      NumberFormat.decimalPattern(localeName).format(value);

  String greeting(DateTime now, [String? name]) {
    final part = now.hour < 12 ? 0 : (now.hour < 17 ? 1 : 2);
    if (name == null) {
      return [greetingMorning, greetingAfternoon, greetingEvening][part];
    }
    return [
      greetingMorningName,
      greetingAfternoonName,
      greetingEveningName,
    ][part](name);
  }

  String _date(String pattern, DateTime value, String Function() fallback) {
    if (_english) return fallback();
    try {
      return DateFormat(pattern, localeName).format(value);
    } catch (_) {
      // Date names are loaded with the app's localization delegates; a
      // screen pumped without them still gets a readable date.
      return fallback();
    }
  }

  /// "01 Oct 2026"
  String date(DateTime value) =>
      _date('dd MMM y', value, () => english.formatDate(value));

  /// "6:00 p.m." in the language's own way of writing the time.
  String clock(DateTime value) => _date('h:mm a', value, () {
    final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
    return '$hour:${value.minute.toString().padLeft(2, '0')} ${value.hour < 12 ? 'a.m.' : 'p.m.'}';
  });

  /// "27 Oct, 8:00 a.m." in Sri Lanka time.
  String accessDateTime(DateTime value) => _date(
    'd MMM, h:mm a',
    english.sriLanka(value),
    () => english.accessDateTime(value),
  );

  /// "Fri 31 Oct, 6:00 p.m." in Sri Lanka time.
  String accessEndsAt(DateTime value) => _date(
    'EEE d MMM, h:mm a',
    english.sriLanka(value),
    () => english.accessEnds(value),
  );

  /// "4 days left", "3 days 8 hours left": time left as words, never a bar.
  String accessTimeLeft(DateTime until, DateTime now) {
    final left = until.difference(now);
    if (left <= Duration.zero) return accessEnded;
    final hours = left.inHours;
    final days = hours ~/ 24, rest = hours % 24;
    if (days >= 4 || (days >= 1 && rest == 0)) return accessDaysLeft(days);
    if (days >= 1) return accessDaysHoursLeft(days, rest);
    if (hours >= 1) return accessHoursLeft(hours);
    return accessUnderAnHourLeft;
  }

  /// "4 days 10 hours" (M31 "Length").
  String accessDuration(DateTime start, DateTime end) {
    final hours = end.difference(start).inHours;
    final days = hours ~/ 24, rest = hours % 24;
    if (days == 0) return accessLengthHours(hours);
    if (rest == 0) return accessLengthDays(days);
    return accessLengthDaysHours(days, rest);
  }
}

/// Marks where a styled part goes in a translated sentence. Pass it as the
/// placeholder's value, then split with [styledSpans], so a translation can
/// move the styled part anywhere in the sentence.
const styledSlot = '\u0000';

/// [message] split at [styledSlot], with [styled] in its place.
List<InlineSpan> styledSpans(String message, InlineSpan styled) {
  final parts = message.split(styledSlot);
  return [
    for (final (index, part) in parts.indexed) ...[
      if (index > 0) styled,
      if (part.isNotEmpty) TextSpan(text: part),
    ],
  ];
}

/// The same with two styled parts, marked by [styledSlot] and [styledSlot2].
const styledSlot2 = '\u0001';

List<InlineSpan> styledSpans2(
  String message,
  InlineSpan first,
  InlineSpan second,
) => [
  for (final (index, part) in message.split(styledSlot2).indexed) ...[
    if (index > 0) second,
    ...styledSpans(part, first),
  ],
];
