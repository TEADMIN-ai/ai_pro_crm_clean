"use client";

import { useState, type FormEvent } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import type { AppUser } from "@/types/user";
import {
  DEFAULT_MANAGED_USER_ROLE,
  MANAGED_USER_ROLES,
  type ManagedUserRole,
} from "@/lib/users/managedUserRoles";

interface CreateUserFormProps {
  onCreated: (user: AppUser) => void;
  onCancel?: () => void;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: ManagedUserRole;
}

const INITIAL_FORM_STATE: FormState = {
  name: "",
  email: "",
  password: "",
  role: DEFAULT_MANAGED_USER_ROLE,
};

function validateForm(form: FormState): string | null {
  if (!form.name.trim() || !form.email.trim() || !form.password || !form.role) {
    return "All fields are required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid email address.";
  }

  if (form.password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return null;
}

export default function CreateUserForm({ onCreated, onCancel }: CreateUserFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await authFetch(API_ROUTES.USERS_CREATE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        user?: AppUser;
      };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? `Failed to create user (${response.status})`);
      }

      onCreated(payload.user);
      setSuccessMessage(`User created for ${payload.user.email}.`);
      setForm(INITIAL_FORM_STATE);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to create user.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="enterprise-form-grid" onSubmit={handleSubmit}>
      <div className="enterprise-field">
        <span>Name</span>
        <input
          className="enterprise-input"
          type="text"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Enter full name"
          disabled={loading}
          required
        />
      </div>

      <div className="enterprise-field">
        <span>Email</span>
        <input
          className="enterprise-input"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="user@company.com"
          disabled={loading}
          required
        />
      </div>

      <div className="enterprise-field">
        <span>Password</span>
        <input
          className="enterprise-input"
          type="password"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          placeholder="Minimum 8 characters"
          disabled={loading}
          required
        />
      </div>

      <div className="enterprise-field">
        <span>Role</span>
        <select
          className="enterprise-input"
          value={form.role}
          onChange={(event) =>
            setForm((current) => ({ ...current, role: event.target.value as ManagedUserRole }))
          }
          disabled={loading}
        >
          {MANAGED_USER_ROLES.map((roleOption) => (
            <option key={roleOption} value={roleOption}>
              {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="enterprise-form-error">{error}</p> : null}
      {successMessage ? <p style={{ margin: 0, color: "#15803d" }}>{successMessage}</p> : null}

      <div className="enterprise-form-actions">
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create User"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="enterprise-button-secondary"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
