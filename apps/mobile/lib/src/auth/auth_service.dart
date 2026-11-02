import '../models/user.dart';

/// Result returned by an identity provider after successful authentication.
class AuthSession {
  const AuthSession({required this.user});

  final AuthenticatedUser user;
}

/// Authentication boundary used by the UI.
///
/// The production implementation can delegate to Amazon Cognito without
/// changing any onboarding screens or application state.
abstract interface class AuthService {
  Future<AuthSession?> signIn({
    required String username,
    required String password,
  });
}

class AuthNetworkException implements Exception {
  const AuthNetworkException();
}

class AuthServiceException implements Exception {
  const AuthServiceException();
}

/// Too many wrong passwords: the API refuses sign-in for 15 minutes or until
/// HQ sets a new password (V5 M03e).
class AuthLockedException implements Exception {
  const AuthLockedException();
}
