"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getPasswordResetErrorMessage } from "@/lib/auth/passwordResetMessages";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) {
      setError("Enter the email address linked to your account.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await sendPasswordResetEmail(auth, nextEmail);
      setSubmittedEmail(nextEmail);
    } catch (resetError) {
      console.error("Password reset failed", resetError);
      setError(getPasswordResetErrorMessage(resetError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        {submittedEmail ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Password reset
            </p>
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <p className="text-sm leading-6 text-slate-300">
              If an account exists for {submittedEmail}, a secure reset link has been sent.
            </p>
            <Link className="inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950" href="/login">
              Back to login
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Account access
            </p>
            <h1 className="text-2xl font-semibold">Reset password</h1>
            <p className="text-sm leading-6 text-slate-300">
              Enter your account email and we will send a secure reset link.
            </p>
            <label className="block">
              <span className="text-sm font-medium text-slate-200">Email</span>
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </p>
            ) : null}
            <button
              className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? "Sending reset link..." : "Send reset link"}
            </button>
            <Link className="block text-center text-sm font-semibold text-cyan-200" href="/login">
              Back to login
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
