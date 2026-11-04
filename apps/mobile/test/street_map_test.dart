import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarvodaya_connect_mobile/src/models/society.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/map_preview.dart';
import 'package:sarvodaya_connect_mobile/src/widgets/street_map.dart';

/// A 1x1 transparent PNG, so tests never fetch real Mapbox tiles.
final _blankTile = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);

class _LocalTiles extends TileProvider {
  _LocalTiles({this.broken = false});

  final bool broken;

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) =>
      MemoryImage(broken ? Uint8List.fromList([1, 2, 3]) : _blankTile);
}

const _kandy = GeoLocation(latitude: 7.2906, longitude: 80.6337);
const _token = 'pk.test-only-not-a-real-token';

Future<void> _pump(WidgetTester tester, Widget map) => tester.pumpWidget(
  MaterialApp(
    home: Scaffold(body: SizedBox(width: 360, child: map)),
  ),
);

void main() {
  testWidgets('keeps the drawn map when no Mapbox token is set', (
    tester,
  ) async {
    await _pump(tester, const SocietyStreetMap(location: _kandy, token: ''));
    expect(find.byType(MapPreview), findsOneWidget);
    expect(find.byType(FlutterMap), findsNothing);
    expect(find.textContaining('could not load'), findsNothing);
  });

  testWidgets('ignores a token that is not a public pk. token', (tester) async {
    await _pump(
      tester,
      const SocietyStreetMap(location: _kandy, token: 'sk.secret-kind'),
    );
    expect(find.byType(MapPreview), findsOneWidget);
  });

  testWidgets('shows the street map with the pin and Mapbox attribution', (
    tester,
  ) async {
    await _pump(
      tester,
      SocietyStreetMap(
        location: _kandy,
        token: _token,
        tileProvider: _LocalTiles(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(FlutterMap), findsOneWidget);
    expect(find.byIcon(Icons.location_on), findsOneWidget);
    expect(find.text('mapbox'), findsOneWidget);
    expect(find.text('© Mapbox © OpenStreetMap'), findsOneWidget);
  });

  testWidgets('tapping the street map sets the pin', (tester) async {
    GeoLocation? picked;
    await _pump(
      tester,
      SocietyStreetMap(
        location: _kandy,
        token: _token,
        tileProvider: _LocalTiles(),
        onPick: (location) => picked = location,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FlutterMap));
    await tester.pumpAndSettle(const Duration(milliseconds: 400));
    // The middle of the map is the society's current position.
    expect(picked, isNotNull);
    expect(picked!.latitude, closeTo(_kandy.latitude, 0.001));
    expect(picked!.longitude, closeTo(_kandy.longitude, 0.001));
  });

  testWidgets('keeps the street map when a tile fails but Mapbox answers', (
    tester,
  ) async {
    await _pump(
      tester,
      SocietyStreetMap(
        location: _kandy,
        token: _token,
        tileProvider: _LocalTiles(broken: true),
        checkTiles: (_) async => true,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(FlutterMap), findsOneWidget);
    expect(find.byType(MapPreview), findsNothing);
  });

  testWidgets('falls back to the drawn map when Mapbox cannot be reached', (
    tester,
  ) async {
    GeoLocation? picked;
    await _pump(
      tester,
      SocietyStreetMap(
        location: _kandy,
        token: _token,
        tileProvider: _LocalTiles(broken: true),
        onPick: (location) => picked = location,
        pickOnDrawnMap: true,
        checkTiles: (_) async => false,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(MapPreview), findsOneWidget);
    expect(find.byType(FlutterMap), findsNothing);
    // The drawn map is not the society's real area, so a tap sets nothing.
    await tester.tap(find.byType(MapPreview));
    expect(picked, isNull);
  });

  testWidgets(
    'without a token, only "Place pin manually" picks on the drawn map',
    (tester) async {
      GeoLocation? picked;
      await _pump(
        tester,
        SocietyStreetMap(token: '', onPick: (location) => picked = location),
      );
      await tester.tap(find.byType(MapPreview));
      expect(picked, isNull);

      await _pump(
        tester,
        SocietyStreetMap(
          token: '',
          pickOnDrawnMap: true,
          onPick: (location) => picked = location,
        ),
      );
      await tester.tap(find.byType(MapPreview));
      expect(picked, isNotNull);
    },
  );
}
