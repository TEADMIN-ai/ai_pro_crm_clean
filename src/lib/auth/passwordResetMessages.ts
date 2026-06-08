export function getPasswordResetErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";

  if (code === "auth/invalid-email") {
    return "Enter a valid email address.";
  }

  if (code === "auth/too-many-requests") {
    return "Too many reset attempts. Please wait a few minutes and try again.";
  }

  return "We could not send the reset email. Check the address and try again.";
}
