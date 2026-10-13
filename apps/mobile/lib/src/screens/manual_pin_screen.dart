import 'package:flutter/material.dart';

import '../models/society.dart';
import '../theme/app_theme.dart';
import '../validation/validators.dart';
import '../widgets/map_preview.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';

/// "Place Pin Manually": tap the demonstration map or type coordinates.
/// Returns the chosen [GeoLocation], or null if the officer cancels.
class ManualPinScreen extends StatefulWidget {
  const ManualPinScreen({super.key, this.initial});

  final GeoLocation? initial;

  @override
  State<ManualPinScreen> createState() => _ManualPinScreenState();
}

class _ManualPinScreenState extends State<ManualPinScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _latitude = TextEditingController(
    text: widget.initial?.latitude.toStringAsFixed(4) ?? '',
  );
  late final _longitude = TextEditingController(
    text: widget.initial?.longitude.toStringAsFixed(4) ?? '',
  );
  late GeoLocation? _pin = widget.initial;

  @override
  void dispose() {
    _latitude.dispose();
    _longitude.dispose();
    super.dispose();
  }

  void _placeAt(Offset fraction) {
    final location = DemoMapArea.locationAt(fraction);
    setState(() {
      _pin = location;
      _latitude.text = location.latitude.toStringAsFixed(4);
      _longitude.text = location.longitude.toStringAsFixed(4);
    });
  }

  void _onCoordinatesChanged(String _) {
    final latitude = double.tryParse(_latitude.text.trim());
    final longitude = double.tryParse(_longitude.text.trim());
    setState(() {
      _pin = latitude == null || longitude == null
          ? null
          : GeoLocation(latitude: latitude, longitude: longitude);
    });
  }

  void _confirm() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(
      GeoLocation(
        latitude: double.parse(_latitude.text.trim()),
        longitude: double.parse(_longitude.text.trim()),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Place pin manually')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const NoticeBanner(
              icon: Icons.touch_app_outlined,
              title: 'Tap the map where the society meets',
              message: 'Or type the coordinates below. This is a demonstration map around the fictional society.',
            ),
            const SizedBox(height: 12),
            MapPreview(
              location: _pin,
              height: 240,
              onTapFraction: _placeAt,
              semanticLabel:
                  'Map. Tap to place the pin, or enter the coordinates below.',
            ),
            const SizedBox(height: 12),
            SectionCard(
              title: 'Coordinates',
              children: [
                TextFormField(
                  controller: _latitude,
                  decoration: const InputDecoration(
                    labelText: 'Latitude *',
                    hintText: '7.4672',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  onChanged: _onCoordinatesChanged,
                  validator: Validators.latitude,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _longitude,
                  decoration: const InputDecoration(
                    labelText: 'Longitude *',
                    hintText: '80.0412',
                  ),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  onChanged: _onCoordinatesChanged,
                  validator: Validators.longitude,
                ),
                const SizedBox(height: 8),
                Text(
                  _pin == null ? 'No pin placed yet.' : 'Pin: ${_pin!.label}',
                  style: const TextStyle(color: AppColors.muted),
                ),
              ],
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        primary: FilledButton(
          onPressed: _confirm,
          child: const Text('Use this location'),
        ),
      ),
    );
  }
}
