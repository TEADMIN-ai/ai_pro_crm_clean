"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppUser } from "@/types/user";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import CreateUserForm from "@/components/users/CreateUserForm";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

export default function UsersPage() {
  const { role, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setFetchError(null);
        const response = await authFetch(API_ROUTES.USERS);
        if (!response.ok) {
          throw new Error(`Failed to fetch users (${response.status})`);
        }

        const payload = (await response.json()) as { users?: AppUser[] };
        setUsers(Array.isArray(payload.users) ? payload.users : []);
      } catch (err) {
        console.error("Error fetching users:", err);
        setFetchError(err instanceof Error ? err.message : "Failed to fetch users.");
      } finally {
        setLoading(false);
      }
    }

    void fetchUsers();
  }, []);

  if (authLoading || loading) {
    return <div className="enterprise-page">Loading users...</div>;
  }

  if (role !== "admin") {
    return <div className="enterprise-page">Access denied</div>;
  }

  const adminCount = users.filter((user) => user.role === "admin").length;
  const managerCount = users.filter((user) => user.role === "manager").length;
  const contractorCount = users.filter((user) => user.role === "contractor").length;
  const staffCount = users.filter((user) => user.role === "staff").length;

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader title="Users" subtitle="Identity, roles, and compliance access">
          <Badge tone="info">Total {users.length}</Badge>
          <button type="button" onClick={() => setShowCreateForm((current) => !current)}>
            {showCreateForm ? "Close Create User" : "Create User"}
          </button>
        </IdentityCardHeader>
      </Card>

      {showCreateForm ? (
        <Card>
          <h2 style={{ marginBottom: 8 }}>Create User</h2>
          <p style={{ marginTop: 0, marginBottom: 16 }}>
            Create a Firebase Auth account and store the user role in Firestore.
          </p>
          <CreateUserForm
            onCreated={(user) => {
              setUsers((current) =>
                [...current, user].sort((left, right) => left.email.localeCompare(right.email)),
              );
              setSuccessMessage(`Created ${user.email} successfully.`);
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </Card>
      ) : null}

      <Card>
        <h2>Compliance Score Summary</h2>
        <div className="compliance-summary">
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Admins</p>
            <p className="enterprise-metric-value">{adminCount}</p>
          </div>
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Contractors</p>
            <p className="enterprise-metric-value">{contractorCount}</p>
          </div>
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Managers</p>
            <p className="enterprise-metric-value">{managerCount}</p>
          </div>
          <div className="compliance-summary-item">
            <p className="enterprise-metric-label">Staff</p>
            <p className="enterprise-metric-value">{staffCount}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2>Premium Users Table</h2>
        {successMessage ? <p style={{ marginTop: 0, color: "#15803d" }}>{successMessage}</p> : null}
        {fetchError ? <p className="enterprise-form-error">{fetchError}</p> : null}
        {users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid}>
                  <td>{user.email}</td>
                  <td>{user.name ?? "-"}</td>
                  <td><Badge tone="info">{user.role}</Badge></td>
                  <td>
                    <Badge tone={user.role === "admin" ? "warning" : "success"}>
                      {user.role === "admin" ? "Privileged" : "Standard"}
                    </Badge>
                  </td>
                  <td>
                    <Link href={`/dashboard/users/${user.uid}`}>View Profile</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
