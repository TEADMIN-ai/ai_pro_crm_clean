/**
 * Legacy Firebase config compatibility layer
 * ------------------------------------------
 * This file exists to support older imports like:
 *   import { db } from "@/lib/firebase/config";
 *
 * New code should import directly from:
 *   "@/lib/firebase"
 *
 * Safe to keep until all legacy imports are removed.
 */

export { auth, db } from "@/lib/firebase";