export default function Navbar() {
  return (
    <nav style={{ padding: 20, background: 'var(--tex-surface)', borderBottom: '1px solid var(--tex-border)' }}>
      <a href="/dashboard" style={{ color: 'var(--tex-accent)', fontWeight: 700, textDecoration: 'none' }}>Dashboard</a>
    </nav>
  );
}
