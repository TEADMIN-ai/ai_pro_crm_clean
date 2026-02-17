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
        position: "relative",
        width: "100%",
        minHeight: 260,
        padding: "48px 32px",
        borderRadius: 18,
        marginBottom: 32,
        backgroundImage: `linear-gradient(
          rgba(0,0,0,0.55),
          rgba(0,0,0,0.55)
        ), url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
      }}
    >
      <h1
        style={{
          fontSize: 36,
          fontWeight: 700,
          marginBottom: 10,
          color: "#ffffff",
          textShadow: "0 6px 20px rgba(0,0,0,0.7)",
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
            color: "#e5e7eb",
            textShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

