import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlatformAdminScreen } from "./platform-admin";

describe("platform administration", () => {
  it("shows the prototype user table and switches to role and audit tabs", async () => {
    const user = userEvent.setup();
    render(<PlatformAdminScreen />);

    expect(screen.getByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Demonstration Platform Users, Roles and Access Scopes" })).toBeInTheDocument();
    expect(screen.getByText("R. Fernando")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Roles & Permissions" }));
    expect(screen.getByRole("table", { name: "Demonstration Role Permissions and Scopes" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "System Audit Log" }));
    expect(screen.getByRole("table", { name: "Recent Platform Administration Audit Events" })).toBeInTheDocument();
  });
});
