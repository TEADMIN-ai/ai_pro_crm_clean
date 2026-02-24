"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import type { AppUser } from "@/types/user";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";

export default function UsersPage() {
  const { role, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const data: AppUser[] = snapshot.docs.map((doc) => doc.data() as AppUser);
        setUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  if (authLoading || loading) {
    return <div className="enterprise-page">Loading users...</div>;
  }

  if (role !== "admin") {
    return <div className="enterprise-page">Access denied</div>;
  }

  const adminCount = users.filter((user) => user.role === "admin").length;
  const contractorCount = users.filter((user) => user.role === "contractor").length;
  const staffCount = users.filter((user) => user.role === "staff").length;

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader title="Users" subtitle="Identity, roles, and compliance access">
          <Badge tone="info">Total {users.length}</Badge>
        </IdentityCardHeader>
      </Card>

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
            <p className="enterprise-metric-label">Staff</p>
            <p className="enterprise-metric-value">{staffCount}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2>Premium Users Table</h2>
        {users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid}>
                  <td>{user.email}</td>
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
