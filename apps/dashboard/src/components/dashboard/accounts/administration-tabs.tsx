import Link from "next/link";

/** V5 D16 / D24: the two Administration pages share these tabs. */
export function AdministrationTabs({ current }: { current: "accounts" | "log" }) {
  const tabs = [
    { key: "accounts", href: "/accounts", label: "Accounts" },
    { key: "log", href: "/audit", label: "Change & access log" },
  ] as const;
  return (
    <nav aria-label="Administration" className="flex gap-6 border-b border-line">
      {tabs.map((tab) => (
        <Link
          aria-current={tab.key === current ? "page" : undefined}
          className={`-mb-px border-b-2 px-0.5 pb-2.5 text-[13px] ${
            tab.key === current ? "border-brand-forest font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"
          }`}
          href={tab.href}
          key={tab.key}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
