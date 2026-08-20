import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { AuthProvider, useAuth } from "@/app/context/AuthContext";
import {
  MockAuthAdapter,
  __resetMockAdapterStateForTests,
} from "@/app/lib/auth-adapter";
import { PasskeyForm } from "@/app/components/biometrics/PasskeyForm";

const STORAGE_KEY = "jarvis_auth_user";

const wrap = (children: React.ReactNode) => {
  __resetMockAdapterStateForTests();
  return (
    <AuthProvider adapter={new MockAuthAdapter()}>{children}</AuthProvider>
  );
};

const ModeToggle = () => {
  const { isRegisterMode, toggleMode } = useAuth();
  return (
    <button type="button" onClick={toggleMode} data-testid="mode-toggle">
      {isRegisterMode ? "TO_SIGNIN" : "TO_REGISTER"}
    </button>
  );
};

describe("PasskeyForm component", () => {
  beforeEach(() => window.localStorage.removeItem(STORAGE_KEY));
  afterEach(() => window.localStorage.removeItem(STORAGE_KEY));

  it("renders email + passkey + authenticate button in sign-in mode", async () => {
    render(wrap(<PasskeyForm />));
    expect(
      screen.getByRole("textbox", { name: /email address/i })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/^passkey$/i)
    ).toBeInTheDocument();
    await screen.findByRole("button", { name: /AUTHENTICATE$/i });
    expect(screen.queryByRole("textbox", { name: /^full name/i })).not.toBeInTheDocument();
  });

  it("renders full name + enroll operative button in register mode", async () => {
    render(
      wrap(
        <>
          <ModeToggle />
          <PasskeyForm />
        </>
      )
    );
    fireEvent.click(screen.getByTestId("mode-toggle"));
    expect(
      screen.getByRole("textbox", { name: /^full name/i })
    ).toBeInTheDocument();
    await screen.findByRole("button", { name: /ENROLL OPERATIVE$/i });
  });

  it("shows inline error when submitted without fields", async () => {
    render(wrap(<PasskeyForm />));
    const btn = await screen.findByRole("button", { name: /AUTHENTICATE$/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("toggles passkey visibility via eye button", async () => {
    render(wrap(<PasskeyForm />));
    const pwd = screen.getByLabelText(/^passkey$/i);
    expect(pwd).toHaveAttribute("type", "password");
    const eye = screen.getByRole("button", { name: /show passkey/i });
    fireEvent.click(eye);
    expect(pwd).toHaveAttribute("type", "text");
    const eyeOff = screen.getByRole("button", { name: /hide passkey/i });
    fireEvent.click(eyeOff);
    expect(pwd).toHaveAttribute("type", "password");
  });

  it("register mode shows inline error if full name missing", async () => {
    render(
      wrap(
        <>
          <ModeToggle />
          <PasskeyForm />
        </>
      )
    );
    fireEvent.click(screen.getByTestId("mode-toggle"));
    fireEvent.change(screen.getByRole("textbox", { name: /email address/i }), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/^passkey$/i), {
      target: { value: "password1" },
    });
    const btn = await screen.findByRole("button", { name: /ENROLL OPERATIVE$/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
