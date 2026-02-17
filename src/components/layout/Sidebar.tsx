import type { UserRole } from "@/types/auth";

type SidebarProps = {
  role?: UserRole;
};

export default function Sidebar({ role }: SidebarProps) {
  return (
    <div
      style={{
        width: 220,
        padding: 20,
        background: "#0f172a",
        color: "white",
      }}
    >
      <h3 style={{ marginBottom: 16 }}>Navigation</h3>

      {/* You can still use role conditionally later */}
      <div style={{ opacity: 0.7, fontSize: 14 }}>
        {role ? `Role: ${role}` : "Role not loaded"}
      </div>
    </div>
  );
}