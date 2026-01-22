"use client";

interface Props {
  title: string;
  subtitle?: string;
  backgroundImage?: string;
}

export default function HeroBanner({
  title,
  subtitle,
  backgroundImage,
}: Props) {
  return (
    <div
      style={{
        backgroundImage: backgroundImage
          ? `url(${backgroundImage})`
          : undefined,
        backgroundSize: "cover",
        borderRadius: 20,
        padding: 32,
      }}
    >
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}