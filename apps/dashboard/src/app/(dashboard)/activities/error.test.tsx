import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProgrammesError from "./error";

describe("D07 error state", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retries with the reset Next.js passes to the error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    const reset = vi.fn();
    const error = Object.assign(new Error("connection to db-internal-01 refused"), { digest: "4021984" });

    // Next.js gives an error boundary `error` and `reset` only.
    render(<ProgrammesError error={error} reset={reset} />);

    expect(screen.queryByText(/db-internal-01/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
