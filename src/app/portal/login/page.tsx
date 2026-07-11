export default function PortalLoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: 'var(--tex-bg)' }}>
      <section style={{ maxWidth: 720, width: '100%', background: 'var(--tex-surface)', border: '1px solid var(--tex-border)', borderRadius: 20, padding: '2rem', boxShadow: 'var(--tex-shadow-sm)' }}>
        <p className="dashboard-eyebrow">Contractor Portal</p>
        <h1 style={{ marginTop: 8, color: 'var(--tex-text-strong)', fontSize: '1.75rem', fontWeight: 800 }}>Portal Login</h1>
        <p style={{ marginTop: 8, color: 'var(--tex-text-muted)', lineHeight: 1.7 }}>The portal login flow will be introduced in a later phase.</p>
      </section>
    </main>
  );
}
