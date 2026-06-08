import { getPasswordResetErrorMessage } from "@/lib/auth/passwordResetMessages";

describe("password reset messages", () => {
  test("maps invalid email to user-facing copy", () => {
    expect(getPasswordResetErrorMessage({ code: "auth/invalid-email" })).toBe("Enter a valid email address.");
  });

  test("maps throttling to user-facing copy", () => {
    expect(getPasswordResetErrorMessage({ code: "auth/too-many-requests" })).toBe(
      "Too many reset attempts. Please wait a few minutes and try again.",
    );
  });

  test("does not expose internal Firebase errors", () => {
    expect(getPasswordResetErrorMessage({ code: "auth/internal-error", message: "Firebase: failed" })).toBe(
      "We could not send the reset email. Check the address and try again.",
    );
  });
});
