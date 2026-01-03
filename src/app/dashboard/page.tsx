import RequireRole from "@/components/auth/RequireRole";

export default function DashboardPage() {
  return (
    <RequireRole role="user">
      <main style={{ padding: 40 }}>
        <h1>Dashboard</h1>
        <p>Login successful ✅</p>
      </main>
    </RequireRole>
  );
}
