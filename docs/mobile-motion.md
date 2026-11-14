# Mobile motion foundation — issue #135

The Flutter implementation is in `apps/mobile/lib/src/motion/app_motion.dart`.
It adapts the supplied recording's coordinated fade/slide entrances to the existing
Sarvodaya layouts. It does not copy the reference app's artwork or branding.

## Motion vocabulary

| Purpose | Value |
| --- | --- |
| Press response | 110 ms, scale 0.985 |
| Selection / size / navigation indicator | 180 ms |
| Entrance | 280 ms, easeOutCubic, 14 logical pixels upward |
| Stagger | 35 ms per block, capped at four intervals |

The longest entrance group settles within 420 ms. Values are presentation only;
network calls and business state never wait for an animation.

## Shared components

- `MotionScope`: session memory for stable entrance IDs. The app creates a fresh
  scope for each account/role. It persists through language/keyboard changes,
  normal rebuilds and refreshes that temporarily remove content.
- `MotionEntrance`: use a stable, screen-specific ID for a small section. It
  plays once per scope. A hidden retained tab waits until its TickerMode enables.
  Returning to an already seen screen does not replay its entrance. Without a
  MotionScope (for isolated screens/tests), it still plays once per widget state.
- `motionBlocks`: wraps at most five initial blocks of a fixed list. Spacers are
  not animated. IDs derive from the supplied prefix and structural index: keep
  that initial structure stable. For conditional/reorderable sections use explicit
  MotionEntrance IDs instead. Never wrap Expanded, Flexible or Spacer in it;
  never apply it to an unbounded list of rows.
- `MotionPress`: visual pointer feedback around an existing button or InkWell.
  The child continues to own its tap, keyboard activation, focus and semantics.
  Pass its disabled/busy state as `enabled`. It does not add haptics or tap handlers.
- `MotionSize`: animates the size of the current child. It does not retain an
  outgoing duplicate form/control as an AnimatedSwitcher could.
- `AccessiblePageTransitions`: delegates to Flutter's existing platform transition
  builder, including its transition durations and delegated transitions. Reduced
  motion skips decorative route transitions. Native back gestures remain native.

Example for a section that may be replaced during refresh:

```dart
MotionEntrance(
  id: 'officer.summary',
  order: 2,
  child: SocietySummaryCard(record: record),
)
```

`AppMotion.reduced` reads `MediaQuery.disableAnimations`, which follows the OS
setting. Entrances immediately complete if the preference is enabled, including
mid-animation. Press scaling is removed and selection/size/indicator durations
become zero. Content and semantics stay available throughout entrances; animation
never intercepts input or postpones permission checks.

## Coverage in this PR

- Language selection: short initial group entrance, selected-card colour/border
  transitions, Continue press feedback.
- Sign-in: logo/headings and both labelled fields enter in small groups;
  submit press feedback and error-panel size changes. Existing controllers and
  form state persist. Keyboard submission now checks the busy flag as well as
  the button, preventing duplicate requests while signing in.
- SO home: header, access strip, society summary, update-tile group and annual
  summary/audit link; update tiles receive press feedback.
- SPC/DDM/DM homes: greeting, role line and the first home sections, including
  access banners and overview/temporary-access cards as appropriate.
- HQ home: masthead and first overview blocks/cards.
- App shell: explicit TickerMode per retained tab; account/role-keyed tab state;
  short native navigation-indicator motion. Route transitions remain native.

## Intentional exceptions and follow-up

- Splash branding stays static and immediately visible. Startup proceeds after
  its first frame; the previous fixed 900 ms timer is removed. There is currently
  no asynchronous bootstrap to justify waiting. The app must not delay readiness
  simply to finish a logo animation.
- Emergency/incident content is not animated as a separate group in this PR.
  Urgent actions must remain immediately available; its detailed motion review
  belongs to #137.
- Long lists, operational counters and background decoration are not animated.
  Existing progress indicators continue to communicate actual work, not a new
  decorative loading stage.
- Forms and society-record detail motion belong to #136; remaining areas and the
  app-wide consistency pass belong to #137.
- #124 is a separate, still-open branded-header change at implementation time.
  When it merges, preserve its design and carry the header entrance wrapper over
  to the shared header. This PR does not mark #120 complete.

## Validation

New widget tests cover replay after rebuild/refresh, retained text, reduced motion
at startup and mid-animation, first activation of a hidden tab, account-session
reset, one press callback, duplicate keyboard sign-in submission, and native iOS
edge-swipe navigation. Existing onboarding, five-role home/navigation and localized
home tests are run with this change. See the PR description for the exact results.

No screenshot submission, physical-device performance measurement, AWS deployment
or Google Play/TestFlight upload is performed as part of this work. The requester
will review the visual experience on devices.

## Remaining-screen coverage — issue #137

This change reuses the motion tokens and components above. It adds no separate
animation layer.

| Role or area | Coverage |
| --- | --- |
| All five roles | Existing native route transitions and settings-row press feedback continue to use the shared system. The first few notification rows and empty state enter once per signed-in session; read/unread background and title-weight changes use the 180 ms state timing. |
| Society Officer | The Registrar-document summary, supporting-document notice and document empty state use stable entrances. Audit checklist/history sections animate only the current and first four past years. Upload validation, failure, retry and server-confirmed progress use a reduced-motion-aware size transition; the existing status text remains authoritative. |
| SPC, DDM, DM | Existing scoped Programmes, Membership and Audits read views enter once after data is available. Scope filters, requests and permission checks are unchanged. |
| HQ | National overview, Programmes, Membership, Audit & AGM and Profit & Expenses content reuse the same entrance timing. SarvoAI animates only a confirmed answer; working and actionable error states remain immediate. |
| Disaster response | The incident-notification heading uses a short entrance. Incident lists, reporting, rapid assessment, response entry and close controls remain immediate; native route and dialog transitions are retained. |
| Forms and society records | The Society record and activity/form workflows remain assigned to #136. Their navigation still uses the shared native transitions. |

Entrance IDs are stable through rebuilds, refresh and language changes and are
remembered by the existing account/role `MotionScope`. Long/lazy lists are not
staggered; notification and audit lists limit entrances to a small initial group.
Error/retry messages are not faded or delayed. `MotionSize` renders its child
directly when reduced motion is enabled, avoiding a size-animation layout pass.
The upload sheet keeps Flutter's native bottom-sheet entrance; no nested sheet
animation is added.

### Role/screen review checklist

- [x] SO: documents, audit, notifications, settings, disaster response, shared navigation.
- [x] SPC: scoped Programmes, Membership and Audits read views, notifications, settings, disaster response, shared navigation.
- [x] DDM: scoped Programmes, Membership and Audits read views, notifications, settings, disaster response, shared navigation.
- [x] DM: scoped Programmes, Membership and Audits read views, notifications, settings, disaster response, shared navigation.
- [x] HQ: national overview, Programmes, Membership, Audit & AGM, Profit & Expenses, SarvoAI, notifications and settings.
- [ ] Final cross-PR consistency review after #136 lands; no #136 branch/PR was available during this work.
- [ ] Physical-device performance and visual review; not performed here.
