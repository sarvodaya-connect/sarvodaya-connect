import '../models/user.dart';

/// Result returned by an identity provider after successful authentication.
class AuthSession {
  const AuthSession({required this.user, required this.requiresSetup});

  final AuthenticatedUser user;
  final bool requiresSetup;
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
