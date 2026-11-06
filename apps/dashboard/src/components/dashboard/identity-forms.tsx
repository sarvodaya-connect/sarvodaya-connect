"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ScopeOptions, UserRole } from "@sarvodaya-connect/api-contracts";
import {
  createAccount,
  disableAccount,
  login,
  setAccountPassword,
  updateAccount,
  type FormResult,
} from "@/app/identity-actions";
import { ROLE_LABELS } from "@/lib/accounts";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/i18n/provider";
import { SIGN_IN_ERROR_KEYS, suggestUsername } from "@/lib/sign-in-messages";

import { primaryButtonClass, secondaryButtonClass } from "./data-states";
import { Icon } from "./icon";

const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-leaf focus:ring-3 focus:ring-brand-mint aria-[invalid=true]:border-danger-dot";
const labelClass = "block text-xs font-semibold text-ink";

function Required() {
  return <span aria-hidden="true" className="text-danger-dot"> *</span>;
}

/** Password box with a show/hide eye (V5 D01, D16i, D16t). */
function PasswordInput({
  autoComplete,
  hideLabel = "Hide password",
  invalid,
  name,
  showLabel = "Show password",
  ...props
}: {
  autoComplete: string;
  hideLabel?: string;
  invalid?: boolean;
  name: string;
  showLabel?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        {...props}
        aria-invalid={invalid || undefined}
        autoComplete={autoComplete}
        className={`${inputClass} pr-10`}
        name={name}
        required
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-soft hover:bg-brand-mint-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
        onClick={() => setVisible((value) => !value)}
        type="button"
      >
        <Icon className="size-4" name={visible ? "close" : "eye"} strokeWidth={2} />
      </button>
    </span>
  );
}

function Message({ result }: { result: FormResult }) {
  if (result.error)
    return (
      <p className="flex gap-2.5 rounded-xl border border-[var(--banner-incident-line)] bg-[var(--banner-incident-bg)] px-3.5 py-2.5 text-[12.5px] text-[var(--banner-incident-text)]" role="alert">
        <Icon className="mt-0.5 size-4 shrink-0" name="error" strokeWidth={2} />
        {result.error}
      </p>
    );
  if (result.success)
    return (
      <p className="flex gap-2.5 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] px-3.5 py-2.5 text-[12.5px] text-[var(--banner-edit-text)]" role="status">
        <Icon className="mt-0.5 size-4 shrink-0" name="success" strokeWidth={2} />
        {result.success}
      </p>
    );
  return null;
}

/** V5 D01 / D01e: dashboard sign-in. */
export function SignInForm() {
  const [state, action, pending] = useActionState(login, {});
  const { t } = useI18n();
  const errorKey = state.error ? SIGN_IN_ERROR_KEYS[state.error] : undefined;
  const error = errorKey ? t(errorKey) : state.error;
  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-6 flex min-h-[34px] justify-end">
        <LanguageSwitcher />
      </div>
      <form action={action} className="space-y-4">
        <div>
          <h1 className="text-[26px] font-bold text-ink">{t("signIn.title")}</h1>
          <p className="mt-1 text-[13px] leading-5 text-ink-soft">{t("signIn.subtitle")}</p>
        </div>
        {error && <Message result={{ error }} />}
        <label className={labelClass}>
          {t("signIn.username")}
          <Required />
          <span className="relative mt-1.5 block">
            <input
              aria-invalid={error ? true : undefined}
              autoComplete="username"
              autoCapitalize="none"
              className={`${inputClass} pr-10`}
              defaultValue={state.username}
              key={state.username}
              name="username"
              required
            />
            <Icon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" name="user" strokeWidth={2} />
          </span>
        </label>
        <label className={labelClass}>
          {t("signIn.password")}
          <Required />
          <span className="mt-1.5 block">
            <PasswordInput
              autoComplete="current-password"
              hideLabel={t("signIn.hidePassword")}
              invalid={Boolean(error)}
              name="password"
              showLabel={t("signIn.showPassword")}
            />
          </span>
        </label>
        <button className={`${primaryButtonClass} h-11 w-full`} disabled={pending} type="submit">
          {pending ? t("signIn.waiting") : t("signIn.button")}
        </button>
        <div className="flex gap-2.5 rounded-xl border border-[#c3d5ea] bg-[#e6eef8] px-3.5 py-2.5 text-xs text-[#24476b]">
          <Icon className="mt-0.5 size-4 shrink-0" name="phone" strokeWidth={2} />
          <p>
            <strong className="block">{t("signIn.officerTitle")}</strong>
            {t("signIn.officerBody")}
          </p>
        </div>
        <div className="text-xs text-ink-soft">
          {t("signIn.forgot")} ·{" "}
          <details className="inline">
            <summary className="inline cursor-pointer list-none text-brand-action underline underline-offset-2">{t("signIn.privacy")}</summary>
            <p className="mt-2 leading-5 text-ink-body">{t("signIn.privacyBody")}</p>
          </details>
        </div>
      </form>
    </div>
  );
}


/** What the Scope field asks for, by role (V5 D16i hint under Scope). */
const SCOPE_HINTS: Record<UserRole, string> = {
  SOCIETY_OFFICER: "A Society Officer has exactly one society.",
  PROGRAMME_COORDINATOR: "Choose the district, then the societies this SPC looks after.",
  DEPUTY_DISTRICT_MANAGER: "Choose the district, then the societies this DDM looks after.",
  DISTRICT_MANAGER: "A DM sees every society in one district, view only.",
  HQ_ADMIN: "HQ has national access.",
};

/**
 * Role and its scope (V5 D16i): a Society Officer has one society, an SPC or
 * DDM has societies in one district, a DM has a district and HQ is national.
 * The API checks the same rules.
 */
function RoleScopeFields({
  initial,
  options,
}: {
  initial?: { role: UserRole; districtId: string | null; societyIds: string[] };
  options: ScopeOptions;
}) {
  const [role, setRole] = useState<UserRole>(initial?.role ?? "SOCIETY_OFFICER");
  const [districtId, setDistrictId] = useState(initial?.districtId ?? "");
  const societies = options.societies.filter((society) => society.districtId === districtId);
  const assigned = new Set(initial?.societyIds ?? []);
  return (
    <>
      <label className={labelClass}>
        Role<Required />
        <select
          className={`${inputClass} mt-1.5`}
          name="role"
          onChange={(event) => setRole(event.target.value as UserRole)}
          value={role}
        >
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((value) => (
            <option key={value} value={value}>{ROLE_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <div className="text-xs font-semibold text-ink">
        {role === "HQ_ADMIN" ? (
          <>
            <span>Scope</span>
            <p className="mt-1.5 flex h-10 items-center rounded-[10px] border border-line bg-surface-muted px-3 text-[13px] font-normal">National</p>
          </>
        ) : (
          <label className="block">
            {role === "DISTRICT_MANAGER" ? "Scope" : "District"}<Required />
            <select
              className={`${inputClass} mt-1.5`}
              name="districtId"
              onChange={(event) => setDistrictId(event.target.value)}
              required
              value={districtId}
            >
              <option value="">Choose a district</option>
              {options.districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.nameEn}{role === "DISTRICT_MANAGER" ? " District" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-1 text-[11px] font-normal text-ink-soft">{SCOPE_HINTS[role]}</p>
      </div>
      {role === "SOCIETY_OFFICER" && (
        <label className={`${labelClass} sm:col-span-2`}>
          Society<Required />
          <select
            className={`${inputClass} mt-1.5`}
            defaultValue={initial?.role === "SOCIETY_OFFICER" ? initial.societyIds[0] : ""}
            disabled={!districtId}
            name="societyIds"
            required
          >
            <option value="">{districtId ? "Choose the society" : "Choose a district first"}</option>
            {societies.map((society) => (
              <option key={society.id} value={society.id}>{society.nameEn} · {society.societyCode}</option>
            ))}
          </select>
        </label>
      )}
      {(role === "PROGRAMME_COORDINATOR" || role === "DEPUTY_DISTRICT_MANAGER") && (
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Assigned Societies<Required /></legend>
          {districtId ? (
            <div className="mt-1.5 grid max-h-44 gap-1 overflow-y-auto rounded-[10px] border border-line p-2 sm:grid-cols-2">
              {societies.length ? (
                societies.map((society) => (
                  <label className="flex items-center gap-2 rounded-md px-2 py-1 text-[12.5px] hover:bg-brand-mint-soft" key={society.id}>
                    <input defaultChecked={assigned.has(society.id)} name="societyIds" type="checkbox" value={society.id} />
                    {society.nameEn} · {society.societyCode}
                  </label>
                ))
              ) : (
                <p className="px-2 py-1 text-xs text-ink-soft">No societies in this district.</p>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-ink-soft">Choose a district first.</p>
          )}
        </fieldset>
      )}
    </>
  );
}

/** V5 D16i: side panel where HQ creates an account with a permanent password. */
export function CreateAccountDrawer({ options }: { options: ScopeOptions }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState(createAccount, {});
  const [formVersion, setFormVersion] = useState(0);
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  useEffect(() => {
    if (!state.success) return;
    // Never leave a typed password in the page after the account is created.
    form.current?.reset();
    setUsername("");
    setUsernameEdited(false);
    setFormVersion((version) => version + 1);
  }, [state]);

  const close = () => dialog.current?.close();

  return (
    <>
      <button className={primaryButtonClass} onClick={() => dialog.current?.showModal()} type="button">
        <Icon className="size-4" name="user" strokeWidth={2} />
        Create account
      </button>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-none w-full max-w-[560px] overflow-y-auto bg-surface p-0 shadow-[-12px_0_40px_rgba(0,0,0,0.18)] backdrop:bg-[rgba(28,42,33,0.35)]"
        ref={dialog}
      >
        <form
          action={action}
          className="grid grid-cols-1 gap-x-3.5 gap-y-4 p-6 sm:grid-cols-2"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const differ = data.get("password") !== data.get("confirmPassword");
            setMismatch(differ);
            if (differ) event.preventDefault();
          }}
          ref={form}
        >
          <div className="flex items-start justify-between gap-4 sm:col-span-2">
            <div>
              <h2 className="text-lg font-bold text-ink" id={titleId}>Create an Account</h2>
              <p className="text-xs text-ink-soft">HQ enters the person, a role and its scope, a username and a password</p>
            </div>
            <button aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink hover:bg-brand-mint-soft" onClick={close} type="button">
              <Icon className="size-4" name="close" strokeWidth={2} />
            </button>
          </div>
          <label className={labelClass}>
            Full name<Required />
            <input
              className={`${inputClass} mt-1.5`}
              maxLength={150}
              minLength={2}
              name="displayName"
              onChange={(event) => {
                if (!usernameEdited) setUsername(suggestUsername(event.target.value));
              }}
              required
            />
          </label>
          <label className={labelClass}>
            Username<Required />
            <input
              aria-describedby={`${titleId}-username`}
              autoCapitalize="none"
              className={`${inputClass} mt-1.5`}
              name="username"
              onChange={(event) => {
                setUsernameEdited(true);
                setUsername(event.target.value.toLowerCase());
              }}
              pattern="[a-z0-9][a-z0-9._\-]{2,99}"
              required
              value={username}
            />
            <span className="mt-1 block text-[11px] font-normal text-ink-soft" id={`${titleId}-username`}>Suggested from the name. Must be unique.</span>
          </label>
          <label className={labelClass}>
            Mobile number<Required />
            <input autoComplete="off" className={`${inputClass} mt-1.5`} inputMode="tel" maxLength={30} minLength={7} name="phone" required />
          </label>
          <label className={labelClass}>
            Email (optional)
            <input autoComplete="off" className={`${inputClass} mt-1.5`} name="email" type="email" />
          </label>
          <RoleScopeFields key={formVersion} options={options} />
          <label className={labelClass}>
            Password<Required />
            <span className="mt-1.5 block">
              <PasswordInput autoComplete="new-password" invalid={mismatch} maxLength={128} minLength={10} name="password" />
            </span>
            <span className="mt-1 block text-[11px] font-semibold">This is the person&apos;s permanent password.</span>
          </label>
          <label className={labelClass}>
            Repeat password<Required />
            <span className="mt-1.5 block">
              <PasswordInput autoComplete="new-password" invalid={mismatch} maxLength={128} minLength={10} name="confirmPassword" />
            </span>
            {mismatch && <span className="mt-1 block text-[11px] text-danger-dot" role="alert">The passwords do not match.</span>}
          </label>
          <p className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[#e2b33a] bg-[#fff8e1] px-3.5 py-2.5 text-xs text-[#5c4300] sm:col-span-2">
            <span>Password rules (length, letters and numbers) are still to be agreed. For now: at least 10 characters, with a number, not the username.</span>
            <strong className="shrink-0">To confirm</strong>
          </p>
          <p className="flex gap-2.5 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] px-3.5 py-2.5 text-xs text-[var(--banner-edit-text)] sm:col-span-2">
            <Icon className="mt-0.5 size-4 shrink-0" name="lock" strokeWidth={2} />
            Give the username and password to the person yourself. They sign in with them straight away on the phone or dashboard.
          </p>
          <div className="sm:col-span-2">
            <Message result={state} />
          </div>
          <div className="flex gap-2.5 sm:col-span-2">
            <button className={secondaryButtonClass} onClick={close} type="button">Cancel</button>
            <button className={primaryButtonClass} disabled={pending} type="submit">
              <Icon className="size-4" name="user" strokeWidth={2} />
              {pending ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** V5 D16t: HQ sets a replacement password for one account. */
export function SetPasswordDialog({
  account,
}: {
  account: { id: string; displayName: string; username: string; scopeLabel: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState(setAccountPassword, {});
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  return (
    <>
      <button
        aria-label={`Set new password for ${account.displayName}`}
        className={`${secondaryButtonClass} px-3.5`}
        onClick={() => dialog.current?.showModal()}
        type="button"
      >
        Set new password
      </button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl bg-surface p-0 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(28,42,33,0.35)]"
        ref={dialog}
      >
        <form
          action={action}
          className="space-y-4 p-6"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const differ = data.get("password") !== data.get("confirmPassword");
            setMismatch(differ);
            if (differ) event.preventDefault();
          }}
          ref={form}
        >
          <input name="id" type="hidden" value={account.id} />
          <div className="flex flex-col items-center gap-2 text-center">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-state-mint text-brand-forest">
              <Icon className="size-5" name="key" strokeWidth={2} />
            </span>
            <h2 className="text-lg font-bold text-ink" id={titleId}>Set a New Password for {account.displayName}</h2>
            <p className="text-xs text-ink-soft">
              {account.scopeLabel} · username <strong className="text-ink">{account.username}</strong>
            </p>
          </div>
          <label className={labelClass}>
            New password<Required />
            <span className="mt-1.5 block">
              <PasswordInput autoComplete="new-password" invalid={mismatch} maxLength={128} minLength={10} name="password" />
            </span>
          </label>
          <label className={labelClass}>
            Repeat new password<Required />
            <span className="mt-1.5 block">
              <PasswordInput autoComplete="new-password" invalid={mismatch} maxLength={128} minLength={10} name="confirmPassword" />
            </span>
            {mismatch && <span className="mt-1 block text-[11px] text-danger-dot" role="alert">The passwords do not match.</span>}
          </label>
          <p className="flex gap-2.5 rounded-xl border border-[#efdda5] bg-[#fff8e1] px-3.5 py-2.5 text-xs text-[#5c4300]">
            <Icon className="mt-0.5 size-4 shrink-0" name="alert" strokeWidth={2} />
            <span>
              <strong className="block">Replaces the current password.</strong>
              The old password stops working straight away. Give the new one to {account.displayName} yourself. The change is recorded in the Change &amp; access log.
            </span>
          </p>
          <Message result={state} />
          <div className="flex justify-end gap-2.5">
            <button className={secondaryButtonClass} onClick={() => dialog.current?.close()} type="button">
              {state.success ? "Close" : "Cancel"}
            </button>
            {!state.success && (
              <button className={primaryButtonClass} disabled={pending} type="submit">
                <Icon className="size-4" name="key" strokeWidth={2} />
                {pending ? "Setting…" : "Set password"}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}

type ManagedAccount = {
  id: string;
  displayName: string;
  username: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  districtId: string | null;
  societyIds: string[];
  scopeLabel: string;
};

/** HQ changes a person's role or scope. Not a V5 frame; added at Sarvodaya's request. */
export function ChangeRoleDialog({
  account,
  options,
}: {
  account: ManagedAccount;
  options: ScopeOptions;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState(updateAccount, {});
  return (
    <>
      <button
        aria-label={`Change role for ${account.displayName}`}
        className={`${secondaryButtonClass} px-3.5`}
        onClick={() => dialog.current?.showModal()}
        type="button"
      >
        Change role
      </button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(620px,calc(100vw-32px))] rounded-2xl bg-surface p-0 text-left shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(28,42,33,0.35)]"
        ref={dialog}
      >
        <form action={action} className="grid grid-cols-1 gap-x-3.5 gap-y-4 p-6 sm:grid-cols-2">
          <input name="id" type="hidden" value={account.id} />
          <input name="displayName" type="hidden" value={account.displayName} />
          <input name="username" type="hidden" value={account.username} />
          <input name="phone" type="hidden" value={account.phone} />
          <input name="email" type="hidden" value={account.email ?? ""} />
          <div className="sm:col-span-2">
            <h2 className="text-lg font-bold text-ink" id={titleId}>Change Role for {account.displayName}</h2>
            <p className="text-xs text-ink-soft">
              Now: {account.scopeLabel} · username <strong className="text-ink">{account.username}</strong>
            </p>
          </div>
          <RoleScopeFields
            initial={{ role: account.role, districtId: account.districtId, societyIds: account.societyIds }}
            // Redrawn from the saved account after a change, so the fields never show stale values.
            key={`${account.role}:${account.districtId}:${account.societyIds.join(",")}:${String(state.success)}`}
            options={options}
          />
          <p className="flex gap-2.5 rounded-xl border border-[#efdda5] bg-[#fff8e1] px-3.5 py-2.5 text-xs text-[#5c4300] sm:col-span-2">
            <Icon className="mt-0.5 size-4 shrink-0" name="alert" strokeWidth={2} />
            <span>
              <strong className="block">The person is signed out.</strong>
              They sign in again to see their new role. Any temporary district view they had ends. The change is recorded in the Change &amp; access log.
            </span>
          </p>
          <div className="sm:col-span-2">
            <Message result={state} />
          </div>
          <div className="flex justify-end gap-2.5 sm:col-span-2">
            <button className={secondaryButtonClass} onClick={() => dialog.current?.close()} type="button">
              {state.success ? "Close" : "Cancel"}
            </button>
            {!state.success && (
              <button className={primaryButtonClass} disabled={pending} type="submit">
                {pending ? "Saving…" : "Save role"}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}

/** HQ disables an account. Not a V5 frame; added at Sarvodaya's request. */
export function DisableAccountDialog({ account }: { account: Pick<ManagedAccount, "id" | "displayName" | "username"> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action, pending] = useActionState(disableAccount, {});
  return (
    <>
      <button
        aria-label={`Disable account for ${account.displayName}`}
        className={`${secondaryButtonClass} px-3.5 text-danger-text`}
        onClick={() => dialog.current?.showModal()}
        type="button"
      >
        Disable
      </button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(480px,calc(100vw-32px))] rounded-2xl bg-surface p-0 text-left shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop:bg-[rgba(28,42,33,0.35)]"
        ref={dialog}
      >
        <form action={action} className="space-y-4 p-6">
          <input name="id" type="hidden" value={account.id} />
          <div className="flex flex-col items-center gap-2 text-center">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-state-danger text-danger-dot">
              <Icon className="size-5" name="lock" strokeWidth={2} />
            </span>
            <h2 className="text-lg font-bold text-ink" id={titleId}>Disable {account.displayName}?</h2>
            <p className="text-xs text-ink-soft">username <strong className="text-ink">{account.username}</strong></p>
          </div>
          <p className="rounded-xl border border-[var(--banner-incident-line)] bg-[var(--banner-incident-bg)] px-3.5 py-2.5 text-xs text-[var(--banner-incident-text)]">
            They are signed out straight away and can no longer sign in on the phone or dashboard. Their records stay. To let them back in, set a new password for them.
          </p>
          <Message result={state} />
          <div className="flex justify-end gap-2.5">
            <button className={secondaryButtonClass} onClick={() => dialog.current?.close()} type="button">
              {state.success ? "Close" : "Cancel"}
            </button>
            {!state.success && (
              <button
                className={`${primaryButtonClass} border-danger-dot bg-danger-dot hover:bg-[#8a241d]`}
                disabled={pending}
                type="submit"
              >
                {pending ? "Disabling…" : "Disable account"}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
