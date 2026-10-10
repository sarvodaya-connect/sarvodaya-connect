import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import DashboardError from "./error";
import DashboardLoading from "./loading";

describe("Dashboard route states", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    push.mockClear();
  });

  it("shows a loading status while the page loads", () => {
    render(<DashboardLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard data…");
  });

  it("shows a safe error message, a reference and recovery actions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    const retry = vi.fn();
    const error = Object.assign(new Error("connection to db-internal-01 refused"), { digest: "4021984" });

    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} retry={retry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load this page");
    expect(screen.queryByText(/db-internal-01/)).not.toBeInTheDocument();
    expect(screen.getByText("4021984")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to societies" })).toHaveAttribute("href", "/societies");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("link", { name: "Back to societies" }));
    expect(push).toHaveBeenCalledWith("/societies");
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
