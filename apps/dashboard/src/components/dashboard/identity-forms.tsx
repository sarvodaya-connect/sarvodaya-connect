"use client";
import { useActionState, useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { AccountSummary } from "@sarvodaya-connect/api-contracts";
import {
  activate,
  createAccount,
  login,
  reissueAccount,
  setAccountPassword,
  updateAccount,
  disableAccount,
  type FormResult,
} from "@/app/identity-actions";
const field = "w-full rounded border border-line bg-white px-3 py-2 text-sm";
const button =
  "rounded bg-[#1a5c39] px-4 py-2 font-semibold text-white disabled:opacity-50";
function Result({ result }: { result: FormResult }) {
  return (
    <>
      {result.error && (
        <p role="alert" className="my-3 rounded bg-red-50 p-3 text-red-800">
          {result.error}
        </p>
      )}
      {result.success && (
        <p role="status" className="my-3 rounded bg-green-50 p-3">
          {result.success}
        </p>
      )}
      {result.credential && (
        <div className="my-3 break-all rounded border p-3">
          <p>Username: {result.username}</p>
          <p>
            Activation credential: <code>{result.credential}</code>
          </p>
          {result.method === "LINK" && result.activationUrl && (
            <p>
              One-time activation link:{" "}
              <a href={result.activationUrl} className="underline">
                {result.activationUrl}
              </a>
            </p>
          )}
          <p>
            Valid until {result.expiresAt}. Hand over securely. No message has
            been sent automatically.
          </p>
        </div>
      )}
    </>
  );
}
export function SignInForm() {
  const [state, action, pending] = useActionState(login, {});
  const [language, setLanguage] = useState<"si" | "ta" | "en">("en");
  const copy = {
    en: {
      title: "Sign in",
      subtitle: "HQ staff only. Use your Sarvodaya Connect username and password.",
      username: "Username",
      password: "Password",
      button: "Sign in",
      waiting: "Signing in…",
      otherRoles: "Not HQ staff?",
      phoneRoles: "Society Officers, SPCs, DDMs and DMs use the Sarvodaya Connect phone app.",
      activate: "First time? Activate your account",
      privacy: "Privacy notice",
    },
    si: {
      title: "පිවිසෙන්න",
      subtitle: "මූලස්ථාන කාර්ය මණ්ඩලය සඳහා පමණි. ඔබගේ Sarvodaya Connect පරිශීලක නාමය සහ මුරපදය භාවිත කරන්න.",
      username: "පරිශීලක නාමය",
      password: "මුරපදය",
      button: "පිවිසෙන්න",
      waiting: "පිවිසෙමින්…",
      otherRoles: "ඔබ මූලස්ථාන කාර්ය මණ්ඩලය නොවේද?",
      phoneRoles: "සමාජ නිලධාරීන්, SPC, DDM සහ DM සඳහා Sarvodaya Connect ජංගම යෙදුම භාවිත කරන්න.",
      activate: "පළමු වරටද? ඔබගේ ගිණුම සක්‍රිය කරන්න",
      privacy: "පෞද්ගලිකත්ව නිවේදනය",
    },
    ta: {
      title: "உள்நுழைக",
      subtitle: "தலைமையகப் பணியாளர்களுக்கு மட்டும். உங்கள் Sarvodaya Connect பயனர்பெயர் மற்றும் கடவுச்சொல்லைப் பயன்படுத்தவும்.",
      username: "பயனர்பெயர்",
      password: "கடவுச்சொல்",
      button: "உள்நுழைக",
      waiting: "உள்நுழைகிறது…",
      otherRoles: "நீங்கள் தலைமையகப் பணியாளர் இல்லையா?",
      phoneRoles: "சங்க அலுவலர்கள், SPC, DDM மற்றும் DM-கள் Sarvodaya Connect கைப்பேசி செயலியைப் பயன்படுத்தவும்.",
      activate: "முதல் முறையா? உங்கள் கணக்கைச் செயல்படுத்தவும்",
      privacy: "தனியுரிமை அறிவிப்பு",
    },
  }[language];
  return (
    <div className="w-full max-w-[430px]">
      <div className="mb-10 flex justify-end" role="group" aria-label="Choose language">
        {([
          ["si", "සිංහල"],
          ["ta", "தமிழ்"],
          ["en", "English"],
        ] as const).map(([code, label]) => (
          <button
            key={code}
            type="button"
            aria-pressed={language === code}
            onClick={() => setLanguage(code)}
            className={`border border-[#dfe5dc] px-3 py-1.5 text-xs first:rounded-l-md last:rounded-r-md ${language === code ? "bg-[#e6f0e7] font-semibold text-[#174a32]" : "bg-white text-[#3e4b43] hover:bg-[#f4f8f3]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <form action={action} className="space-y-5">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-[#17211b]">{copy.title}</h1>
          <p className="mt-1 text-sm leading-5 text-[#68756c]">{copy.subtitle}</p>
        </div>
        <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
          <span>{copy.username} <span className="text-red-700">*</span></span>
          <input
            required
            name="username"
            autoComplete="username"
            className={`${field} h-11 rounded-md px-3 text-base`}
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
          <span>{copy.password} <span className="text-red-700">*</span></span>
          <input
            required
            name="password"
            type="password"
            autoComplete="current-password"
            className={`${field} h-11 rounded-md px-3 text-base`}
          />
        </label>
        <Result result={state} />
        <button disabled={pending} className={`${button} w-full rounded-md py-3`}>
          {pending ? copy.waiting : copy.button}
        </button>
        <div className="rounded-lg border border-[#b7cce2] bg-[#e5eef8] px-4 py-3.5 text-sm leading-5 text-[#244d75]">
          <p className="font-semibold">{copy.otherRoles}</p>
          <p className="mt-1">{copy.phoneRoles}</p>
        </div>
        <p className="flex flex-wrap gap-x-2 text-sm font-medium text-[#155b38]">
          <Link href="/activate" className="underline underline-offset-2">{copy.activate}</Link>
          <span aria-hidden="true">·</span>
          <details id="privacy-notice" className="inline-block">
            <summary className="list-none cursor-pointer underline underline-offset-2">{copy.privacy}</summary>
            <p className="mt-3 max-w-[430px] leading-5 text-[#68756c]">
              Access to society information is controlled by your assigned role and scope. Sensitive NIC details are revealed only after sign-in and the access is recorded.
            </p>
          </details>
        </p>
      </form>
    </div>
  );
}
export function ActivationForm() {
  const [state, action, pending] = useActionState(activate, {});
  const [details, setDetails] = useState<{
    displayName: string;
    role: string;
    roleLabel?: string;
    scopeLabel?: string;
    societyIds: string[];
    districtId?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [credential, setCredential] = useState("");
  const [username, setUsername] = useState("");
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    setCredential(parameters.get("credential") ?? "");
    setUsername(parameters.get("username") ?? "");
    if (window.location.hash)
      window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function inspect(form: FormData) {
    setError("");
    try {
      const response = await fetch("/api/activation-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: form.get("credential"),
          username: form.get("username") || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setDetails(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to check activation.");
    }
  }
  return (
    <div className="w-full max-w-[520px]">
      <div className="mb-8 flex items-center gap-3" aria-label={`Activation step ${details ? "2" : "1"} of 2`}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1f6b43] text-sm font-semibold text-white">
          {details ? "2" : "1"}
        </span>
        <span className="text-sm font-semibold text-[#174a32]">
          {details ? "Set your password" : "Verify your invitation"}
        </span>
        <span className="h-px flex-1 bg-[#dfe5dc]" aria-hidden="true" />
        <span className="text-xs text-[#68756c]">Step {details ? "2" : "1"} of 2</span>
      </div>
      <form action={details ? action : inspect} className="space-y-5">
        {details && <input type="hidden" name="credential" value={credential} />}
        <div className="mb-7">
          <h1 className="text-3xl font-semibold tracking-tight text-[#17211b]">
            {details ? "Set up your password" : "Activate your account"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#68756c]">
            {details
              ? "Check that the account details are yours, then finish setting up this pending account."
              : "Use this only if HQ gave you a one-time activation credential. Most staff should sign in with the username and permanent password provided by HQ."}
          </p>
        </div>
        {!details && (
          <div className="rounded-lg border border-[#c8d9ea] bg-[#e5eef8] px-4 py-3 text-sm leading-5 text-[#315d88]">
            Your invitation is private and can only be used once. If it has expired, ask HQ to issue a new one.
          </div>
        )}
        <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
          <span>Username</span>
        <input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className={`${field} h-11 rounded-md px-3 text-base`}
          readOnly={!!details}
        />
      </label>
      {!details && <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>One-time activation credential</span>
        <input
          required
          name="credential"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          type="password"
          autoComplete="one-time-code"
          className={`${field} h-11 rounded-md px-3 text-base`}
          readOnly={!!details}
        />
      </label>}
      {error && (
        <p role="alert" className="rounded-lg border border-[#f0c7c3] bg-[#fbe9e7] p-3 text-sm text-[#a8312a]">
          {error} Ask HQ for a new invitation if this one has expired.
        </p>
      )}
      {details && (
        <>
          <section className="space-y-3 rounded-xl border border-[#c6e2cd] bg-[#f4f8f3] p-5">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#68756c]">Account assigned to</h2>
              <p className="mt-1 text-lg font-semibold text-[#17211b]">{details.displayName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-[#dfe5dc] pt-3 text-sm">
              <p><span className="block text-xs text-[#68756c]">Role</span><span className="font-medium">{details.roleLabel ?? details.role}</span></p>
              <p><span className="block text-xs text-[#68756c]">Assigned societies</span><span className="font-medium">{details.societyIds.length}</span></p>
              <p className="col-span-2"><span className="block text-xs text-[#68756c]">Access area</span><span className="font-medium">{details.scopeLabel ?? details.districtId ?? "National"}</span></p>
            </div>
            <p className="border-t border-[#dfe5dc] pt-3 text-xs leading-5 text-[#3e4b43]">
              HQ sets your role and assignments. Contact HQ if these details are incorrect.
            </p>
          </section>
          <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
            <span>New password</span>
            <input
              required
              minLength={10}
              name="password"
              type="password"
              autoComplete="new-password"
              className={`${field} h-11 rounded-md px-3 text-base`}
            />
          </label>
          <p className="-mt-3 text-xs leading-5 text-[#68756c]">
            Use at least 10 characters and include a number. It must be different from your username.
          </p>
          <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
            <span>Confirm new password</span>
            <input
              required
              name="confirm"
              type="password"
              autoComplete="new-password"
              className={`${field} h-11 rounded-md px-3 text-base`}
            />
          </label>
        </>
      )}
      <Result result={state} />
      {!state.success && (
        <button disabled={pending} className={`${button} w-full rounded-md py-3`}>
          {pending ? "Please wait…" : details ? "Set password and activate" : "Check details and continue"}
        </button>
      )}
      <p className="text-center text-sm">
        <Link href="/" className="font-medium text-[#1f6b43] underline underline-offset-2">
          ← Return to sign in
        </Link>
      </p>
      </form>
    </div>
  );
}
export function InviteForm({
  societies,
  districts,
  account,
}: {
  account?: AccountSummary;
  societies: {
    id: string;
    nameEn: string;
    societyCode: string;
    districtId?: string;
  }[];
  districts: { id: string; nameEn: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [districtId, setDistrictId] = useState(account?.districtId ?? "");
  const [role, setRole] = useState<string>(account?.role ?? "SOCIETY_OFFICER");
  const [selectedSocietyIds, setSelectedSocietyIds] = useState<string[]>(
    account?.societyIds ?? [],
  );
  const [state, action, pending] = useActionState(
    account ? updateAccount : createAccount,
    {},
  );
  useEffect(() => {
    if (!account && state.success) {
      formRef.current?.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => {
        input.value = "";
      });
    }
  }, [account, state.success]);
  return (
    <form
      ref={formRef}
      action={action}
      className={`rounded-card border border-line bg-white p-5 md:p-6 ${account ? "space-y-3" : "grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2"}`}
    >
      <input type="hidden" name="id" value={account?.id ?? ""} />
      <div className={account ? "" : "md:col-span-2"}>
        <h2 className="text-lg font-semibold text-ink">
          {account ? "Update account assignments" : "Create a staff account"}
        </h2>
        {!account && <p className="mt-1 text-sm text-muted">Set the username and permanent password. Give both to the staff member securely.</p>}
      </div>
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>Full name</span>
        <input
          required
          name="displayName"
          defaultValue={account?.displayName ?? ""}
          className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`}
        />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>Username</span>
        <input
          required
          name="username"
          defaultValue={account?.username ?? ""}
          readOnly={!!account}
          minLength={3}
          maxLength={100}
          pattern="[a-z0-9][a-z0-9._-]{2,99}"
          title="Use at least 3 lowercase letters or numbers. Dots, underscores and hyphens are allowed; spaces are not."
          autoCapitalize="none"
          spellCheck={false}
          placeholder="For example: dm.kandy01"
          className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`}
        />
        {!account && <span className="block text-xs font-normal text-muted">Use 3–100 characters: lowercase letters, numbers, dots, underscores or hyphens. No spaces.</span>}
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>Mobile number</span>
        <input
          required
          name="phone"
          defaultValue={account?.phone ?? ""}
          className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`}
        />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>Email <span className="font-normal text-muted">(optional)</span></span>
        <input name="email" type="email" defaultValue={account?.email ?? ""} className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>Role</span>
        <select
          name="role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setSelectedSocietyIds([]);
          }}
          className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`}
        >
          {[
            ["SOCIETY_OFFICER", "Society Officer"],
            ["PROGRAMME_COORDINATOR", "SPC"],
            ["DEPUTY_DISTRICT_MANAGER", "DDM"],
            ["DISTRICT_MANAGER", "DM"],
            ["HQ_ADMIN", "HQ"],
          ].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {role !== "HQ_ADMIN" && (
        <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
          <span>District</span>
          <select
            name="districtId"
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setSelectedSocietyIds([]);
            }}
            required
            className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`}
          >
            <option value="">Choose district</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameEn}
              </option>
            ))}
          </select>
        </label>
      )}
      {!["HQ_ADMIN", "DISTRICT_MANAGER"].includes(role) && (
        <label className={`block space-y-1.5 text-sm font-medium text-[#3e4b43] ${account ? "" : "md:col-span-2"}`}>
          <span>Assigned societies <span className="font-normal text-muted">({role === "SOCIETY_OFFICER" ? "exactly one" : "select all assigned"})</span></span>
          <select
            required
            multiple={role !== "SOCIETY_OFFICER"}
            name="societyIds"
            value={role === "SOCIETY_OFFICER" ? selectedSocietyIds[0] ?? "" : selectedSocietyIds}
            onChange={(e) =>
              setSelectedSocietyIds(
                role === "SOCIETY_OFFICER"
                  ? e.target.value
                    ? [e.target.value]
                    : []
                  : Array.from(e.target.selectedOptions, (option) => option.value),
              )
            }
            className={`${field} ${role === "SOCIETY_OFFICER" ? "h-11" : "min-h-28"} rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`}
          >
            {role === "SOCIETY_OFFICER" && <option value="">Choose one society</option>}
            {societies
              .filter((s) => s.districtId === districtId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn} · {s.societyCode}
                </option>
              ))}
          </select>
        </label>
      )}
      {!account && <>
        <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
          <span>Permanent password</span>
          <input required name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`} />
          <span className="block text-xs font-normal text-muted">At least 10 characters, including a number. It must differ from the username.</span>
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
          <span>Confirm password</span>
          <input required name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} className={`${field} h-11 rounded-md text-base focus:border-[#26744b] focus:outline-none focus:ring-2 focus:ring-[#c6e2cd]`} />
        </label>
        <p className="text-sm leading-5 text-muted md:col-span-2">The password is stored as a secure hash. HQ can set a replacement password later, but cannot view the saved password.</p>
      </>}
      <div className={account ? "" : "md:col-span-2"}><Result result={state} /></div>
      <div className={account ? "" : "flex flex-wrap items-center gap-3 md:col-span-2"}>
      <button className={`${button} rounded-md px-5 py-2.5`} disabled={pending}>
        {pending
          ? "Saving…"
          : account
            ? "Update assignments"
            : "Create account"}
      </button>
      </div>
    </form>
  );
}
export function ReissueForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reissueAccount, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>New activation method</span>
        <select name="method" className={`${field} h-10 rounded-md`}>
          <option value="LINK">Activation credential</option>
          <option value="TEMPORARY_PASSWORD">Temporary password</option>
        </select>
      </label>
      <button disabled={pending} className={`${button} rounded-md px-4 py-2 text-sm`}>
        Issue new invitation
      </button>
      <Result result={state} />
    </form>
  );
}

export function SetPasswordForm({ id, username }: { id: string; username: string }) {
  const [state, action, pending] = useActionState(setAccountPassword, {});
  useEffect(() => {
    if (!state.success) return;
    const form = document.getElementById(`password-form-${id}`) as HTMLFormElement | null;
    form?.reset();
  }, [id, state.success]);
  return (
    <form id={`password-form-${id}`} action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted">Set a permanent password for <strong className="text-ink">@{username}</strong>. This activates the account if it was pending or disabled, and signs out any current sessions.</p>
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>New password</span>
        <input required name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} className={`${field} h-10 rounded-md`} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-[#3e4b43]">
        <span>Confirm new password</span>
        <input required name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} className={`${field} h-10 rounded-md`} />
      </label>
      <p className="text-xs text-muted">Use at least 10 characters and include a number. The password must differ from the username.</p>
      <button disabled={pending} className={`${button} rounded-md px-4 py-2 text-sm`}>
        {pending ? "Saving…" : "Set new password"}
      </button>
      <Result result={state} />
    </form>
  );
}

export function DisableAccountForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(disableAccount, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Disable this account and revoke its sessions?"))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="text-red-800 underline">
        Disable account
      </button>
      <Result result={state} />
    </form>
  );
}
