import { beforeEach, describe, expect, it, vi } from "vitest";

const { platformApi, redirect } = vi.hoisted(() => ({
  platformApi: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./platform-api", async () => {
  class PlatformApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  }
  return {
    PlatformApiError,
    platformApi,
    isDemoMode: () => false,
    isTransientPlatformError: (error: unknown) => error instanceof PlatformApiError && (error.status === 0 || error.status >= 500),
  };
});

import { getDesktopViewer } from "./current-viewer";
import { PlatformApiError } from "./platform-api";

describe("the signed-in viewer", () => {
  beforeEach(() => {
    platformApi.mockReset();
    redirect.mockClear();
  });

  it("sends someone whose session was refused to sign in", async () => {
    platformApi.mockRejectedValue(new PlatformApiError("Sign in", 401));
    await expect(getDesktopViewer()).rejects.toThrow("REDIRECT /");
  });

  it.each([0, 503])("does not sign someone out when the API is busy (%i)", async (status) => {
    platformApi.mockRejectedValue(new PlatformApiError("Service Unavailable", status));
    await expect(getDesktopViewer()).rejects.toMatchObject({ status });
    expect(redirect).not.toHaveBeenCalled();
  });
});
