/**
 * Sign-in messages the dashboard shows in Sinhala, Tamil or English (V5 D01,
 * D01e). The API sends English; these keys let the form translate them.
 */
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

export type SignInLanguage = "si" | "ta" | "en";

type Copy = {
  title: string;
  subtitle: string;
  username: string;
  password: string;
  showPassword: string;
  hidePassword: string;
  button: string;
  waiting: string;
  officerTitle: string;
  officerBody: string;
  forgot: string;
  privacy: string;
  privacyBody: string;
  errors: Record<string, string>;
};

/**
 * English is the V5 wording. The Sinhala and Tamil lines that were already in
 * the dashboard are kept; the new V5 lines need a native-speaker review.
 */
export const SIGN_IN_COPY: Record<SignInLanguage, Copy> = {
  en: {
    title: "Sign in",
    subtitle: "Use the username and password HQ created for you. You see the dashboard for your role.",
    username: "Username",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    button: "Sign in",
    waiting: "Signing in…",
    officerTitle: "Society Officer?",
    officerBody: SOCIETY_OFFICER_ON_DESKTOP,
    forgot: "Forgot your password? Ask HQ to set a new one.",
    privacy: "Privacy notice",
    privacyBody:
      "Access to society information is controlled by your assigned role and scope. Sensitive NIC details are revealed only after sign-in and the access is recorded.",
    errors: {},
  },
  si: {
    title: "පිවිසෙන්න",
    subtitle: "මූලස්ථානය ඔබට සෑදූ පරිශීලක නාමය සහ මුරපදය භාවිත කරන්න. ඔබේ භූමිකාවට අදාළ පුවරුව ඔබට පෙනේ.",
    username: "පරිශීලක නාමය",
    password: "මුරපදය",
    showPassword: "මුරපදය පෙන්වන්න",
    hidePassword: "මුරපදය සඟවන්න",
    button: "පිවිසෙන්න",
    waiting: "පිවිසෙමින්…",
    officerTitle: "සමිති නිලධාරියෙක්ද?",
    officerBody: "සමිති නිලධාරීන් Sarvodaya Connect ජංගම යෙදුම භාවිත කරයි.",
    forgot: "මුරපදය අමතකද? නව මුරපදයක් සැකසීමට මූලස්ථානයෙන් ඉල්ලන්න.",
    privacy: "පෞද්ගලිකත්ව නිවේදනය",
    privacyBody:
      "සමිති තොරතුරු වෙත ප්‍රවේශය ඔබට පවරා ඇති භූමිකාව සහ විෂය පථය අනුව පාලනය වේ. සංවේදී ජා.හැ.අ. විස්තර පිවිසීමෙන් පසුව පමණක් පෙන්වන අතර එම ප්‍රවේශය වාර්තා වේ.",
    errors: {
      [SIGN_IN_FAILED]: "පරිශීලක නාමය හෝ මුරපදය නිවැරදි නැත. ඒවා පරීක්ෂා කර නැවත උත්සාහ කරන්න.",
      [SIGN_IN_LOCKED]: "උත්සාහයන් වැඩිය. මිනිත්තු 15කින් නැවත උත්සාහ කරන්න, නැතහොත් නව මුරපදයක් සඳහා මූලස්ථානයෙන් ඉල්ලන්න.",
      [SOCIETY_OFFICER_ON_DESKTOP]: "සමිති නිලධාරීන් Sarvodaya Connect ජංගම යෙදුම භාවිත කරයි.",
      [NOT_HQ_ON_DESKTOP]: "මෙම පුවරුව මූලස්ථානය සඳහාය. කරුණාකර ජංගම යෙදුම භාවිත කරන්න.",
    },
  },
  ta: {
    title: "உள்நுழைக",
    subtitle: "தலைமையகம் உங்களுக்காக உருவாக்கிய பயனர்பெயர் மற்றும் கடவுச்சொல்லைப் பயன்படுத்தவும். உங்கள் பங்குக்கான டாஷ்போர்டு காட்டப்படும்.",
    username: "பயனர்பெயர்",
    password: "கடவுச்சொல்",
    showPassword: "கடவுச்சொல்லைக் காட்டு",
    hidePassword: "கடவுச்சொல்லை மறை",
    button: "உள்நுழைக",
    waiting: "உள்நுழைகிறது…",
    officerTitle: "சங்க அலுவலரா?",
    officerBody: "சங்க அலுவலர்கள் Sarvodaya Connect கைப்பேசி செயலியைப் பயன்படுத்துவார்கள்.",
    forgot: "கடவுச்சொல் மறந்துவிட்டதா? புதியதை அமைக்க தலைமையகத்திடம் கேளுங்கள்.",
    privacy: "தனியுரிமை அறிவிப்பு",
    privacyBody:
      "சங்கத் தகவல்களுக்கான அணுகல் உங்களுக்கு ஒதுக்கப்பட்ட பங்கு மற்றும் வரம்பால் கட்டுப்படுத்தப்படுகிறது. முக்கியமான தேசிய அடையாள அட்டை விவரங்கள் உள்நுழைந்த பின்னரே காட்டப்படும், அந்த அணுகல் பதிவு செய்யப்படும்.",
    errors: {
      [SIGN_IN_FAILED]: "பயனர்பெயர் அல்லது கடவுச்சொல் சரியில்லை. அவற்றைச் சரிபார்த்து மீண்டும் முயலவும்.",
      [SIGN_IN_LOCKED]: "அதிக முயற்சிகள். 15 நிமிடங்களில் மீண்டும் முயலவும், அல்லது புதிய கடவுச்சொல்லுக்கு தலைமையகத்திடம் கேளுங்கள்.",
      [SOCIETY_OFFICER_ON_DESKTOP]: "சங்க அலுவலர்கள் Sarvodaya Connect கைப்பேசி செயலியைப் பயன்படுத்துவார்கள்.",
      [NOT_HQ_ON_DESKTOP]: "இந்த டாஷ்போர்டு தலைமையகத்துக்கானது. கைப்பேசி செயலியைப் பயன்படுத்தவும்.",
    },
  },
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
