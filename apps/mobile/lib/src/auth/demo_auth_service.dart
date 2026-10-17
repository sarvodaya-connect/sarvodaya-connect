import '../data/demo_data.dart';
import 'auth_service.dart';

/// Local-only identity provider used until Amazon Cognito is available.
///
/// Credentials are fictional and no password is stored after sign-in.
class DemoAuthService implements AuthService {
  const DemoAuthService({this.isOnline = _alwaysOnline});

  final bool Function() isOnline;

  static bool _alwaysOnline() => true;

  @override
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  }) async {
    if (!isOnline()) throw const AuthNetworkException();

    final matches =
        username.trim().toLowerCase() == DemoAccount.username &&
        password == DemoAccount.password;
    if (!matches) return null;

    return const AuthSession(user: demoOfficer, requiresSetup: true);
  }
}
