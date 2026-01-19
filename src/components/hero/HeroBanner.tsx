'use client';

import React from 'react';

interface HeroBannerProps {
  title: string;
  subtitle?: string;
  heroImage: string;
}

export default function HeroBanner({
  title,
  subtitle,
  heroImage,
}: HeroBannerProps) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 32,
        minHeight: 230,

        /* MUCH LIGHTER, BRAND-BLUE OVERLAY */
        backgroundImage: `
          linear-gradient(
            to right,
            rgba(20, 60, 120, 0.45),
            rgba(20, 60, 120, 0.28),
            rgba(20, 60, 120, 0.12)
          ),
          url(${heroImage})
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
      }}
    >
      {/* Soft vignette instead of dark mask */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.08), rgba(0,0,0,0.18))',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '42px 46px',
          maxWidth: 920,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 0.4,
            textShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              marginTop: 10,
              fontSize: 14,
              opacity: 0.92,
              maxWidth: 580,
              lineHeight: 1.6,
              textShadow: '0 1px 4px rgba(0,0,0,0.35)',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}