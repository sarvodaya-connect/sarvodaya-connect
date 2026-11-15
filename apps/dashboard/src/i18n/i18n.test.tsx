import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, setLocale } = vi.hoisted(() => ({ refresh: vi.fn(), setLocale: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/dashboard" }));
vi.mock("@/app/locale-actions", () => ({ setLocale }));
vi.mock("@/app/identity-actions", () => ({ signOut: vi.fn() }));

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { DemoViewer } from "@/lib/access";
import { headingFor, navigationFor } from "@/lib/navigation";

import { availableLocales, DEFAULT_LOCALE, LOCALES, type Locale, REVIEWED_LOCALES, resolveLocale } from "./config";
import { en, type MessageKey } from "./messages/en";
import { si } from "./messages/si";
import { ta } from "./messages/ta";
import { I18nProvider } from "./provider";
import { createTranslator, formatNumber, type Messages } from "./translate";

const CATALOGS: Record<Locale, Messages> = { en, si, ta };
const keys = Object.keys(en) as MessageKey[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

/** Same in every language on purpose: brand names, acronyms and pure placeholders. */
const SAME_IN_EVERY_LANGUAGE = new Set<MessageKey>(["da.theDdm", "home.greeting", "s.filterSpc", "s.spcOf", "shell.sarvoai", "prog.sdgNumber", "eco.period.range", "eco.period.season", "eco.history.by"]);

describe.each(["si", "ta"] as const)("the %s catalog", (locale) => {
  const catalog = CATALOGS[locale];

  it("has every English key and no others", () => {
    expect(Object.keys(catalog).sort()).toEqual([...keys].sort());
  });

  it("keeps each message's placeholders", () => {
    for (const key of keys) expect([key, placeholders(catalog[key])]).toEqual([key, placeholders(en[key])]);
  });

  it("does not leave a message in English", () => {
    const untranslated = keys.filter((key) => catalog[key] === en[key] && !SAME_IN_EVERY_LANGUAGE.has(key));
    expect(untranslated).toEqual([]);
  });

  it.each(["Sarvodaya Connect", "HQ", "SPC", "DDM"])("keeps %s where the English has it, except where a reviewed term replaces it", (brand) => {
    const dropped = keys.filter((key) => en[key].includes(brand) && !catalog[key].includes(brand) && !/මූලස්ථාන|தலைமையக/.test(catalog[key]));
    expect(dropped).toEqual([]);
  });
});

describe("sentences with styled parts", () => {
  it("lets a translation move the styled part", () => {
    const t = createTranslator({ ...en, "ms.accessDm": "{scope} ඔබේ ප්‍රවේශය" }, "si");
    const { container } = render(<p>{t.rich("ms.accessDm", { scope: <strong>x</strong> })}</p>);
    expect(container.querySelector("strong")).toHaveTextContent("x");
    expect(container.firstChild?.firstChild).toBe(container.querySelector("strong"));
  });
});

describe("which languages people can choose", () => {
  it("hides unreviewed drafts in production", () => {
    expect(availableLocales({ NODE_ENV: "production" })).toEqual(REVIEWED_LOCALES);
    expect(availableLocales({ NODE_ENV: "production", SHOW_UNREVIEWED_TRANSLATIONS: "false" })).toEqual(REVIEWED_LOCALES);
    expect(REVIEWED_LOCALES).toEqual(["en"]);
  });

  it("shows drafts in development and where review needs them", () => {
    expect(availableLocales({ NODE_ENV: "development" })).toEqual(LOCALES);
    expect(availableLocales({ NODE_ENV: "production", SHOW_UNREVIEWED_TRANSLATIONS: "true" })).toEqual(LOCALES);
  });

  it("falls back to English for a missing, unknown or unavailable choice", () => {
    expect(resolveLocale(undefined, LOCALES)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("fr", LOCALES)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("si", ["en"])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("ta", LOCALES)).toBe("ta");
  });
});

describe("messages", () => {
  it("fills in values", () => {
    expect(createTranslator(en, "en")("shell.alertsNew", { count: 3 })).toBe("Alerts, 3 new");
    expect(createTranslator(ta, "ta")("shell.accountSignOut", { name: "Fictional Name" })).toContain("Fictional Name");
  });

  it("uses each language's plural forms", () => {
    const english = createTranslator(en, "en");
    expect(english.plural("scope.societies", 1)).toBe("1 society");
    expect(english.plural("scope.societies", 12)).toBe("12 societies");
    expect(createTranslator(ta, "ta").plural("scope.societies", 12)).toBe("12 சங்கங்கள்");
    expect(createTranslator(si, "si").plural("scope.societies", 12)).toBe("සමිති 12");
  });

  it("formats numbers for the language without changing the value", () => {
    expect(formatNumber("en", 98640)).toBe("98,640");
    for (const locale of LOCALES) expect(formatNumber(locale, 98640).replace(/\D/g, "")).toBe("98640");
  });
});

const viewers: DemoViewer[] = [
  { id: "1", displayName: "Fictional HQ", initials: "FH", role: "HQ_ADMIN", roleLabel: "HQ", scopeLabel: "National", districtIds: "ALL" },
  { id: "2", displayName: "Fictional DM", initials: "FD", role: "DISTRICT_MANAGER", roleLabel: "DM", scopeLabel: "Fictional", districtIds: ["d"], societyIds: [] },
  { id: "3", displayName: "Fictional DDM", initials: "FD", role: "DEPUTY_DISTRICT_MANAGER", roleLabel: "DDM", scopeLabel: "Fictional", districtIds: ["d"], societyIds: ["s"] },
  { id: "4", displayName: "Fictional SPC", initials: "FS", role: "PROGRAMME_COORDINATOR", roleLabel: "SPC", scopeLabel: "2 societies", districtIds: [], societyIds: ["s", "t"] },
];

describe.each(viewers)("the dashboard shell for $role", (viewer) => {
  const open = (locale: Locale) =>
    render(
      <I18nProvider available={LOCALES} locale={locale} messages={CATALOGS[locale]}>
        <DashboardShell viewer={viewer}>content</DashboardShell>
      </I18nProvider>,
    );

  it.each(["si", "ta"] as const)("shows its navigation and heading in %s", (locale) => {
    open(locale);
    const t = createTranslator(CATALOGS[locale], locale);
    for (const item of [...navigationFor(viewer, t).main, ...navigationFor(viewer, t).secondary]) {
      expect(screen.getAllByRole("link", { name: item.label }).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("heading", { level: 1, name: headingFor("/dashboard", viewer, t).title })).toBeInTheDocument();
    for (const item of navigationFor(viewer).main) {
      if (item.label !== "SarvoAI") expect(screen.queryByRole("link", { name: item.label })).not.toBeInTheDocument();
    }
  });

  it("is unchanged in English", () => {
    open("en");
    for (const item of navigationFor(viewer).main) expect(screen.getAllByRole("link", { name: item.label }).length).toBeGreaterThan(0);
  });

  it("keeps names and routes the same in every language", () => {
    expect(navigationFor(viewer, createTranslator(ta, "ta")).main.map((item) => item.href)).toEqual(navigationFor(viewer).main.map((item) => item.href));
    open("si");
    expect(screen.getAllByText(new RegExp(viewer.displayName)).length).toBeGreaterThan(0);
  });
});

describe("the brand in a translated sentence", () => {
  const hq = viewers[0]!;
  it.each([["en", "Ask SarvoAI"], ["si", "SarvoAI අසන්න"], ["ta", "SarvoAI-யிடம் கேளுங்கள்"]] as const)("stays whole in %s", (locale, text) => {
    render(
      <I18nProvider available={LOCALES} locale={locale} messages={CATALOGS[locale]}>
        <DashboardShell viewer={hq}>content</DashboardShell>
      </I18nProvider>,
    );
    expect(screen.getByRole("link", { name: text })).toHaveAttribute("href", "/sarvoai");
  });
});

describe("the language switcher", () => {
  beforeEach(() => {
    refresh.mockClear();
    setLocale.mockClear();
  });

  it("is hidden while only one language is available", () => {
    const { container } = render(
      <I18nProvider available={["en"]} locale="en" messages={en}>
        <LanguageSwitcher />
      </I18nProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names each language in that language, and saves a choice", async () => {
    render(
      <I18nProvider available={LOCALES} locale="en" messages={en}>
        <LanguageSwitcher />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "தமிழ்" }));
    expect(setLocale).toHaveBeenCalledWith("ta");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
