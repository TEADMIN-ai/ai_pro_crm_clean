"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

export default function LogoutButton() {
  const router = useRouter();
  const { user } = useAuthContext();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
      <span style={{ opacity: 0.7 }}>{user?.email}</span>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
