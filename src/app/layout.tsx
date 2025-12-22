import type { ReactNode } from 'react';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: '#020d16',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}