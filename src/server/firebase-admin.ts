import { getFirebaseAdmin } from "@/lib/firebase/admin";

export function getAdmin() {
  return {
    db: getFirebaseAdmin(),
  };
}

