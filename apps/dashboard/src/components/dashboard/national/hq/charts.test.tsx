import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Columns } from "./charts";

const series = [
  { key: "female", label: "Women", colour: "#6c3c88" },
  { key: "male", label: "Men", colour: "#2f557c" },
];
const groups = [
  { key: "youth", label: "Youth", values: { female: 120, male: 80 }, description: "Youth: women 120, men 80, total 200" },
  { key: "elders", label: "Elders", values: { female: 40, male: 60 }, description: "Elders: women 40, men 60, total 100" },
];

describe("Columns chart", () => {
  it("makes each group a keyboard-reachable button named by its figures", async () => {
    const user = userEvent.setup();
    render(<Columns groups={groups} series={series} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Youth: women 120, men 80, total 200" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Elders: women 40, men 60, total 100" })).toHaveFocus();
  });

  it("pins one group's figures at a time with Enter, Space or a tap", async () => {
    const user = userEvent.setup();
    render(<Columns groups={groups} series={series} />);
    const youth = screen.getByRole("button", { name: /^Youth/ });
    const elders = screen.getByRole("button", { name: /^Elders/ });
    expect(youth).toHaveAttribute("aria-pressed", "false");

    youth.focus();
    await user.keyboard("{Enter}");
    expect(youth).toHaveAttribute("aria-pressed", "true");

    await user.click(elders);
    expect(youth).toHaveAttribute("aria-pressed", "false");
    expect(elders).toHaveAttribute("aria-pressed", "true");

    elders.focus();
    await user.keyboard(" ");
    expect(elders).toHaveAttribute("aria-pressed", "false");
  });
});
