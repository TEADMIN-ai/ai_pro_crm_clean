node -e "require('fs').writeFileSync('src/lib/roles.js', `
import { doc, getDoc } from \"firebase/firestore\";
import { db } from \"./firebase\";

export async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().role : null;
}
`)"`