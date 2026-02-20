import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className }: CardProps) {
  return <section className={`enterprise-card ${className ?? ""}`.trim()}>{children}</section>;
}

type IdentityCardHeaderProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function IdentityCardHeader({
  title,
  subtitle,
  children,
}: IdentityCardHeaderProps) {
  return (
    <header className="identity-card-header">
      <div>
        <h1 className="identity-title">{title}</h1>
        {subtitle ? <p className="identity-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="identity-actions">{children}</div> : null}
    </header>
  );
}

