import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RecheckOnReturn } from "./recheck-on-return";

describe("temporary district view brought back with the Back button", () => {
  it("shows a fresh page, but hides a saved copy and asks the server again", () => {
    const first = render(
      <RecheckOnReturn token="render-1">
        <p>Example Bluebird Society</p>
      </RecheckOnReturn>,
    );
    expect(screen.getByText("Example Bluebird Society")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    first.unmount();

    // Back: the router shows the same saved render again.
    const restored = render(
      <RecheckOnReturn token="render-1">
        <p>Example Bluebird Society</p>
      </RecheckOnReturn>,
    );
    expect(screen.queryByText("Example Bluebird Society")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your access…");
    expect(refresh).toHaveBeenCalledTimes(1);

    // The server's answer is a new render: shown as it comes.
    restored.rerender(
      <RecheckOnReturn token="render-2">
        <p>Your own societies</p>
      </RecheckOnReturn>,
    );
    expect(screen.getByText("Your own societies")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
