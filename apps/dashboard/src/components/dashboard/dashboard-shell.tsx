"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "./brand";
import { Icon, type IconName } from "./icon";

const navigation: { href: string; icon: IconName; label: string }[] = [
  { href: "/societies", icon: "society", label: "Societies" },
  { href: "/districts/kurunegala", icon: "district", label: "District view" },
  { href: "/reviews", icon: "review", label: "Review queue" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f4f5ef] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-[#123d29] text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-white/10 px-6 py-6">
          <Brand inverse />
        </div>
        <p className="px-6 pt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8db39a]">
          Administration
        </p>
        <nav className="mt-3 space-y-1 px-3" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-[#e6f0e7] text-[#123d29] shadow-sm"
                    : "text-[#dce9de] hover:bg-white/8 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="size-[18px]" name={item.icon} />
                {item.label}
                {item.href === "/reviews" && (
                  <span className="ml-auto rounded-full bg-[#f3c44e] px-2 py-0.5 text-[10px] font-bold text-[#503b00]">
                    2
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/6 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#dce9de] text-xs font-bold text-[#123d29]">
              KF
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">K. Fernando</strong>
              <span className="block truncate text-[10px] text-[#a8c7b1]">
                HQ Administrator
              </span>
            </span>
            <Link aria-label="Sign out" href="/">
              <Icon className="size-4 text-[#a8c7b1]" name="logout" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-[#dfe5dc] bg-white/95 px-5 backdrop-blur md:px-8">
          <div className="lg:hidden"><Brand compact /></div>
          <div className="hidden text-sm text-[#66756b] lg:block">
            Sarvodaya Shramadana Societies
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#e5d59f] bg-[#fff9e9] px-3 py-1 text-[11px] font-semibold text-[#755a08]">
              Demonstration Data
            </span>
            <span className="hidden size-9 place-items-center rounded-full bg-[#e6f0e7] text-xs font-bold text-[#174a32] sm:grid">
              KF
            </span>
          </div>
        </header>
        <div className="border-b border-[#dfe5dc] bg-[#123d29] px-4 py-2 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${
                  pathname.startsWith(item.href)
                    ? "bg-white text-[#123d29]"
                    : "text-white/80"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <main className="px-5 py-7 md:px-8 md:py-9 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
