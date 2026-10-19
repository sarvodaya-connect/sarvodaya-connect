import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

import { getViewer } from "@/lib/access";
import { notificationsFor } from "@/lib/demo-notifications";

import { NotificationCentre } from "./notification-centre";
import { NotificationsProvider, useNotifications } from "./notifications-context";

// Links are plain anchors in tests: clicks still run the component's onClick, without a router.
vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

function UnreadBadge() {
  return <p data-testid="badge">{useNotifications().unreadCount}</p>;
}

function renderCentre(viewerId = "hq-admin", showEmpty = false) {
  const user = userEvent.setup();
  render(
    <NotificationsProvider initial={notificationsFor(getViewer(viewerId))}>
      <UnreadBadge />
      <NotificationCentre showEmpty={showEmpty} />
    </NotificationsProvider>,
  );
  return { user };
}

const items = () => within(screen.getByRole("list", { name: "Notifications" })).getAllByRole("listitem");
const itemFor = (title: string) => screen.getByText(title).closest("li")!;

describe("NotificationCentre", () => {
  it("shows unread and read notifications differently", () => {
    renderCentre();

    expect(items()).toHaveLength(9);
    expect(screen.getByRole("status")).toHaveTextContent("5 unread");

    const unread = itemFor("Incident INC-2026-07 activated: Cyclone, Eastern coast");
    expect(within(unread).getByText("Unread:")).toBeInTheDocument();
    expect(within(unread).getByTestId("unread-dot")).toBeInTheDocument();
    expect(within(unread).getByText("Incident INC-2026-07 activated: Cyclone, Eastern coast")).toHaveClass("font-semibold");
    expect(within(unread).getByText("Emergency alert · Today, 07:30")).toBeInTheDocument();

    const read = itemFor("Wellawa audit report returned by R. Fernando");
    expect(within(read).queryByText("Unread:")).not.toBeInTheDocument();
    expect(within(read).queryByTestId("unread-dot")).not.toBeInTheDocument();
    expect(within(read).getByText("Returned · 07 Nov 2026")).toBeInTheDocument();
  });

  it("marks a notification read when it is opened and links to the related page", async () => {
    const { user } = renderCentre();

    const link = screen.getByRole("link", { name: /Kurunegala District: 1 of 4 societies/ });
    expect(link).toHaveAttribute("href", "/compliance?district=district-kurunegala");
    await user.click(link);

    expect(within(itemFor("Kurunegala District: 1 of 4 societies has sent all 4 Registrar documents")).queryByText("Unread:")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("4 unread");
    expect(screen.getByTestId("badge")).toHaveTextContent("4");
  });

  it("marks an information-only notification read without leaving the list", async () => {
    const { user } = renderCentre();

    await user.click(screen.getByRole("button", { name: /2 new dashboard users are waiting for a role/ }));

    expect(screen.getByRole("status")).toHaveTextContent("4 unread");
  });

  it("filters notifications by category", async () => {
    const { user } = renderCentre();
    const filters = screen.getByRole("group", { name: "Filter notifications" });

    await user.click(within(filters).getByRole("button", { name: "Returned" }));
    expect(within(filters).getByRole("button", { name: "Returned" })).toHaveAttribute("aria-pressed", "true");
    expect(items()).toHaveLength(1);

    await user.click(within(filters).getByRole("button", { name: "Approvals" }));
    expect(items()).toHaveLength(3);

    await user.click(within(filters).getByRole("button", { name: "All" }));
    expect(items()).toHaveLength(9);
  });

  it("marks everything read", async () => {
    const { user } = renderCentre();

    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(screen.getByRole("status")).toHaveTextContent("All caught up");
    expect(screen.queryByText("Unread:")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("unread-dot")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
    expect(screen.getByTestId("badge")).toHaveTextContent("0");
  });

  it("only shows each role its own notifications and categories", () => {
    renderCentre("programme-coordinator");

    expect(items()).toHaveLength(2);
    expect(screen.queryByText(/Incident INC-2026-07/)).not.toBeInTheDocument();
    const filters = screen.getByRole("group", { name: "Filter notifications" });
    expect(within(filters).queryByRole("button", { name: "Emergency" })).not.toBeInTheDocument();
    expect(within(filters).queryByRole("button", { name: "Audits" })).not.toBeInTheDocument();
  });

  it("shows an empty state", () => {
    renderCentre("hq-admin", true);

    expect(screen.getByRole("heading", { name: "No notifications yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  });
});
