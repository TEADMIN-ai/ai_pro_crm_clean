import type { ReactNode } from "react";

type TableProps = {
  children: ReactNode;
  className?: string;
};

export default function Table({ children, className }: TableProps) {
  return (
    <div className="enterprise-table-wrap">
      <table className={`enterprise-table ${className ?? ""}`.trim()}>{children}</table>
    </div>
  );
}
