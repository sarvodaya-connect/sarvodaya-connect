/// Small formatting helpers so the app does not need an extra date package.
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

/// 01 Oct 2026
String formatDate(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')} ${_months[date.month - 1]} ${date.year}';

/// 01 Oct 2026, 09:15
String formatDateTime(DateTime date) =>
    '${formatDate(date)}, ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';

/// 1.4 MB / 220 KB
String formatFileSize(int bytes) {
  if (bytes >= 1000000) return '${(bytes / 1000000).toStringAsFixed(1)} MB';
  return '${(bytes / 1000).round()} KB';
}
