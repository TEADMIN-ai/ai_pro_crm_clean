'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: 40 }}>
        <h2>Something went wrong</h2>
        <pre>{error.message}</pre>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
