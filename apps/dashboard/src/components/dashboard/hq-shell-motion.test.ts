import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// A transform kept after an entry animation ("both" or "forwards") makes the
// animated element the containing block of every fixed-position overlay inside
// it, such as SarvoAI's "How Was This Answered?" panel.
const files = ["hq-shell.module.css", "national/hq/hq.module.css"];

describe("HQ entry animations", () => {
  it.each(files)("%s keeps no transform once an animation ends", (file) => {
    const css = readFileSync(join(__dirname, file), "utf8");
    const fills = [...css.matchAll(/animation:[^;]*;/g)].map((match) => match[0]).filter((rule) => !rule.includes("none"));
    expect(fills.length).toBeGreaterThan(0);
    for (const rule of fills) expect(rule).not.toMatch(/\b(both|forwards)\b/);
  });
});
