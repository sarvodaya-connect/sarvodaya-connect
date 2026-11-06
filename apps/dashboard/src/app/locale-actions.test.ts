import { beforeEach, describe, expect, it, vi } from "vitest";

const { set, jar } = vi.hoisted(() => {
  const set = vi.fn();
  return { set, jar: { set, get: vi.fn(), delete: vi.fn() } };
});
vi.mock("next/headers", () => ({ cookies: async () => jar }));

import { LOCALE_COOKIE } from "@/i18n/config";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/session-cookies";
import { ROLE_COOKIE } from "@/lib/role-routes";

import { setLocale } from "./locale-actions";

describe("saving the language", () => {
  beforeEach(() => {
    set.mockClear();
    vi.unstubAllEnvs();
  });

  it("keeps it for a year", async () => {
    await setLocale("ta");
    expect(set).toHaveBeenCalledWith(LOCALE_COOKIE, "ta", expect.objectContaining({ maxAge: 31536000, path: "/", sameSite: "lax" }));
  });

  it("refuses an unknown language", async () => {
    await setLocale("fr");
    expect(set).not.toHaveBeenCalled();
  });

  it("refuses an unreviewed language in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await setLocale("si");
    expect(set).not.toHaveBeenCalled();
    await setLocale("en");
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("is not one of the cookies sign-out removes", () => {
    expect([SESSION_COOKIE, REFRESH_COOKIE, ROLE_COOKIE]).not.toContain(LOCALE_COOKIE);
  });
});
