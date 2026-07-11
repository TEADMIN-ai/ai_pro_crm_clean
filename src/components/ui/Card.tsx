import type { ReactNode } from "react";
import { EnterpriseCard, EnterpriseIdentityHeader } from "@/components/ui/EnterpriseUI";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className }: CardProps) {
  return <EnterpriseCard className={className}>{children}</EnterpriseCard>;
}

export function IdentityCardHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return <EnterpriseIdentityHeader title={title} subtitle={subtitle}>{children}</EnterpriseIdentityHeader>;
}
