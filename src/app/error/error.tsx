'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: 40,
        maxWidth: 600,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <h2>Something went wrong</h2>

      <pre
        style={{
          marginTop: 12,
          padding: 12,
          background: 'rgba(0,0,0,0.05)',
          borderRadius: 8,
          fontSize: 13,
          whiteSpace: 'pre-wrap',
        }}
      >
        {error.message}
      </pre>

      <button
        onClick={reset}
        style={{
          marginTop: 20,
          padding: '10px 16px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}