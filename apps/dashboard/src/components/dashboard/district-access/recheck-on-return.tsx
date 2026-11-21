"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { useI18n } from "@/i18n/provider";

/** Payloads this tab has already shown, by the token the server gave each render. */
const SHOWN = new Set<string>();

/**
 * Pages a DDM sees only through temporary district access. The browser's Back
 * and Forward buttons bring back the router's saved copy of a page without
 * asking the server, so after the DM ends access early (or it expires) that
 * copy could still show district societies. When a copy is shown again, this
 * hides it before it is painted and asks the server, which then sends the
 * current page: the view itself, or the DDM's own societies once access ended.
 *
 * `token` must be new on every server render (a random id). The guard is keyed
 * by it: Next.js keeps a page mounted when only its search params change, so
 * without the key a saved copy brought back by Back would skip the check.
 */
export function RecheckOnReturn({ children, token }: { children: ReactNode; token: string }) {
  return (
    <Guard key={token} token={token}>
      {children}
    </Guard>
  );
}

function Guard({ children, token }: { children: ReactNode; token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  // Decided on the first render only: a token this tab has shown before is a saved copy.
  const restored = useRef<string | null>(SHOWN.has(token) ? token : null);
  const [checking, setChecking] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (restored.current === token) {
      restored.current = null;
      setChecking(token);
      router.refresh();
    }
    SHOWN.add(token);
  }, [router, token]);

  if (checking === token) {
    return (
      <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-[12.5px] text-ink-soft" role="status">
        {t("da.checkingAccess")}
      </p>
    );
  }
  return <>{children}</>;
}
