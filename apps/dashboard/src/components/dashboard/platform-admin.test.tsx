import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlatformAdminScreen } from "./platform-admin";

describe("platform administration", () => {
  it("shows the prototype user table and switches to role and audit tabs", async () => {
    const user = userEvent.setup();
    render(<PlatformAdminScreen />);

    expect(screen.getByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Demonstration platform users, roles and access scopes" })).toBeInTheDocument();
    expect(screen.getByText("R. Fernando")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Roles & permissions" }));
    expect(screen.getByRole("table", { name: "Demonstration role permissions and scopes" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "System audit log" }));
    expect(screen.getByRole("table", { name: "Recent platform administration audit events" })).toBeInTheDocument();
  });
});
