"use client";

type HeroBannerProps = {
  image: string;
  title: string;
  subtitle?: string;
};

export default function HeroBanner({
  image,
  title,
  subtitle,
}: HeroBannerProps) {
  return (
    <div
      style={{
        marginBottom: 32,
        padding: 32,
        borderRadius: 24,
        backgroundImage: `linear-gradient(
          rgba(15, 23, 42, 0.78),
          rgba(15, 23, 42, 0.78)
        ), url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        color: "#ffffff",
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
      }}
    >
      <h1
        style={{
          fontSize: 34,
          fontWeight: 800,
          marginBottom: 8,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          style={{
            fontSize: 16,
            opacity: 0.9,
            maxWidth: 640,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}