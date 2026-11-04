import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../models/society.dart';
import '../theme/app_theme.dart';
import 'map_preview.dart';

/// Mapbox settings for the phone. The token is Mapbox's public `pk.` kind,
/// passed at build time with `--dart-define=MAPBOX_TOKEN=pk...`. It is public
/// configuration, not a secret, and is never committed. Without it the drawn
/// [MapPreview] is shown.
class MapboxConfig {
  const MapboxConfig._();

  static const token = String.fromEnvironment('MAPBOX_TOKEN');

  /// To Confirm with Sarvodaya: streets or light.
  static const style = 'mapbox/streets-v12';

  /// Sri Lanka with a small margin. Pan and zoom stay inside it.
  static final sriLanka = LatLngBounds(
    const LatLng(5.6, 79.2),
    const LatLng(10.1, 82.3),
  );

  static bool usable(String token) => token.trim().startsWith('pk.');

  /// Whether Mapbox answers at all: one small tile, within 8 seconds.
  static Future<bool> reachable(String token) async {
    try {
      final response = await http
          .get(
            Uri.parse(
              'https://api.mapbox.com/styles/v1/$style/tiles/256/0/0/0?access_token=${token.trim()}',
            ),
          )
          .timeout(const Duration(seconds: 8));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

/// One society's location on a Mapbox street map, read-only or, with
/// [onPick], tap to set the pin. Map tiles load straight from Mapbox; only the
/// map position is sent. With no token, or when Mapbox cannot be reached
/// (offline or a refused token), the drawn [MapPreview] is shown instead. A
/// single failed tile is not enough: one tile can fail on a slow connection
/// while the rest of the map loads.
class SocietyStreetMap extends StatefulWidget {
  const SocietyStreetMap({
    super.key,
    this.location,
    this.height = 140,
    this.onPick,
    this.semanticLabel,
    this.pickOnDrawnMap = false,
    this.token = MapboxConfig.token,
    this.tileProvider,
    this.checkTiles,
  });

  final GeoLocation? location;
  final double height;
  final ValueChanged<GeoLocation>? onPick;
  final String? semanticLabel;

  /// Whether a tap on the drawn demonstration map (no token) also sets the
  /// pin, as "Place pin manually" always has. Never once Mapbox has failed:
  /// the drawn map is not the society's real area.
  final bool pickOnDrawnMap;
  final String token;

  /// Tests swap the network tiles for local ones.
  @visibleForTesting
  final TileProvider? tileProvider;

  /// Tests replace the reachability check made after a tile fails.
  @visibleForTesting
  final Future<bool> Function(String token)? checkTiles;

  @override
  State<SocietyStreetMap> createState() => _SocietyStreetMapState();
}

class _SocietyStreetMapState extends State<SocietyStreetMap> {
  bool _tilesFailed = false;
  bool _checked = false;

  /// After the first failed tile, checks once whether Mapbox answers at all.
  Future<void> _onTileError() async {
    if (_checked) return;
    _checked = true;
    final reachable = await (widget.checkTiles ?? MapboxConfig.reachable)(
      widget.token,
    );
    if (mounted && !reachable) setState(() => _tilesFailed = true);
  }

  void _pick(LatLng point) {
    double round(double value) => (value * 1000000).roundToDouble() / 1000000;
    widget.onPick!(
      GeoLocation(
        latitude: round(point.latitude),
        longitude: round(point.longitude),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final onPick = widget.onPick;
    if (!MapboxConfig.usable(widget.token) || _tilesFailed) {
      return MapPreview(
        location: widget.location,
        height: widget.height,
        semanticLabel: widget.semanticLabel,
        onTapFraction: onPick == null || !widget.pickOnDrawnMap || _tilesFailed
            ? null
            : (fraction) => onPick(DemoMapArea.locationAt(fraction)),
      );
    }
    final location = widget.location;
    final pin = location == null
        ? null
        : LatLng(location.latitude, location.longitude);
    return Semantics(
      label: widget.semanticLabel ?? 'Street map showing the society location',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          height: widget.height,
          child: FlutterMap(
            options: MapOptions(
              initialCenter: pin ?? MapboxConfig.sriLanka.center,
              initialZoom: pin == null ? 7 : 14,
              minZoom: 6,
              maxZoom: 18,
              cameraConstraint: CameraConstraint.contain(
                bounds: MapboxConfig.sriLanka,
              ),
              onTap: onPick == null ? null : (_, point) => _pick(point),
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://api.mapbox.com/styles/v1/${MapboxConfig.style}/tiles/256/{z}/{x}/{y}@2x?access_token={accessToken}',
                additionalOptions: {'accessToken': widget.token.trim()},
                userAgentPackageName: 'lk.sarvodaya.connect',
                tileProvider: widget.tileProvider,
                errorTileCallback: (_, _, _) => _onTileError(),
              ),
              if (pin != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: pin,
                      width: 36,
                      height: 36,
                      alignment: Alignment.topCenter,
                      child: const Icon(
                        Icons.location_on,
                        color: AppColors.action,
                        size: 36,
                      ),
                    ),
                  ],
                ),
              // Mapbox requires its wordmark and attribution on every map.
              const Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: EdgeInsets.all(4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'mapbox',
                        style: TextStyle(
                          color: AppColors.ink,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '© Mapbox © OpenStreetMap',
                          textAlign: TextAlign.right,
                          style: TextStyle(
                            color: AppColors.ink,
                            fontSize: 9,
                            backgroundColor: Color(0xB3FFFFFF),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
