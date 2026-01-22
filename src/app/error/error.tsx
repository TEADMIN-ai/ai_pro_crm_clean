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
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        background: '#0b1220',
        color: '#fff',
      }}
    >
      <h2>Something went wrong</h2>

      <pre
        style={{
          opacity: 0.7,
          maxWidth: 600,
          whiteSpace: 'pre-wrap',
          textAlign: 'center',
        }}
      >
        {error.message}
      </pre>

      <button
        onClick={reset}
        style={{
          padding: '10px 16px',
          borderRadius: 8,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}