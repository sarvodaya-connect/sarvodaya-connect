import 'package:flutter/material.dart';

/// Shared motion vocabulary. Durations never determine application readiness.
abstract final class AppMotion {
  static const press = Duration(milliseconds: 110);
  static const state = Duration(milliseconds: 180);
  static const entrance = Duration(milliseconds: 280);
  static const stagger = Duration(milliseconds: 35);
  static const distance = 14.0;
  static const curve = Curves.easeOutCubic;

  static bool reduced(BuildContext context) =>
      MediaQuery.maybeOf(context)?.disableAnimations ?? false;
  static Duration duration(BuildContext context, Duration value) =>
      reduced(context) ? Duration.zero : value;
}

/// Remembers entrances for one signed-in user/role session, including after a
/// refresh replaces a loading subtree. Change the scope key on account changes.
class MotionScope extends StatefulWidget {
  const MotionScope({super.key, required this.child});
  final Widget child;

  @override
  State<MotionScope> createState() => _MotionScopeState();
}

class _MotionScopeState extends State<MotionScope> {
  final seen = <String>{};

  @override
  Widget build(BuildContext context) =>
      _MotionMemory(state: this, child: widget.child);
}

class _MotionMemory extends InheritedWidget {
  const _MotionMemory({required this.state, required super.child});
  final _MotionScopeState state;

  @override
  bool updateShouldNotify(_MotionMemory oldWidget) => state != oldWidget.state;
}

/// Plays once per stable id in the session. No timers, input interception or
/// layout movement. Hidden IndexedStack tabs wait until their tickers activate.
class MotionEntrance extends StatefulWidget {
  const MotionEntrance({
    super.key,
    required this.id,
    required this.child,
    this.order = 0,
  });
  final String id;
  final Widget child;
  final int order;

  @override
  State<MotionEntrance> createState() => _MotionEntranceState();
}

class _MotionEntranceState extends State<MotionEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);
  bool _started = false;
  bool _scheduled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final memory = context.dependOnInheritedWidgetOfExactType<_MotionMemory>();
    final reduced = AppMotion.reduced(context);
    if (reduced ||
        (!_started && memory?.state.seen.contains(widget.id) == true)) {
      _started = true;
      memory?.state.seen.add(widget.id);
      _controller.value = 1;
      return;
    }
    if (_started || _scheduled || !TickerMode.valuesOf(context).enabled) return;
    _scheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scheduled = false;
      if (!mounted || _started || !TickerMode.valuesOf(context).enabled) return;
      _started = true;
      final seen = memory?.state.seen;
      if (AppMotion.reduced(context) || seen?.contains(widget.id) == true) {
        _controller.value = 1;
        return;
      }
      seen?.add(widget.id);
      final delay = AppMotion.stagger.inMilliseconds * widget.order.clamp(0, 4);
      final total = AppMotion.entrance.inMilliseconds + delay;
      _controller.duration = Duration(milliseconds: total);
      _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final delay = AppMotion.stagger.inMilliseconds * widget.order.clamp(0, 4);
    final total = AppMotion.entrance.inMilliseconds + delay;
    final animation = _controller.drive(
      CurveTween(curve: Interval(delay / total, 1, curve: AppMotion.curve)),
    );
    return AnimatedBuilder(
      animation: animation,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: animation.value,
        alwaysIncludeSemantics: true,
        child: Transform.translate(
          offset: Offset(0, AppMotion.distance * (1 - animation.value)),
          child: child,
        ),
      ),
    );
  }
}

/// Animate at most five initial blocks; do not stagger long or lazy lists.
/// Use on fixed home sections, never to wrap Expanded/Flexible/Spacer widgets.
List<Widget> motionBlocks(String id, List<Widget> children) {
  var order = 0;
  return [
    for (final (index, child) in children.indexed)
      if (child is SizedBox || order >= 5)
        child
      else
        MotionEntrance(
          key: ValueKey('$id.$index'),
          id: '$id.$index',
          order: order++,
          child: child,
        ),
  ];
}

/// Visual press feedback only: existing controls own taps, focus, semantics,
/// disabled state and validation. A Listener never adds another tap handler.
class MotionPress extends StatefulWidget {
  const MotionPress({super.key, required this.child, this.enabled = true});
  final Widget child;
  final bool enabled;

  @override
  State<MotionPress> createState() => _MotionPressState();
}

class _MotionPressState extends State<MotionPress> {
  final _pointers = <int>{};

  void _release(int pointer) => setState(() => _pointers.remove(pointer));

  @override
  void didUpdateWidget(MotionPress oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.enabled) _pointers.clear();
  }

  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: (event) {
      if (widget.enabled) setState(() => _pointers.add(event.pointer));
    },
    onPointerUp: (event) => _release(event.pointer),
    onPointerCancel: (event) => _release(event.pointer),
    child: AnimatedScale(
      scale:
          widget.enabled && _pointers.isNotEmpty && !AppMotion.reduced(context)
          ? 0.985
          : 1,
      duration: AppMotion.duration(context, AppMotion.press),
      curve: AppMotion.curve,
      child: widget.child,
    ),
  );
}

/// Changes height without keeping an outgoing copy of a control or form alive.
class MotionSize extends StatelessWidget {
  const MotionSize({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => AppMotion.reduced(context)
      ? child
      : AnimatedSize(
          duration: AppMotion.state,
          curve: AppMotion.curve,
          alignment: Alignment.topCenter,
          child: child,
        );
}

/// Keep native route transitions/back gestures; only bypass decorative route
/// motion when the operating system requests reduced animation.
class AccessiblePageTransitions extends PageTransitionsBuilder {
  const AccessiblePageTransitions(this.platform);
  final PageTransitionsBuilder platform;

  @override
  Duration get transitionDuration => platform.transitionDuration;
  @override
  Duration get reverseTransitionDuration => platform.reverseTransitionDuration;
  @override
  DelegatedTransitionBuilder? get delegatedTransition {
    final delegate = platform.delegatedTransition;
    if (delegate == null) return null;
    return (context, animation, secondary, allowSnapshotting, child) =>
        AppMotion.reduced(context)
        ? child
        : delegate(context, animation, secondary, allowSnapshotting, child);
  }

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) => AppMotion.reduced(context)
      ? child
      : platform.buildTransitions(
          route,
          context,
          animation,
          secondaryAnimation,
          child,
        );
}
