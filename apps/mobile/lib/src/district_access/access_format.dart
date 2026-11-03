/// Sri Lanka time for the access screens (UTC+05:30, no daylight saving).
DateTime sriLanka(DateTime value) =>
    value.toUtc().add(const Duration(hours: 5, minutes: 30));

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

String _time(DateTime local) {
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  return '$hour:$minute ${local.hour < 12 ? 'a.m.' : 'p.m.'}';
}

/// "27 Oct, 8:00 a.m."
String accessDateTime(DateTime value) {
  final local = sriLanka(value);
  return '${local.day} ${_months[local.month - 1]}, ${_time(local)}';
}

/// "Fri 31 Oct, 6:00 p.m."
String accessEnds(DateTime value) {
  final local = sriLanka(value);
  return '${_days[local.weekday - 1]} ${local.day} ${_months[local.month - 1]}, ${_time(local)}';
}

/// "4 days left", "3 days 8 hours left": time left as words, never a bar
/// (V5 DD02, M05t, M32).
String accessTimeLeft(DateTime until, DateTime now) {
  final left = until.difference(now);
  if (left <= Duration.zero) return 'Ended';
  final hours = left.inHours;
  final days = hours ~/ 24, rest = hours % 24;
  if (days >= 4) return '$days days left';
  if (days >= 1) {
    final dayWord = days == 1 ? 'day' : 'days';
    final restWord = rest == 1 ? 'hour' : 'hours';
    return rest == 0
        ? '$days $dayWord left'
        : '$days $dayWord $rest $restWord left';
  }
  if (hours >= 1) return '$hours ${hours == 1 ? 'hour' : 'hours'} left';
  return 'Less than an hour left';
}

/// "4 days 10 hours" (M31 "Length").
String accessLength(DateTime start, DateTime end) {
  final hours = end.difference(start).inHours;
  final days = hours ~/ 24, rest = hours % 24;
  if (days == 0) return '$hours ${hours == 1 ? 'hour' : 'hours'}';
  return '$days ${days == 1 ? 'day' : 'days'}${rest == 0 ? '' : ' $rest ${rest == 1 ? 'hour' : 'hours'}'}';
}
