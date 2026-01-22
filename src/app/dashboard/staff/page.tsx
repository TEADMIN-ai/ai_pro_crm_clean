'use client';

import '@/styles/contrast.css';

export default function StaffDashboardPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 32,
        background:
          'radial-gradient(circle at top left, #cfe6ff 0%, #a7c7e7 25%, #5a6f88 55%, #0a1220 100%)',
      }}
    >
      {/* HEADER */}
      <h1 className="text-contrast" style={{ fontSize: 34, marginBottom: 6 }}>
        Staff Dashboard
      </h1>

      <p className="text-contrast-soft" style={{ marginBottom: 28 }}>
        Your assigned deals and daily actions
      </p>

      {/* KPI ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard label="My Deals" value={0} />
        <KpiCard label="Open" value={0} />
        <KpiCard label="Won" value={0} />
        <KpiCard label="Lost" value={0} />
      </div>

      {/* ASSIGNED DEALS */}
      <div
        style={{
          padding: 20,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(14px)',
          marginBottom: 28,
        }}
      >
        <h3 className="section-title" style={{ marginBottom: 6 }}>
          My Assigned Deals
        </h3>
        <p className="text-contrast-soft">No deals assigned to you.</p>
      </div>

      {/* DOCUMENTS */}
      <div
        style={{
          padding: 20,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(14px)',
          marginBottom: 28,
        }}
      >
        <h3 className="section-title" style={{ marginBottom: 6 }}>
          Client Documents
        </h3>
        <p className="text-contrast-soft" style={{ marginBottom: 12 }}>
          Upload required client documents for finance approval.
        </p>

        <button
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
          }}
        >
          Upload Documents
        </button>
      </div>

      {/* SALES ASSISTANT */}
      <div
        style={{
          maxWidth: 360,
          padding: 20,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
        }}
      >
        <h3 className="section-title">Sales Assistant</h3>
        <p className="text-contrast-soft" style={{ marginBottom: 12 }}>
          Ask how to respond to customers, handle objections, or follow up.
        </p>

        <input
          placeholder="Ask how to respond to a customer..."
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: 'none',
            marginBottom: 10,
          }}
        />

        <button
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 10,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

/* ---------- KPI CARD ---------- */

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.22)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div className="text-contrast-soft" style={{ fontSize: 14 }}>
        {label}
      </div>
      <div className="kpi-value" style={{ fontSize: 30 }}>
        {value}
      </div>
    </div>
  );
}
