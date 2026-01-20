'use client';

import Image from 'next/image';

interface HeroBannerProps {
  image?: string;
  title: string;
  subtitle?: string;
}

export default function HeroBanner({
  image,
  title,
  subtitle,
}: HeroBannerProps) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 24,
        minHeight: 160,
        background:
          'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(30,64,175,0.18))',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
      }}
    >
      {/* HERO IMAGE */}
      {image && (
        <Image
          src={image}
          alt="Dashboard hero"
          fill
          priority
          style={{
            objectFit: 'cover',
            opacity: 0.35, // 🔑 KEY: visible but not overpowering
          }}
        />
      )}

      {/* LIGHT GRADIENT OVERLAY */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(15,23,42,0.6), rgba(15,23,42,0.25), rgba(15,23,42,0.1))',
        }}
      />

      {/* CONTENT */}
      <div
        style={{
          position: 'relative',
          padding: 32,
          zIndex: 1,
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 6,
            color: '#f8fafc',
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              fontSize: 14,
              opacity: 0.85,
              color: '#e5e7eb',
              maxWidth: 520,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}