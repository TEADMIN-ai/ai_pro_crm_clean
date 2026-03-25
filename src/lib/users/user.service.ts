import "server-only";

import type { AppUser } from "@/types/user";
import { getAdminAuth, getFirebaseAdmin } from "@/lib/firebase/admin";
import { MANAGED_USER_ROLES, type ManagedUserRole } from "@/lib/users/managedUserRoles";

export class CreateUserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateUserValidationError";
  }
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: ManagedUserRole;
}

export interface CreateUserResult {
  user: AppUser;
}

const MIN_PASSWORD_LENGTH = 8;

function isManagedUserRole(value: unknown): value is ManagedUserRole {
  return typeof value === "string" && MANAGED_USER_ROLES.includes(value as ManagedUserRole);
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCreateUserInput(input: CreateUserInput): CreateUserInput {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  const role = input.role;

  if (!name || !email || !password || !role) {
    throw new CreateUserValidationError("All fields are required.");
  }

  if (!validateEmail(email)) {
    throw new CreateUserValidationError("Enter a valid email address.");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new CreateUserValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (!isManagedUserRole(role)) {
    throw new CreateUserValidationError("Role must be admin, staff, contractor, or manager.");
  }

  return {
    name,
    email,
    password,
    role,
  };
}

export async function createManagedUser(input: CreateUserInput): Promise<CreateUserResult> {
  const payload = validateCreateUserInput(input);
  const auth = getAdminAuth();
  const db = getFirebaseAdmin();
  const createdAt = Date.now();

  const authUser = await auth.createUser({
    displayName: payload.name,
    email: payload.email,
    password: payload.password,
  });

  try {
    await db.collection("users").doc(authUser.uid).set({
      uid: authUser.uid,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      createdAt,
    });

    await auth.setCustomUserClaims(authUser.uid, {
      role: payload.role,
      contractorId: null,
    });

    return {
      user: {
        uid: authUser.uid,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        createdAt,
      },
    };
  } catch (error) {
    await auth.deleteUser(authUser.uid).catch((cleanupError) => {
      console.error("Failed to rollback Firebase Auth user after Firestore write error:", cleanupError);
    });

    throw error;
  }
}
