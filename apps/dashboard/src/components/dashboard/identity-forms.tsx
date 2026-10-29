"use client";
import { useActionState, useState, useEffect } from "react";
import Link from "next/link";
import type { AccountSummary } from "@sarvodaya-connect/api-contracts";
import {
  activate,
  inviteAccount,
  login,
  reissueAccount,
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
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-2xl font-semibold">HQ sign in</h1>
      <p>Use the username and password assigned to your HQ account.</p>
      <label className="block">
        Username
        <input
          required
          name="username"
          autoComplete="username"
          className={field}
        />
      </label>
      <label className="block">
        Password
        <input
          required
          name="password"
          type="password"
          autoComplete="current-password"
          className={field}
        />
      </label>
      <Result result={state} />
      <button disabled={pending} className={button}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p>
        <Link href="/activate" className="underline">
          Activate a new account
        </Link>
      </p>
      <p className="text-sm">
        Cannot sign in? Ask HQ to issue a new activation credential.
      </p>
    </form>
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
    <form action={details ? action : inspect} className="space-y-4">
      <h1 className="text-2xl font-semibold">Activate your account</h1>
      <p>
        Use the one-time credential HQ gave you. Temporary passwords also
        require your username.
      </p>
      <label className="block">
        Username
        <input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={field}
          readOnly={!!details}
        />
      </label>
      <label className="block">
        Activation credential
        <input
          required
          name="credential"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          type="password"
          className={field}
          readOnly={!!details}
        />
      </label>
      {error && (
        <p role="alert">
          {error} Ask HQ for a new invitation if this one has expired.
        </p>
      )}
      {details && (
        <>
          <section className="rounded border p-3">
            <h2>Check your details</h2>
            <p>
              {details.displayName} · {details.roleLabel ?? details.role}
            </p>
            <p>
              Scope: {details.scopeLabel ?? details.districtId ?? "National"}
            </p>
            <p>Assigned societies: {details.societyIds.length}</p>
            <p>
              HQ controls your role and assignments. Contact HQ if these details
              are wrong.
            </p>
          </section>
          <label className="block">
            New password
            <input
              required
              minLength={10}
              name="password"
              type="password"
              autoComplete="new-password"
              className={field}
            />
          </label>
          <p>
            At least 10 characters, including a number. Different from your
            username.
          </p>
          <label className="block">
            Confirm new password
            <input
              required
              name="confirm"
              type="password"
              autoComplete="new-password"
              className={field}
            />
          </label>
        </>
      )}
      <Result result={state} />
      {!state.success && (
        <button disabled={pending} className={button}>
          {details ? "Activate account" : "Check details"}
        </button>
      )}
      <p>
        <Link href="/" className="underline">
          Return to sign in
        </Link>
      </p>
    </form>
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
  const [districtId, setDistrictId] = useState(account?.districtId ?? "");
  const [role, setRole] = useState<string>(account?.role ?? "SOCIETY_OFFICER");
  const [state, action, pending] = useActionState(
    account ? updateAccount : inviteAccount,
    {},
  );
  return (
    <form action={action} className="space-y-3 rounded border bg-white p-5">
      <input type="hidden" name="id" value={account?.id ?? ""} />
      <h2 className="text-lg font-semibold">
        {account ? "Update account assignments" : "Invite an account"}
      </h2>
      <label className="block">
        Full name
        <input
          required
          name="displayName"
          defaultValue={account?.displayName ?? ""}
          className={field}
        />
      </label>
      <label className="block">
        Username
        <input
          required
          name="username"
          defaultValue={account?.username ?? ""}
          readOnly={!!account}
          pattern="[a-z0-9][a-z0-9._-]{2,99}"
          className={field}
        />
      </label>
      <label className="block">
        Mobile number
        <input
          required
          name="phone"
          defaultValue={account?.phone ?? ""}
          className={field}
        />
      </label>
      <label className="block">
        Email (optional)
        <input name="email" type="email" className={field} />
      </label>
      <label className="block">
        Role
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={field}
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
        <label className="block">
          District
          <select
            name="districtId"
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            required
            className={field}
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
        <label className="block">
          Assigned societies (
          {role === "SOCIETY_OFFICER" ? "exactly one" : "select all assigned"})
          <select
            required
            multiple={role !== "SOCIETY_OFFICER"}
            name="societyIds"
            defaultValue={
              role === "SOCIETY_OFFICER"
                ? account?.societyIds[0]
                : account?.societyIds
            }
            className={field}
          >
            {societies
              .filter((s) => !s.districtId || s.districtId === districtId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn} · {s.societyCode}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="block">
        Activation method
        <select name="method" className={field}>
          <option value="LINK">One-time activation credential</option>
          <option value="TEMPORARY_PASSWORD">Temporary password</option>
        </select>
      </label>
      <p>
        HQ never sees the permanent password. Activation details expire after 72
        hours.
      </p>
      <Result result={state} />
      <button className={button} disabled={pending}>
        {pending
          ? "Saving…"
          : account
            ? "Update assignments"
            : "Create invitation"}
      </button>
    </form>
  );
}
export function ReissueForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reissueAccount, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <label>
        New activation method
        <select name="method" className={field}>
          <option value="LINK">Activation credential</option>
          <option value="TEMPORARY_PASSWORD">Temporary password</option>
        </select>
      </label>
      <button disabled={pending} className={button}>
        Issue new invitation
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
