import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SIGN_IN_FAILED } from "@/lib/sign-in-messages";

import { CreateAccountDrawer, SetPasswordDialog, SignInForm } from "./identity-forms";

const actions = vi.hoisted(() => ({
  createAccount: vi.fn(async () => ({})),
  login: vi.fn(async () => ({})),
  setAccountPassword: vi.fn(async () => ({})),
}));
vi.mock("@/app/identity-actions", () => actions);

const options = {
  districts: [{ id: "d1", nameEn: "Kurunegala", code: "KG" }],
  societies: [
    { id: "s1", nameEn: "Pahala Kosgama SSS", societyCode: "S-1", districtId: "d1" },
    { id: "s2", nameEn: "Wellawa SSS", societyCode: "S-2", districtId: "d1" },
  ],
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  vi.clearAllMocks();
});

describe("V5 D01 sign-in", () => {
  it("shows the V5 wording, the Society Officer note and a password toggle", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Society Officers use the Sarvodaya Connect phone app.")).toBeInTheDocument();
    expect(screen.getByText(/Forgot your password\? Ask HQ to set a new one\./)).toBeInTheDocument();
    const password = screen.getByLabelText(/^Password/);
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows the D01e error in the chosen language", async () => {
    const user = userEvent.setup();
    actions.login.mockResolvedValueOnce({ error: SIGN_IN_FAILED } as never);
    render(<SignInForm />);

    await user.click(screen.getByRole("button", { name: "தமிழ்" }));
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
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await user.type(screen.getByLabelText(/Full name/), "P. Jayaweera");
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
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText(/Full name/), "P. Jayaweera");
    await user.type(screen.getByLabelText(/Mobile number/), "+94000000311");
    await user.selectOptions(screen.getByLabelText(/^District/), "d1");
    await user.selectOptions(screen.getByLabelText(/^Society/), "s1");
    await user.type(screen.getByLabelText(/^Password/), "first-pass-123");
    await user.type(screen.getByLabelText(/Repeat password/), "other-pass-123");
    await user.click(screen.getAllByRole("button", { name: "Create account" })[1]!);

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

    expect(screen.getByRole("heading", { name: "Set a new password for M. Herath" })).toBeInTheDocument();
    expect(screen.getByText(/The old password stops working straight away/)).toBeInTheDocument();
  });
});
