'use client';

import React from 'react';

type HeroBannerProps = {
  title: string;
  subtitle?: string;
  image?: string; // path from /public (e.g. "/images/manager-banner.png")
  height?: number;
};

export default function HeroBanner({
  title,
  subtitle,
  image,
  height = 220,
}: HeroBannerProps) {
  return (
    <div style={{ ...styles.wrapper, height }}>
      {image && (
        <div
          style={{
            ...styles.background,
            backgroundImage: `url(${image})`,
          }}
        />
      )}

      <div style={styles.overlay} />

      <div style={styles.content}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>
    </div>
  );
}

/* ================= Styles ================= */

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    background:
      'linear-gradient(135deg, #0b1020 0%, #0e1630 50%, #0a0f1f 100%)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
  },

  background: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'brightness(0.75) contrast(1.1)',
    transform: 'scale(1.05)',
  },

  overlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(90deg, rgba(5,10,25,0.85) 0%, rgba(5,10,25,0.55) 50%, rgba(5,10,25,0.25) 100%)',
  },

  content: {
    position: 'relative',
    zIndex: 2,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '32px 40px',
    color: '#ffffff',
  },

  title: {
    fontSize: 34,
    fontWeight: 700,
    margin: 0,
    letterSpacing: 0.5,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.85,
    maxWidth: 600,
    lineHeight: 1.5,
  },
};
