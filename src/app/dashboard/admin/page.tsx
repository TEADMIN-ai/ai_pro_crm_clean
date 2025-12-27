import RequireRole from '@/components/auth/RequireRole';

export default function AdminPage() {
  return (
    <RequireRole allow={['admin']} fallback={<p>Access denied</p>}>
      <h1>Admin Dashboard</h1>
    </RequireRole>
  );
}
