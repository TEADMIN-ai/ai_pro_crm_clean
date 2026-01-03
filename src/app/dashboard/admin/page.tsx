import RequireRole from "@/components/auth/RequireRole";

export default function AdminPage() {
  return (
    <RequireRole role="admin">
      <main style={{ padding: 40 }}>
        <h1>Admin Dashboard</h1>
        <p>You have admin access.</p>
      </main>
    </RequireRole>
  );
}