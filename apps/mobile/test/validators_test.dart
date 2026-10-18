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

  group('profile contact details', () {
    test('accepts a blank optional email and a valid fictional address', () {
      expect(Validators.optionalEmail(''), isNull);
      expect(Validators.optionalEmail('society@example.invalid'), isNull);
      expect(Validators.addressLine('No. 12, Temple Road'), isNull);
      expect(Validators.villageName('Pahala Kosgama'), isNull);
    });

    test('returns useful messages for malformed profile values', () {
      expect(
        Validators.optionalEmail('society@'),
        'Enter an email address like name@example.invalid.',
      );
      expect(
        Validators.addressLine('Road'),
        'Enter the full address, for example No. 12, Temple Road.',
      );
      expect(
        Validators.villageName('Village @ 1'),
        'Use letters, numbers, spaces, commas, full stops or hyphens only.',
      );
    });
  });

  group('profile location', () {
    test('accepts coordinates inside Sri Lanka', () {
      expect(Validators.latitude('7.4672'), isNull);
      expect(Validators.longitude('80.0412'), isNull);
      expect(Validators.gpsLocation(const Object()), isNull);
    });

    test('rejects missing, non-numeric and out-of-range coordinates', () {
      expect(Validators.latitude(''), 'Enter the latitude.');
      expect(
        Validators.longitude('east'),
        'Enter the longitude as a number, for example 80.0412.',
      );
      expect(
        Validators.latitude('12.5'),
        'This latitude is outside Sri Lanka (5.8–10.0).',
      );
      expect(
        Validators.longitude('70'),
        'This longitude is outside Sri Lanka (79.4–82.0).',
      );
      expect(Validators.gpsLocation(null), "Add the society's GPS location.");
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
