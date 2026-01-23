'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: 40,
        maxWidth: 600,
        margin: '100px auto',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        color: '#fff',
      }}
    >
      <h2>Something went wrong</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          opacity: 0.8,
          marginTop: 12,
        }}
      >
        {error.message}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: 20,
          padding: '8px 14px',
          borderRadius: 8,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
