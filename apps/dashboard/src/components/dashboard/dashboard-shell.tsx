"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Brand } from "./brand";
import { Icon, type IconName } from "./icon";

type PreviewRole = "national" | "district" | "platform";

const roleDetails: Record<PreviewRole, { label: string; initials: string; title: string }> = {
  national: { label: "National overview", initials: "HQ", title: "National Administrator" },
  district: { label: "District manager", initials: "DM", title: "District Manager · Kurunegala" },
  platform: { label: "Platform administrator", initials: "PA", title: "Platform Administrator" },
};

function parsePreviewRole(value: string | null): PreviewRole {
  return value === "district" || value === "platform" ? value : "national";
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = parsePreviewRole(searchParams.get("previewRole"));
  const currentRole = roleDetails[role];
  const dashboardHref = role === "platform" ? "/admin?previewRole=platform" : `/dashboard?previewRole=${role}`;
  const navigationItems: { href: string; icon: IconName; label: string; roles: PreviewRole[] }[] = [
    { href: dashboardHref, icon: "home", label: "Overview", roles: ["national", "district", "platform"] },
    { href: `/societies?previewRole=${role}`, icon: "society", label: "Societies", roles: ["national", "district"] },
    { href: `/districts/kurunegala?previewRole=${role}`, icon: "district", label: "District view", roles: ["national", "district"] },
    { href: `/reviews?previewRole=${role}`, icon: "review", label: "Review queue", roles: ["national", "district"] },
    { href: "/admin?previewRole=platform", icon: "building", label: "Platform access", roles: ["platform"] },
  ];
  const navigation = navigationItems.filter((item) => item.roles.includes(role));

  function changeRole(value: string) {
    const nextRole = parsePreviewRole(value);
    router.replace(nextRole === "platform" ? "/admin?previewRole=platform" : `/dashboard?previewRole=${nextRole}`);
  }

  return (
    <div className="min-h-screen bg-[#f4f5ef] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-[#123d29] text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-white/10 px-6 py-6">
          <Brand inverse />
        </div>
        <p className="px-6 pt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8db39a]">
          Workspace
        </p>
        <nav className="mt-3 space-y-1 px-3" aria-label="Primary navigation">
          {navigation.map((item) => {
            const hrefPath = item.href.split("?")[0];
            const active = pathname === hrefPath || (hrefPath !== "/dashboard" && pathname.startsWith(`${hrefPath}/`));
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
                {item.label === "Review queue" && (
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
              {currentRole.initials}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">Demo account</strong>
              <span className="block truncate text-[10px] text-[#a8c7b1]">{currentRole.title}</span>
            </span>
            <Link aria-label="Sign out" href="/">
              <Icon className="size-4 text-[#a8c7b1]" name="logout" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-[74px] items-center justify-between gap-3 border-b border-[#dfe5dc] bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="lg:hidden"><Brand compact /></div>
          <div className="hidden text-sm text-[#66756b] lg:block">
            Sarvodaya Shramadana Societies
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <label className="sr-only" htmlFor="preview-role">Preview dashboard role</label>
            <select
              className="max-w-[170px] rounded-lg border border-[#ccd6ce] bg-white px-2.5 py-2 text-[11px] font-semibold text-[#304038] outline-none focus-visible:ring-2 focus-visible:ring-[#26744b] sm:max-w-none sm:px-3 sm:text-xs"
              id="preview-role"
              onChange={(event) => changeRole(event.target.value)}
              value={role}
            >
              <option value="national">National view</option>
              <option value="district">District view</option>
              <option value="platform">Platform admin</option>
            </select>
            <span className="hidden rounded-full border border-[#e5d59f] bg-[#fff9e9] px-3 py-1 text-[11px] font-semibold text-[#755a08] sm:inline-flex">
              Demonstration Data
            </span>
            <span aria-label={currentRole.title} className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e6f0e7] text-xs font-bold text-[#174a32]">
              {currentRole.initials}
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
