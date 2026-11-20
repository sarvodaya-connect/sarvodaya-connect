import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/incidents/incident_ids.dart';

void main() {
  final uuid = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  );

  test('a client id is a valid version 4 UUID', () {
    for (var i = 0; i < 50; i++) {
      expect(newClientMutationId(), matches(uuid));
    }
  });

  test('client ids are different each time', () {
    final ids = {for (var i = 0; i < 200; i++) newClientMutationId()};
    expect(ids.length, 200);
  });
}
