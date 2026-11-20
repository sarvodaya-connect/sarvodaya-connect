import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("dashboard security headers", () => {
  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sends the agreed headers on every route", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");
    expect(rules[0].headers).toEqual([
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    ]);
  });

  it("sets no script or style policy, which needs its own review", async () => {
    const rules = await nextConfig.headers!();
    const csp = rules[0].headers.find(
      (header) => header.key === "Content-Security-Policy",
    );
    expect(csp?.value).toBe("frame-ancestors 'none'");
  });
});
