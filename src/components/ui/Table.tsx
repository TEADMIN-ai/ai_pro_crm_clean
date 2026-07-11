import type { ReactNode } from "react";
import { EnterpriseTable } from "@/components/ui/EnterpriseUI";

type TableProps = {
  children: ReactNode;
  className?: string;
};

export default function Table({ children, className }: TableProps) {
  return <EnterpriseTable className={className}>{children}</EnterpriseTable>;
}
