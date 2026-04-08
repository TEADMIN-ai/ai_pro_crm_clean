"use client";

import { FormEvent, useState } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type RegisterResponse = {
  success: boolean;
  contractorId?: string;
  error?: string;
};

export default function PortalRegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await authFetch(API_ROUTES.PORTAL_REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, email }),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok || !data.success) {
        setIsError(true);
        setMessage(data.error ?? "Registration failed");
        return;
      }

      setIsError(false);
      setMessage(`Registration submitted. Contractor ID: ${data.contractorId}`);
      setCompanyName("");
      setEmail("");
    } catch {
      setIsError(true);
      setMessage("Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 480 }}>
      <h1>Contractor Portal Registration</h1>
      <p>Create your contractor onboarding request.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label htmlFor="companyName">Company name</label>
        <input
          id="companyName"
          name="companyName"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          required
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Register"}
        </button>
      </form>

      {message ? (
        <p style={{ marginTop: "1rem", color: isError ? "#b00020" : "#0a7a3a" }}>{message}</p>
      ) : null}
    </main>
  );
}
