import type { MessageKey } from "@/i18n/messages/en";

/** Sign-in messages from the API and the sign-in action (V5 D01, D01e). */
export const SIGN_IN_FAILED =
  "The username or password is not correct. Check them and try again.";
export const SIGN_IN_LOCKED =
  "Too many attempts. Try again in 15 minutes, or ask HQ to set a new password.";
/** Cognito could not be reached, or answered in a way the dashboard does not expect. */
export const SIGN_IN_UNAVAILABLE = "Sign-in is not available right now. Try again in a few minutes.";
/** The sign-in exists but HQ has not finished the account, or it is disabled. */
export const SIGN_IN_NOT_READY = "This account cannot sign in yet. Ask HQ to check it.";
export const SOCIETY_OFFICER_ON_DESKTOP = "Society Officers use the Sarvodaya Connect phone app.";
/** Accounts with no desktop dashboard (HQ, DMs, DDMs and SPCs have one). */
export const NOT_HQ_ON_DESKTOP = "This dashboard is for HQ. Please use the mobile app.";

/** The API and sign-in actions send these English messages; the form shows them in the chosen language. */
export const SIGN_IN_ERROR_KEYS: Record<string, MessageKey> = {
  [SIGN_IN_FAILED]: "signIn.error.failed",
  [SIGN_IN_LOCKED]: "signIn.error.locked",
  [SIGN_IN_UNAVAILABLE]: "signIn.error.unavailable",
  [SIGN_IN_NOT_READY]: "signIn.error.notReady",
  [SOCIETY_OFFICER_ON_DESKTOP]: "signIn.officerBody",
  [NOT_HQ_ON_DESKTOP]: "signIn.error.notHq",
};

/** Username suggested from a full name (V5 D16i), for example "P. Jayaweera" → "p.jayaweera". */
export function suggestUsername(fullName: string): string {
  return fullName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".")
    .slice(0, 100);
}
