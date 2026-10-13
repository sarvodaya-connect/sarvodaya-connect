import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/committee.dart';
import 'package:sarvodaya_connect_mobile/src/validation/validators.dart';

void main() {
  group('personName', () {
    test('requires a name', () {
      expect(Validators.personName(''), 'Enter the full name.');
      expect(Validators.personName('   '), 'Enter the full name.');
    });

    test('accepts initials and Sinhala or Tamil letters', () {
      expect(Validators.personName('S. Tharmalingam'), isNull);
      expect(Validators.personName("D. O'Neil-Perera"), isNull);
      expect(Validators.personName('නිමාලි'), isNull);
      expect(Validators.personName('தர்மலிங்கம்'), isNull);
    });

    test('rejects digits, symbols and very short names', () {
      expect(Validators.personName('K'), isNotNull);
      expect(Validators.personName('Perera 2'), isNotNull);
      expect(Validators.personName('perera@example'), isNotNull);
    });
  });

  group('sriLankanPhone', () {
    test('accepts +94 and 0 formats with spaces or hyphens', () {
      expect(Validators.sriLankanPhone('+94 00 000 0003'), isNull);
      expect(Validators.sriLankanPhone('000-000-0003'), isNull);
    });

    test('rejects missing, short and foreign numbers', () {
      expect(Validators.sriLankanPhone(''), 'Enter the phone number.');
      expect(Validators.sriLankanPhone('+94 00 000'), isNotNull);
      expect(Validators.sriLankanPhone('+44 20 7946 0000'), isNotNull);
    });
  });

  group('ageForSeat', () {
    test('requires an age in range for Youth and Child seats', () {
      expect(
        Validators.ageForSeat('', CouncilSeatType.youth),
        contains('15–25'),
      );
      expect(Validators.ageForSeat('22', CouncilSeatType.youth), isNull);
      expect(
        Validators.ageForSeat('30', CouncilSeatType.youth),
        'A Youth seat needs someone aged 15–25.',
      );
      expect(
        Validators.ageForSeat('6', CouncilSeatType.child),
        'A Child seat needs someone aged 7–14.',
      );
    });

    test('is optional for Ordinary seats', () {
      expect(Validators.ageForSeat('', CouncilSeatType.ordinary), isNull);
      expect(Validators.ageForSeat('300', CouncilSeatType.ordinary), isNotNull);
    });
  });

  group('startDate', () {
    final today = DateTime(2026, 10, 13);

    test('is required and cannot be in the future', () {
      expect(
        Validators.startDate(null, today: today),
        'Choose the start date.',
      );
      expect(
        Validators.startDate(DateTime(2026, 10, 14), today: today),
        isNotNull,
      );
      expect(Validators.startDate(DateTime(2026, 9, 28), today: today), isNull);
      expect(
        Validators.startDate(DateTime(2026, 10, 13, 18), today: today),
        isNull,
      );
    });
  });
}
