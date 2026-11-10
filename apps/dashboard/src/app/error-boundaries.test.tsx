import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import SpcError from "./(spc)/error";
import RootError from "./error";

/**
 * Next.js 15 gives an error boundary `error` and `reset` only. These render
 * each boundary exactly that way and press Try again.
 */
describe.each([
  ["app", RootError],
  ["SPC", SpcError],
] as const)("%s error boundary", (_name, Boundary) => {
  afterEach(() => vi.restoreAllMocks());

  it("retries with reset and hides the raw error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    const reset = vi.fn();
    const error = Object.assign(new Error("connection to db-internal-01 refused"), { digest: "4021984" });

    render(<Boundary error={error} reset={reset} />);

    expect(screen.queryByText(/db-internal-01/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
