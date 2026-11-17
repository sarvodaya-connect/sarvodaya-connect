import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/i18n/config";
import { ta } from "@/i18n/messages/ta";
import { I18nProvider } from "@/i18n/provider";
import { SIGN_IN_FAILED } from "@/lib/sign-in-messages";

import { ChangeRoleDialog, CreateAccountDrawer, DeleteAccountDialog, DisableAccountDialog, SetPasswordDialog, SignInForm } from "./identity-forms";

const actions = vi.hoisted(() => ({
  createAccount: vi.fn(async () => ({})),
  deleteAccount: vi.fn(async (): Promise<{ error?: string; success?: string }> => ({})),
  disableAccount: vi.fn(async () => ({})),
  login: vi.fn(async () => ({})),
  setAccountPassword: vi.fn(async () => ({})),
  updateAccount: vi.fn(async () => ({})),
}));
vi.mock("@/app/identity-actions", () => actions);
vi.mock("@/app/locale-actions", () => ({ setLocale: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const options = {
  districts: [{ id: "d1", nameEn: "Kurunegala", code: "KG" }],
  societies: [
    { id: "s1", nameEn: "Pahala Kosgama SSS", societyCode: "S-1", districtId: "d1" },
    { id: "s2", nameEn: "Wellawa SSS", societyCode: "S-2", districtId: "d1" },
  ],
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("Open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("Open");
  });
  vi.clearAllMocks();
});

describe("V5 D01 sign-in", () => {
  it("shows the V5 wording, the Society Officer note and a password toggle", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByText("Society Officers use the Sarvodaya Connect phone app.")).toBeInTheDocument();
    expect(screen.getByText(/Forgot your password\? Ask HQ to set a new one\./)).toBeInTheDocument();
    const password = screen.getByLabelText(/^Password/);
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show Password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows the D01e error in the chosen language", async () => {
    const user = userEvent.setup();
    actions.login.mockResolvedValueOnce({ error: SIGN_IN_FAILED } as never);
    render(
      <I18nProvider available={LOCALES} locale="ta" messages={ta}>
        <SignInForm />
      </I18nProvider>,
    );

    await user.type(screen.getByLabelText(/பயனர்பெயர்/), "someone");
    await user.type(screen.getByLabelText(/^கடவுச்சொல்/, { selector: "input" }), "wrong-pass-1");
    await user.click(screen.getByRole("button", { name: "உள்நுழைக" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("பயனர்பெயர் அல்லது கடவுச்சொல் சரியில்லை");
    expect(screen.getByLabelText(/^கடவுச்சொல்/, { selector: "input" })).toHaveAttribute("aria-invalid", "true");
  });
});

describe("V5 D16i create an account", () => {
  it("suggests a username and asks for the right scope for each role", async () => {
    const user = userEvent.setup();
    render(<CreateAccountDrawer options={options} />);
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await user.type(screen.getByLabelText(/Full Name/), "P. Jayaweera");
    expect(screen.getByLabelText(/Username/)).toHaveValue("p.jayaweera");
    expect(screen.getByText("A Society Officer has exactly one society.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Society/)).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/^District/), "d1");
    expect(screen.getByRole("option", { name: "Wellawa SSS · S-2" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Role/), "PROGRAMME_COORDINATOR");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText(/^Role/), "HQ_ADMIN");
    expect(screen.getByText("National")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^District/)).not.toBeInTheDocument();
  });

  it("does not send the form when the two passwords differ", async () => {
    const user = userEvent.setup();
    render(<CreateAccountDrawer options={options} />);
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await user.type(screen.getByLabelText(/Full Name/), "P. Jayaweera");
    await user.type(screen.getByLabelText(/Mobile Number/), "+94000000311");
    await user.selectOptions(screen.getByLabelText(/^District/), "d1");
    await user.selectOptions(screen.getByLabelText(/^Society/), "s1");
    await user.type(screen.getByLabelText(/^Password/), "first-pass-123");
    await user.type(screen.getByLabelText(/Repeat Password/), "other-pass-123");
    await user.click(screen.getAllByRole("button", { name: "Create Account" })[1]!);

    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    expect(actions.createAccount).not.toHaveBeenCalled();
  });
});

describe("V5 D16t set a new password", () => {
  it("names the person and warns that the old password stops working", async () => {
    const user = userEvent.setup();
    render(
      <SetPasswordDialog account={{ id: "a1", displayName: "M. Herath", username: "m.herath", scopeLabel: "SPC · 14 societies · Kurunegala" }} />,
    );
    await user.click(screen.getByRole("button", { name: "Set new password for M. Herath" }));

    expect(screen.getByRole("heading", { name: "Set a New Password for M. Herath" })).toBeInTheDocument();
    expect(screen.getByText(/The old password stops working straight away/)).toBeInTheDocument();
  });
});

describe("change role and disable (added to D16)", () => {
  const spc = {
    id: "a2",
    displayName: "S. Karunaratne",
    username: "s.karunaratne",
    phone: "+94000000002",
    email: null,
    role: "PROGRAMME_COORDINATOR" as const,
    districtId: "d1",
    societyIds: ["s2"],
    scopeLabel: "SPC · 1 society · Kurunegala",
  };

  it("opens with the person's current role and societies, and sends their details", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChangeRoleDialog account={spc} options={options} />);
    await user.click(screen.getByRole("button", { name: "Change role for S. Karunaratne" }));

    expect(screen.getByLabelText(/^Role/)).toHaveValue("PROGRAMME_COORDINATOR");
    expect(screen.getByLabelText(/^District/)).toHaveValue("d1");
    expect(screen.getByRole("checkbox", { name: "Wellawa SSS · S-2" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pahala Kosgama SSS · S-1" })).not.toBeChecked();
    expect(screen.getByText(/The person is signed out\./)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^Role/), "DISTRICT_MANAGER");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Save Role" }));
    const sent = (actions.updateAccount.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(sent.get("role")).toBe("DISTRICT_MANAGER");
    expect(sent.get("username")).toBe("s.karunaratne");
    expect(sent.get("phone")).toBe("+94000000002");
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it("asks before disabling and explains how to undo it", async () => {
    const user = userEvent.setup();
    render(<DisableAccountDialog account={spc} />);
    await user.click(screen.getByRole("button", { name: "Disable account for S. Karunaratne" }));

    expect(screen.getByRole("heading", { name: "Disable S. Karunaratne?" })).toBeInTheDocument();
    expect(screen.getByText(/To let them back in, set a new password for them\./)).toBeInTheDocument();
    expect(actions.disableAccount).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Disable Account" }));
    expect(actions.disableAccount).toHaveBeenCalledOnce();
  });
});

describe("Delete Account", () => {
  const account = { id: "11111111-1111-4111-8111-111111111111", displayName: "Fictional Leaver", username: "fictional.leaver", scopeLabel: "SPC · Kurunegala" };
  const open = async () => {
    const user = userEvent.setup();
    render(<DeleteAccountDialog account={account} />);
    await user.click(screen.getByRole("button", { name: "Delete account for Fictional Leaver" }));
    return user;
  };

  it("names the account, explains what happens, and only deletes after typing exactly delete", async () => {
    const user = await open();
    const dialog = screen.getByRole("dialog", { name: "Delete Fictional Leaver’s Account?" });
    expect(dialog).toHaveTextContent("fictional.leaver");
    expect(dialog).toHaveTextContent("SPC · Kurunegala");
    expect(dialog).toHaveTextContent("This cannot be undone.");
    expect(dialog).toHaveTextContent("Society records, documents and the change log stay as they are");
    const confirm = screen.getByRole("button", { name: "Delete Account" });
    const box = screen.getByLabelText("Type delete to confirm");
    expect(confirm).toBeDisabled();
    for (const wrong of ["Delete", "delete ", "DELETE", "del"]) {
      await user.clear(box);
      await user.type(box, wrong);
      expect(confirm).toBeDisabled();
    }
    await user.clear(box);
    await user.type(box, "delete");
    expect(confirm).toBeEnabled();
    expect(actions.deleteAccount).not.toHaveBeenCalled();
  });

  it("sends once, shows the result, and refreshes the list when closed", async () => {
    actions.deleteAccount.mockResolvedValueOnce({ success: "Account deleted. The person was signed out everywhere and can never sign in with this account again." });
    const user = await open();
    await user.type(screen.getByLabelText("Type delete to confirm"), "delete");
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Account deleted.");
    expect(actions.deleteAccount).toHaveBeenCalledTimes(1);
    const form = (actions.deleteAccount.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(form.get("id")).toBe(account.id);
    expect(form.get("confirmation")).toBe("delete");
    // Done: no second submit, only Close.
    expect(screen.queryByRole("button", { name: "Delete Account" })).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    screen.getByRole("dialog", { hidden: true }).dispatchEvent(new Event("close"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the API's refusal and keeps the account", async () => {
    actions.deleteAccount.mockResolvedValueOnce({ error: "This is the last active HQ administrator. Create another HQ account before deleting this one." });
    const user = await open();
    await user.type(screen.getByLabelText("Type delete to confirm"), "delete");
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("last active HQ administrator");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    screen.getByRole("dialog", { hidden: true }).dispatchEvent(new Event("close"));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("starts afresh each time it is opened", async () => {
    const user = await open();
    await user.type(screen.getByLabelText("Type delete to confirm"), "delete");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete account for Fictional Leaver" }));
    expect(screen.getByLabelText("Type delete to confirm")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Delete Account" })).toBeDisabled();
  });
});
