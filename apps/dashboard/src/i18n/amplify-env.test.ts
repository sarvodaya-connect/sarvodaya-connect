import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { availableLocales, LOCALES, REVIEWED_LOCALES } from "./config";

/**
 * Amplify passes console variables to the Next.js server only when the build
 * writes them to .env.production. This runs that exact build command from
 * amplify.yml with fictional values, so a variable dropped from its list fails
 * here rather than silently in TEST.
 */
const amplify = readFileSync(resolve(__dirname, "../../../../amplify.yml"), "utf8");
const exportLine = amplify
  .split("\n")
  .map((line) => line.trim().replace(/^- /, ""))
  .find((line) => line.startsWith("env | grep") && line.includes(".env.production"));

function exported(env: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "amplify-env-"));
  try {
    execFileSync("/bin/sh", ["-c", exportLine!], { cwd: dir, env: { NODE_ENV: "production", PATH: process.env.PATH ?? "/usr/bin:/bin", ...env } });
    return Object.fromEntries(
      readFileSync(join(dir, ".env.production"), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    ) as Record<string, string>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("amplify.yml .env.production export", () => {
  it("has one build step that writes .env.production", () => {
    expect(exportLine).toBeDefined();
  });

  it("passes SHOW_UNREVIEWED_TRANSLATIONS through so TEST can show the drafts", () => {
    const env = exported({ SHOW_UNREVIEWED_TRANSLATIONS: "true", API_BASE_URL: "https://api.example.test/api/v1" });
    expect(env).toMatchObject({ SHOW_UNREVIEWED_TRANSLATIONS: "true", API_BASE_URL: "https://api.example.test/api/v1" });
    expect(availableLocales({ NODE_ENV: "production", ...env })).toEqual(LOCALES);
  });

  it("keeps the drafts hidden in production when the flag is not set", () => {
    const env = exported({ API_BASE_URL: "https://api.example.test/api/v1" });
    expect(env).not.toHaveProperty("SHOW_UNREVIEWED_TRANSLATIONS");
    expect(availableLocales({ NODE_ENV: "production", ...env })).toEqual(REVIEWED_LOCALES);
  });

  it("writes only the listed variables, never other build secrets", () => {
    const env = exported({ AWS_SECRET_ACCESS_KEY: "fictional", SHOW_UNREVIEWED_TRANSLATIONS_EXTRA: "x" });
    expect(env).toEqual({});
  });
});
